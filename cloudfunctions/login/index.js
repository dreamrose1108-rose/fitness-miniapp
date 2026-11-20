// 云函数 login — 静默登录（HTTP 版）
// 客户端 wx.login() 拿 code → POST {code} → code2session 换 openid → 建档 → 签发 token
const { ensureProfile } = require('./profile');
const { sign, parseEvent, code2session } = require('./fitauth');

exports.main = async (event) => {
  const params = parseEvent(event);
  if (!params.code) return { code: -1, msg: '缺少登录凭证' };

  try {
    const ses = await code2session(params.code);
    if (!ses.openid) {
      return { code: -1, msg: '登录凭证无效' + (ses.errcode ? '(' + ses.errcode + ')' : '') };
    }
    const openid = ses.openid;

    await ensureProfile(openid);

    const token = sign(openid);
    // 兼容客户端两种读法：顶层 openid/token 与 data 信封
    return { code: 0, openid, token, data: { openid, token }, msg: 'ok' };
  } catch (err) {
    console.error('login error:', err);
    return { code: -1, msg: '服务异常' };
  }
};
