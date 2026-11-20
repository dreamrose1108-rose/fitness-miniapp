// utils/cloud.js — 云函数调用封装（HTTP 版）
// wx.cloud 无环境授权（-601034），改走 HTTP 网关 + token 鉴权
const BASE = 'https://everyday-rose-d0gihszbt1940f4d1-1518355204.ap-shanghai.app.tcloudbase.com';
const ROUTES = {
  login: '/fit-login',
  userProfile: '/fit-user',
  record: '/fit-record',
  foodLib: '/fit-food',
  aiCoach: '/fit-coach',
  init: '/fit-init'
};

function getToken() {
  try { return wx.getStorageSync('fitToken') || ''; } catch (e) { return ''; }
}

function post(path, data) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE + path,
      method: 'POST',
      timeout: 90000,
      header: { 'content-type': 'application/json' },
      data,
      success: res => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject({ diagnosticCode: 'HTTP_' + res.statusCode });
          return;
        }
        if (!res.data || typeof res.data !== 'object' || typeof res.data.code !== 'number') {
          reject({ diagnosticCode: 'BAD_RESPONSE' });
          return;
        }
        resolve(res.data);
      },
      fail: err => reject(err)
    });
  });
}

async function call(name, data = {}) {
  try {
    const payload = Object.assign({}, data);
    if (name !== 'login') payload.token = getToken();
    const r = await post(ROUTES[name] || ('/fit-' + name), payload);
    if (r && r.code === 0) return r.data;
    const msg = (r && r.msg) || '请求失败';
    wx.showToast({ title: msg, icon: 'none' });
    throw new Error(msg);
  } catch (err) {
    if (err && err.errMsg && /request:fail/i.test(err.errMsg)) {
      reportRequestError(err, ROUTES[name]);
    }
    if (err && err.diagnosticCode) reportRequestError(err, ROUTES[name]);
    throw err;
  }
}

function rawPost(path, data) { return post(path, data); }

// 仅展示错误分类与接口路径，不展示 code、token、用户数据或原始响应。
let diagnosticOpen = false;
function classifyError(err) {
  if (err && err.diagnosticCode) return err.diagnosticCode;
  const message = String((err && (err.errMsg || err.message)) || '');
  if (/domain list|合法域名/i.test(message)) return 'DOMAIN';
  if (/ssl|tls|certificate|cert error/i.test(message)) return 'TLS';
  if (/timeout|timed out/i.test(message)) return 'TIMEOUT';
  if (/name.not.resolved|dns|resolve host/i.test(message)) return 'DNS';
  if (/login:fail/i.test(message)) return 'WX_LOGIN';
  return 'NETWORK';
}
function reportRequestError(err, path) {
  if (diagnosticOpen) return;
  diagnosticOpen = true;
  const code = classifyError(err);
  const tips = {
    DOMAIN: '微信仍未允许访问接口域名，请核对当前小程序的 request 合法域名。',
    TLS: 'HTTPS 安全连接失败，请检查手机网络及证书兼容性。',
    TIMEOUT: '接口响应超时，请稍后重试。',
    DNS: '手机无法解析接口域名，请切换 Wi-Fi 或移动网络重试。',
    WX_LOGIN: '微信登录凭证获取失败，请重新进入小程序。',
    BAD_RESPONSE: '接口返回格式异常。',
    LOGIN_REJECTED: '服务端未完成登录，请联系开发者排查。',
    NETWORK: '手机未能连接接口，请切换 Wi-Fi 或移动网络重试。'
  };
  wx.showModal({
    title: '连接诊断 N1',
    content: (tips[code] || '服务端请求失败。') + '\n错误编号：' + code + '\n接口：' + (path || 'unknown'),
    showCancel: false,
    complete: () => { diagnosticOpen = false; }
  });
}
module.exports = { call, rawPost, getToken, BASE, classifyError, reportRequestError };
