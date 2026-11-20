// fitauth.js — HTTP 模式鉴权（替代 wx.cloud 的 WX Context）
// 1. login 用 code2session 换 openid（需要 FIT_WX_APP_SECRET 环境变量）
// 2. 业务函数用 HMAC token 验证身份（FIT_TOKEN_SECRET 环境变量，各函数共享）
// 3. msgSecCheck 走 REST（HTTP 调用下 cloud.openapi 不可用）
const crypto = require('crypto');
const https = require('https');
const APPID = 'wxf34ff7e4492d44f9';
const TOKEN_TTL_MS = 30 * 24 * 3600 * 1000; // 30 天

function hmac(payload) {
  return crypto.createHmac('sha256', process.env.FIT_TOKEN_SECRET || '').update(payload).digest('base64url');
}

// 生成 token：openid.exp.sig
function sign(openid) {
  const payload = openid + '.' + (Date.now() + TOKEN_TTL_MS);
  return payload + '.' + hmac(payload);
}

// 验证 token → openid（失败返回 null）；恒定时间比较防时序攻击
function verify(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [openid, exp, sig] = parts;
  if (!openid || !/^\d+$/.test(exp) || Number(exp) < Date.now()) return null;
  const expect = hmac(openid + '.' + exp);
  if (!expect || sig.length !== expect.length) return null;
  const a = Buffer.from(sig), b = Buffer.from(expect);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0 ? openid : null;
}

// HTTP 网关事件：JSON body 在 event.body；直接调用则 event 即参数对象
function parseEvent(event) {
  if (event && typeof event === 'object' && event.body !== undefined && event.headers !== undefined) {
    try {
      return typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
    } catch (e) { return {}; }
  }
  return (event && typeof event === 'object') ? event : {};
}

function getOpenid(params) {
  return verify(params && params.token);
}

function httpsJson(url, options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options || {}, res => {
      let d = '';
      res.on('data', c => { d += c; });
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(new Error('bad-json:' + d.slice(0, 100))); } });
    });
    req.on('error', reject);
    if (body) { req.write(body); }
    req.end();
  });
}

// 微信 code → openid
async function code2session(code) {
  const secret = process.env.FIT_WX_APP_SECRET;
  if (!secret) throw new Error('未配置 FIT_WX_APP_SECRET');
  return httpsJson(`https://api.weixin.qq.com/sns/jscode2session?appid=${APPID}&secret=${secret}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`);
}

// access_token 缓存（模块级，热函数实例内复用）
let cachedToken = '', cachedAt = 0;
async function accessToken() {
  if (cachedToken && Date.now() - cachedAt < 7000 * 1000) return cachedToken;
  const secret = process.env.FIT_WX_APP_SECRET;
  if (!secret) throw new Error('未配置 FIT_WX_APP_SECRET');
  const j = await httpsJson(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APPID}&secret=${secret}`);
  if (!j.access_token) throw new Error('access_token 失败:' + JSON.stringify(j).slice(0, 120));
  cachedToken = j.access_token;
  cachedAt = Date.now();
  return cachedToken;
}

// 内容安全检查（REST 版）
async function msgSecCheck(content, openid) {
  try {
    const tk = await accessToken();
    const body = JSON.stringify({ content, version: 2, scene: 2, openid });
    const j = await httpsJson(`https://api.weixin.qq.com/wxa/msg_sec_check?access_token=${tk}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, body);
    return j && j.result && j.result.suggest === 'pass';
  } catch (err) {
    console.error('msgSecCheck error:', err.message);
    return false; // 异常时保守拦截
  }
}

module.exports = { sign, verify, parseEvent, getOpenid, code2session, msgSecCheck, APPID };
