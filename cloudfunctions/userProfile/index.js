// 云函数 userProfile — 用户目标与档案读写（PG 版）
const cloud = require('wx-server-sdk');
const { one, str, jsonb } = require('./fitdb');
cloud.init({ env: 'everyday-rose-d0gihszbt1940f4d1' });

exports.main = async (event, context) => {
  const { action } = event;
  const openid = cloud.getWXContext().OPENID;
  if (!openid) return { code: -1, msg: '登录态缺失，请从小程序内调用' };

  try {
    if (action === 'get') {
      const row = await one(
        `SELECT data::text FROM public.fit_users WHERE data->>'openid'=${str(openid)} LIMIT 1`
      );
      const data = row ? JSON.parse(row[0]) : null;
      return { code: 0, data, msg: 'ok' };
    }

    if (action === 'update') {
      // 白名单字段，防止越权写入
      const allowed = ['nickname', 'avatarUrl', 'gender', 'age', 'height', 'targetWeight', 'dailyCalorieTarget'];
      const patch = { updatedAt: Date.now() };
      allowed.forEach(k => { if (event[k] !== undefined) patch[k] = event[k]; });
      const res = await one(
        `UPDATE public.fit_users SET data = data || ${jsonb(patch)}
         WHERE data->>'openid'=${str(openid)} RETURNING id`
      );
      return { code: 0, data: { updated: !!(res && res[0]) }, msg: 'ok' };
    }

    return { code: -1, msg: '未知操作' };
  } catch (err) {
    console.error('userProfile error:', err);
    return { code: -1, msg: '服务异常' };
  }
};
