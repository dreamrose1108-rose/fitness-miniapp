// 云函数 record — 饮食/运动/体重记录的增删改查与聚合统计（PG 版）
// 安全要点：所有查询强制拼接 openid（来自云上下文），不信任前端传入的 openid
const cloud = require('wx-server-sdk');
const { one, query, str, jsonb, newId } = require('./fitdb');
cloud.init({ env: 'everyday-rose-d0gihszbt1940f4d1' });

const TABLES = {
  diet: 'fit_diet_records',
  exercise: 'fit_exercise_records',
  body: 'fit_body_records',
  coach: 'fit_coach_chats'
};

// 返回带 _id 的文档数组（保持原 NoSQL 返回结构，客户端零改动）
async function listDocs(table, whereSql, orderSql, limit) {
  const rows = await query(
    `SELECT id, data::text FROM public."${table}" WHERE ${whereSql} ORDER BY ${orderSql} LIMIT ${limit}`
  );
  return rows.map(r => Object.assign({ _id: r[0] }, JSON.parse(r[1])));
}

exports.main = async (event, context) => {
  const { action, type } = event;
  const openid = cloud.getWXContext().OPENID;
  if (!openid) return { code: -1, msg: '登录态缺失，请从小程序内调用' };
  const table = TABLES[type];
  if (!table) return { code: -1, msg: '未知记录类型' };
  const owner = `data->>'openid'=${str(openid)}`;

  try {
    switch (action) {
      // 新增记录
      case 'add': {
        const data = Object.assign({}, event.data, { openid, createdAt: Date.now() });
        // 饮食记录：可选绑定餐拍照片（云存储 fileID）
        if (type === 'diet' && data.photoFileID && typeof data.photoFileID === 'string') {
          data.photoFileID = data.photoFileID.slice(0, 200); // 防超长脏数据
        }
        // 体重按 openid+date 覆盖（同日只留一条）
        if (type === 'body') {
          const updated = await one(
            `UPDATE public."${table}" SET data = data || ${jsonb({
              weight: event.data.weight, fatRate: event.data.fatRate, updatedAt: Date.now()
            })} WHERE ${owner} AND data->>'date'=${str(event.data.date)} RETURNING id`
          );
          if (updated && updated[0]) return { code: 0, data: { updated: true }, msg: 'ok' };
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
          `DELETE FROM public."${table}" WHERE id=${str(event.id)} AND ${owner} RETURNING id`
        );
        return { code: 0, data: { removed: removed ? 1 : 0 }, msg: 'ok' };
      }

      // 按日期范围查询列表
      case 'list': {
        const { start, end, limit = 50 } = event;
        let where = owner;
        if (start && end) where += ` AND data->>'date' BETWEEN ${str(start)} AND ${str(end)}`;
        const order = type === 'coach'
          ? `(data->>'createdAt')::bigint ASC`
          : `data->>'date' DESC, (data->>'createdAt')::bigint DESC`;
        const docs = await listDocs(table, where, order, Math.min(limit, 100));
        return { code: 0, data: docs, msg: 'ok' };
      }

      // 今日汇总：摄入/消耗/最新体重
      case 'summary': {
        const date = event.date;
        const [diet, exercise, body] = await Promise.all([
          one(`SELECT COALESCE(sum((data->>'kcal')::numeric),0) FROM public.fit_diet_records WHERE ${owner} AND data->>'date'=${str(date)}`),
          one(`SELECT COALESCE(sum((data->>'kcalBurned')::numeric),0) FROM public.fit_exercise_records WHERE ${owner} AND data->>'date'=${str(date)}`),
          one(`SELECT data->>'weight' FROM public.fit_body_records WHERE ${owner} ORDER BY data->>'date' DESC, (data->>'createdAt')::bigint DESC LIMIT 1`)
        ]);
        const [dietCnt, exCnt] = await Promise.all([
          one(`SELECT count(*)::int FROM public.fit_diet_records WHERE ${owner} AND data->>'date'=${str(date)}`),
          one(`SELECT count(*)::int FROM public.fit_exercise_records WHERE ${owner} AND data->>'date'=${str(date)}`)
        ]);
        const intake = Number(diet ? diet[0] : 0);
        const burned = Number(exercise ? exercise[0] : 0);
        return {
          code: 0,
          data: {
            intake: Math.round(intake),
            burned: Math.round(burned),
            net: Math.round(intake - burned),
            latestWeight: body && body[0] !== null ? Number(body[0]) : null,
            dietCount: dietCnt ? dietCnt[0] : 0,
            exerciseCount: exCnt ? exCnt[0] : 0
          },
          msg: 'ok'
        };
      }

      // 趋势数据：按日期聚合近 N 天
      case 'trend': {
        const { start, end } = event;
        const range = `${owner} AND data->>'date' BETWEEN ${str(start)} AND ${str(end)}`;
        const [dietAgg, exAgg, bodyList] = await Promise.all([
          query(`SELECT data->>'date' AS d, sum((data->>'kcal')::numeric)::int AS kcal FROM public.fit_diet_records WHERE ${range} GROUP BY 1 ORDER BY 1`),
          query(`SELECT data->>'date' AS d, sum((data->>'kcalBurned')::numeric)::int AS kcal FROM public.fit_exercise_records WHERE ${range} GROUP BY 1 ORDER BY 1`),
          query(`SELECT data->>'date', data->>'weight' FROM public.fit_body_records WHERE ${range} ORDER BY data->>'date' ASC LIMIT 100`)
        ]);
        return {
          code: 0,
          data: {
            intake: dietAgg.map(r => ({ _id: r[0], kcal: r[1] })),
            burned: exAgg.map(r => ({ _id: r[0], kcal: r[1] })),
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

        // 今天（服务器本地时区）是否已打卡
        const now = new Date();
        const pad = n => (n < 10 ? '0' + n : '' + n);
        const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        const todayChecked = dateSet.has(todayStr);

        // 连续打卡：从今天（或昨天）往回数
        let streak = 0;
        const cursor = new Date(now);
        if (!todayChecked) cursor.setDate(cursor.getDate() - 1); // 今天没记不断签，从昨天起算
        while (true) {
          const d = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(cursor.getDate())}`;
          if (!dateSet.has(d)) break;
          streak++;
          cursor.setDate(cursor.getDate() - 1);
        }

        // 里程碑（纯个人成就展示）
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
