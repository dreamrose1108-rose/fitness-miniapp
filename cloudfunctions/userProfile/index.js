// 云函数 userProfile — 用户目标与档案读写（HTTP 版）
const { one, str, jsonb } = require('./fitdb');
const { ensureProfile } = require('./profile');
const { parseEvent, getOpenid } = require('./fitauth');

exports.main = async (event) => {
  const params = parseEvent(event);
  const openid = getOpenid(params);
  if (!openid) return { code: -1, msg: '登录态缺失或已过期，请重启小程序' };
  const { action } = params;

  try {
    if (action === 'get') {
      await ensureProfile(openid);
      const row = await one(
        `SELECT data::text FROM public.fit_users WHERE data->>'openid'=${str(openid)} LIMIT 1`
      );
      const data = row ? JSON.parse(row[0]) : null;
      return { code: 0, data, msg: 'ok' };
    }

    if (action === 'update') {
      // 白名单字段，防止越权写入
      const allowed = ['nickname', 'avatarUrl', 'gender', 'age', 'height', 'targetWeight', 'dailyCalorieTarget', 'dailyWaterTarget', 'nutritionGoal', 'proteinTarget', 'carbTarget', 'fatTarget'];
      const patch = { updatedAt: Date.now() };
      allowed.forEach(k => { if (params[k] !== undefined) patch[k] = params[k]; });
      const bounds = { dailyWaterTarget:[100,10000], proteinTarget:[0,1000], carbTarget:[0,2000], fatTarget:[0,1000] };
      for (const key of Object.keys(bounds)) {
        if (patch[key] !== undefined && patch[key] !== null && (typeof patch[key] !== 'number' || !Number.isFinite(patch[key]) || patch[key] < bounds[key][0] || patch[key] > bounds[key][1])) return { code:-1, msg:'目标数值超出范围' };
      }
      if (patch.nutritionGoal !== undefined && patch.nutritionGoal !== null && !['maintain','lose','gain'].includes(patch.nutritionGoal)) return { code:-1, msg:'目标类型无效' };
      for (const key of ['height', 'targetWeight', 'dailyCalorieTarget', 'age']) {
        if (patch[key] !== undefined && (typeof patch[key] !== 'number' || !Number.isFinite(patch[key]) || patch[key] <= 0)) {
          return { code: -1, msg: '请输入有效的正数' };
        }
      }
      if (patch.nickname !== undefined && (typeof patch.nickname !== 'string' || !patch.nickname.trim() || patch.nickname.length > 40)) return { code: -1, msg: '请输入有效昵称' };
      await ensureProfile(openid);
      const res = await one(
        `UPDATE public.fit_users SET data = data || ${jsonb(patch)}
         WHERE data->>'openid'=${str(openid)} RETURNING id`
      );
      // 管理SQL桥不保证UPDATE RETURNING提供Rows，以读回结果确认持久化。
      const verified = await one(`SELECT data::text FROM public.fit_users WHERE data->>'openid'=${str(openid)} LIMIT 1`);
      const current = verified ? JSON.parse(verified[0]) : null;
      if (!current || !Object.keys(patch).every(key => current[key] === patch[key])) return { code: -1, msg: '资料未保存，请重试' };
      return { code: 0, data: { updated: true }, msg: 'ok' };
    }

    return { code: -1, msg: '未知操作' };
  } catch (err) {
    console.error('userProfile error:', err);
    return { code: -1, msg: '服务异常' };
  }
};
