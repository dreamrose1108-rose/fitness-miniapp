// 云函数 login — 静默登录（PG 版）
// openid 取自云上下文；建档写入 public.fit_users（openid 唯一索引幂等）
const cloud = require('wx-server-sdk');
const { one, str, jsonb, newId } = require('./fitdb');
cloud.init({ env: 'everyday-rose-d0gihszbt1940f4d1' });

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID;
  if (!openid) return { code: -1, msg: '登录态缺失，请从小程序内调用' };

  try {
    const row = await one(
      `SELECT count(*)::int FROM public.fit_users WHERE data->>'openid'=${str(openid)}`
    );
    if (!row || row[0] === 0) {
      const now = Date.now();
      await one(
        `INSERT INTO public.fit_users (id, data) VALUES (${str(newId('u'))}, ${jsonb({
          openid,
          nickname: '',
          avatarUrl: '',
          gender: 'male',
          height: 170,
          targetWeight: 65,
          dailyCalorieTarget: 1800,
          createdAt: now,
          updatedAt: now
        })}) ON CONFLICT ((data->>'openid')) DO NOTHING`
      );
    }
    // 兼容两种客户端读法：顶层 openid（app.js 裸调 res.result.openid）与 data.openid（utils/cloud.js 信封）
    return { code: 0, openid, data: { openid }, msg: 'ok' };
  } catch (err) {
    console.error('login error:', err);
    return { code: -1, msg: '服务异常' };
  }
};
