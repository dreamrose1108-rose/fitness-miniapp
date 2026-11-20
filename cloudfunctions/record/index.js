// 云函数 record — 饮食/运动/体重记录的增删改查与聚合统计（HTTP 版）
// 安全要点：所有查询强制拼接 openid（来自 token 验证），不信任前端传入的 openid
const { one, query, str, jsonb, newId } = require('./fitdb');
const { handlePhoto, ownedPhoto } = require('./photos');
const { parseEvent, getOpenid } = require('./fitauth');

const TABLES = {
  diet: 'fit_diet_records',
  exercise: 'fit_exercise_records',
  body: 'fit_body_records',
  coach: 'fit_coach_chats'
};

// 返回带 _id 的文档数组（保持 NoSQL 时代返回结构，客户端零改动）
async function listDocs(table, whereSql, orderSql, limit) {
  const rows = await query(
    `SELECT id, data::text FROM public."${table}" WHERE ${whereSql} ORDER BY ${orderSql} LIMIT ${limit}`
  );
  return rows.map(r => Object.assign({ _id: r[0] }, JSON.parse(r[1])));
}

exports.main = async (event) => {
  const params = parseEvent(event);
  const { action, type } = params;
  // 管理员媒体导入：不要求用户登录态，用独立 adminKey 鉴权
  if (action === 'mediaIngest') {
    if (params.adminKey !== process.env.FIT_ADMIN_KEY) return { code: -1, msg: '无权限' };
    try {
      const { objectCall } = require('./photos');
      const https = require('https');
      const items = (params.items || []).slice(0, 12);
      const results = [];
      for (const it of items) {
        if (!/^exercise-media\/gif-v1\/\d{4}-[A-Za-z0-9]+\.gif$/.test(it.key)) { results.push({ key: it.key, ok: false, err: 'bad key' }); continue; }
        try {
          const bytes = await new Promise((resolve, reject) => {
            const bufs = [];
            https.get(it.url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 30000 }, r => {
              if (r.statusCode !== 200) return reject(new Error('HTTP ' + r.statusCode));
              r.on('data', c => bufs.push(c)); r.on('end', () => resolve(Buffer.concat(bufs)));
            }).on('error', reject).on('timeout', function() { this.destroy(new Error('下载超时')); });
          });
          if (bytes.length < 10000 || bytes.length > 20 * 1024 * 1024) throw new Error('尺寸异常 ' + bytes.length);
          await objectCall('putObject', it.key, { Body: bytes, ACL: 'private', ContentType: 'image/gif' });
          results.push({ key: it.key, ok: true, size: bytes.length });
        } catch (e) { results.push({ key: it.key, ok: false, err: String(e.message).slice(0, 80) }); }
      }
      return { code: 0, data: results, msg: 'ok' };
    } catch (err) { console.error('media ingest failure:', err.message); return { code: -1, msg: '导入失败' }; }
  }
  const openid = getOpenid(params);
  if (!openid) return { code: -1, msg: '登录态缺失或已过期，请重启小程序' };
  if(action==='savePhotoMeal'){try{return {code:0,data:await require('./meal-record').save(params.data,openid),msg:'ok'};}catch(e){const msg=String(e.message||'');return {code:-1,msg:/照片|日期|餐次|食物|分量|热量|营养素|总量|未保存/.test(msg)?msg:'餐食保存失败，请重试'};}}
  if (action === 'exerciseMedia') {
    try { return { code: 0, data: await require('./exercise-media').getMedia(params.ids), msg: 'ok' }; }
    catch (err) { console.error('exercise media failure:', err.code || err.name); return { code: -1, msg: '演示加载失败，请重试' }; }
  }

  if (['waterAdd', 'waterList', 'waterRemove', 'calendar'].includes(action)) {
    try { return { code: 0, data: await require('./wellness').handleWellness(params, openid), msg: 'ok' }; }
    catch (err) { console.error('wellness failure:', err.code || err.name); return { code: -1, msg: /日期|毫升|编号|未知操作/.test(err.message) ? err.message : '记录服务暂不可用，请重试' }; }
  }
  if (['photoUpload', 'photoRead', 'photoDelete'].includes(action)) {
    try { return { code: 0, data: await handlePhoto(params, openid), msg: 'ok' }; }
    catch (err) { console.error('photo failure:', err.code || err.message); return { code: -1, msg: /无权|仍被|图片|仅支持/.test(err.message) ? err.message : '照片操作失败（' + String(err.code || err.name || 'STORAGE').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60) + '）' }; }
  }
  const table = TABLES[type];
  if (!table) return { code: -1, msg: '未知记录类型' };
  const owner = `data->>'openid'=${str(openid)}`;

  try {
    switch (action) {
      // 新增记录
      case 'add': {
        if (type === 'coach') return { code: -1, msg: '请通过AI教练发送消息' };
        const input = params.data || {};
        if (typeof input.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !Number.isFinite(Date.parse(input.date))) return { code: -1, msg: '日期无效' };
        const libraryRecord = type === 'exercise' && ['manual','unprovided'].includes(input.calorieSource);
        if (type === 'exercise' && input.calorieSource !== undefined && !libraryRecord) return { code:-1, msg:'消耗来源无效' };
        if (libraryRecord && (typeof input.exerciseId !== 'string' || !/^\d{4}$/.test(input.exerciseId))) return { code:-1, msg:'动作编号无效' };
        if (libraryRecord && input.calorieSource === 'unprovided' && input.kcalBurned !== 0) return { code:-1, msg:'未填写消耗时数值应为零' };
        const numeric = type === 'body' ? ['weight'] : type === 'diet' ? ['amount', 'kcal', 'proteinG', 'carbG', 'fatG'] : libraryRecord ? ['duration','kcalBurned'] : ['met', 'duration', 'kcalBurned'];
        for (const key of numeric) {
          const value = input[key];
          if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (value === 0 && !['kcal', 'kcalBurned', 'proteinG', 'carbG', 'fatG'].includes(key))) return { code: -1, msg: '请输入有效数值' };
        }
        const fields = type === 'body' ? ['date','weight','fatRate'] : type === 'diet' ? ['date','mealType','foodName','amount','kcal','photoFileID','proteinG','carbG','fatG'] : libraryRecord ? ['date','name','duration','kcalBurned','exerciseId','calorieSource'] : ['date','name','met','duration','kcalBurned'];
        const data = { openid, createdAt: Date.now() };
        fields.forEach(key => { if (input[key] !== undefined) data[key] = input[key]; });
        if (data.fatRate !== undefined && (typeof data.fatRate !== 'number' || !Number.isFinite(data.fatRate) || data.fatRate <= 0 || data.fatRate >= 100)) return { code: -1, msg: '体脂率无效' };
        if (type === 'diet' && !['breakfast','lunch','dinner','snack'].includes(data.mealType)) return { code: -1, msg: '餐次无效' };
        if (type !== 'body' && (typeof (data.foodName || data.name) !== 'string' || !(data.foodName || data.name).trim())) return { code: -1, msg: '名称不能为空' };
        if (type === 'diet' && data.photoFileID) {
          if (!ownedPhoto(data.photoFileID, openid)) return { code: -1, msg: '照片无效或不属于当前用户' };
        }
        // 体重按 openid+date 覆盖（同日只留一条）
        if (type === 'body') {
          const existing = await one(`SELECT id FROM public."${table}" WHERE ${owner} AND data->>'date'=${str(data.date)} LIMIT 1`);
          if (existing) {
            await one(`UPDATE public."${table}" SET data = data || ${jsonb({ weight: data.weight, fatRate: data.fatRate, updatedAt: Date.now() })} WHERE ${owner} AND data->>'date'=${str(data.date)}`);
            return { code: 0, data: { updated: true }, msg: 'ok' };
          }
        }
        const id = newId('r');
        await one(
          `INSERT INTO public."${table}" (id, data) VALUES (${str(id)}, ${jsonb(data)})`
        );
        return { code: 0, data: { id }, msg: 'ok' };
      }

      // 删除记录（仅本人）
      case 'remove': {
        const removed = await one(
          `DELETE FROM public."${table}" WHERE id=${str(params.id)} AND ${owner} RETURNING id`
        );
        return { code: 0, data: { removed: removed ? 1 : 0 }, msg: 'ok' };
      }

      // 按日期范围查询列表
      case 'list': {
        const { start, end, limit = 50 } = params;
        let where = owner;
        if (start && end) where += ` AND data->>'date' BETWEEN ${str(start)} AND ${str(end)}`;
        const order = type === 'coach'
          ? `(data->>'createdAt')::bigint DESC`
          : `data->>'date' DESC, (data->>'createdAt')::bigint DESC`;
        const docs = await listDocs(table, where, order, Math.min(Math.max(Number(limit)||50,1),100));
        if(type==='coach')docs.reverse();
        return { code: 0, data: docs, msg: 'ok' };
      }

      // 今日汇总：摄入/消耗/最新体重
      case 'summary': {
        const date = params.date;
        const [dietSum, exSum, bodyW, dietCnt, exCnt, macroSum] = await Promise.all([
          one(`SELECT COALESCE(sum((data->>'kcal')::numeric),0) FROM public.fit_diet_records WHERE ${owner} AND data->>'date'=${str(date)}`),
          one(`SELECT COALESCE(sum((data->>'kcalBurned')::numeric),0) FROM public.fit_exercise_records WHERE ${owner} AND data->>'date'=${str(date)}`),
          one(`SELECT data->>'weight' FROM public.fit_body_records WHERE ${owner} ORDER BY data->>'date' DESC, (data->>'createdAt')::bigint DESC LIMIT 1`),
          one(`SELECT count(*)::int FROM public.fit_diet_records WHERE ${owner} AND data->>'date'=${str(date)}`),
          one(`SELECT count(*)::int FROM public.fit_exercise_records WHERE ${owner} AND data->>'date'=${str(date)}`),
          one(`SELECT COALESCE(sum((data->>'proteinG')::numeric),0), COALESCE(sum((data->>'carbG')::numeric),0), COALESCE(sum((data->>'fatG')::numeric),0) FROM public.fit_diet_records WHERE ${owner} AND data->>'date'=${str(date)}`)
        ]);
        const intake = Number(dietSum ? dietSum[0] : 0);
        const burned = Number(exSum ? exSum[0] : 0);
        return {
          code: 0,
          data: {
            intake: Math.round(intake),
            burned: Math.round(burned),
            net: Math.round(intake - burned),
            latestWeight: bodyW && bodyW[0] !== null ? Number(bodyW[0]) : null,
            dietCount: Number(dietCnt ? dietCnt[0] : 0),
            exerciseCount: Number(exCnt ? exCnt[0] : 0),
            proteinG: Math.round(Number(macroSum ? macroSum[0] : 0)),
            carbG: Math.round(Number(macroSum ? macroSum[1] : 0)),
            fatG: Math.round(Number(macroSum ? macroSum[2] : 0))
          },
          msg: 'ok'
        };
      }

      // 趋势数据：按日期聚合近 N 天
      case 'trend': {
        const { start, end } = params;
        const range = `${owner} AND data->>'date' BETWEEN ${str(start)} AND ${str(end)}`;
        const [dietAgg, exAgg, bodyList] = await Promise.all([
          query(`SELECT data->>'date' AS d, sum((data->>'kcal')::numeric)::int AS kcal FROM public.fit_diet_records WHERE ${range} GROUP BY 1 ORDER BY 1`),
          query(`SELECT data->>'date' AS d, sum((data->>'kcalBurned')::numeric)::int AS kcal FROM public.fit_exercise_records WHERE ${range} GROUP BY 1 ORDER BY 1`),
          query(`SELECT data->>'date', data->>'weight' FROM public.fit_body_records WHERE ${range} ORDER BY data->>'date' ASC LIMIT 100`)
        ]);
        return {
          code: 0,
          data: {
            intake: dietAgg.map(r => ({ _id: r[0], kcal: Number(r[1]) })),
            burned: exAgg.map(r => ({ _id: r[0], kcal: Number(r[1]) })),
            weight: bodyList.map(r => ({ date: r[0], weight: r[1] === null ? null : Number(r[1]) }))
          },
          msg: 'ok'
        };
      }

      // 打卡统计：跨三表去重日期，算连续打卡与里程碑
      // 合规说明：成就仅个人展示，不设分享解锁/排行奖励，规避诱导分享红线
      case 'streak': {
        const [d1, d2, d3] = await Promise.all([
          query(`SELECT DISTINCT data->>'date' AS d FROM public.fit_diet_records WHERE ${owner} AND data->>'date' IS NOT NULL`),
          query(`SELECT DISTINCT data->>'date' AS d FROM public.fit_exercise_records WHERE ${owner} AND data->>'date' IS NOT NULL`),
          query(`SELECT DISTINCT data->>'date' AS d FROM public.fit_body_records WHERE ${owner} AND data->>'date' IS NOT NULL`)
        ]);
        const dateSet = new Set();
        [...d1, ...d2, ...d3].forEach(r => { if (r[0]) dateSet.add(r[0]); });

        const now = new Date();
        const pad = n => (n < 10 ? '0' + n : '' + n);
        const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        const todayChecked = dateSet.has(todayStr);

        let streak = 0;
        const cursor = new Date(now);
        if (!todayChecked) cursor.setDate(cursor.getDate() - 1);
        while (true) {
          const d = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(cursor.getDate())}`;
          if (!dateSet.has(d)) break;
          streak++;
          cursor.setDate(cursor.getDate() - 1);
        }

        const totalDays = dateSet.size;
        const MILESTONES = [3, 7, 14, 30, 60, 100];
        const achieved = MILESTONES.filter(m => totalDays >= m);
        const next = MILESTONES.find(m => totalDays < m) || null;

        return {
          code: 0,
          data: { todayChecked, streak, totalDays, achieved, next },
          msg: 'ok'
        };
      }

      default:
        return { code: -1, msg: '未知操作' };
    }
  } catch (err) {
    console.error('record error:', err);
    return { code: -1, msg: '服务异常' };
  }
};
