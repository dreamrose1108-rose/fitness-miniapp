// utils/cloud.js — 云函数调用封装（HTTP 版）
// wx.cloud 无环境授权（-601034），改走 HTTP 网关 + token 鉴权
// DEV_MODE=true 时走本地模拟数据，不调云端（省资源点）
const DEV_MODE = false; // ← 改为 true 启用本地模式
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

// ===== 本地模式模拟数据 =====
const LS_KEY = 'devData:v1';
function ls(action, key, val) {
  try {
    let store = wx.getStorageSync(LS_KEY) || { records: {}, profile: {nickname:'测试用户',height:170,targetWeight:65,dailyCalorieTarget:1800}, chats: [] };
    if (action === 'set') { store[key] = val; wx.setStorageSync(LS_KEY, store); }
    return store[key];
  } catch (e) { return null; }
}
function devCall(name, data = {}) {
  const today = new Date().toISOString().slice(0, 10);
  switch (name) {
    case 'login': return Promise.resolve({ openid: 'dev_user_001', token: 'dev_token' });
    case 'init': return Promise.resolve([{ name: '本地模式', status: 'ready' }]);
    case 'userProfile':
      if (data.action === 'get') return Promise.resolve(ls('get', 'profile'));
      if (data.action === 'update') { const p = Object.assign(ls('get','profile')||{}, data); ls('set','profile',p); return Promise.resolve({updated:true}); }
      return Promise.resolve(null);
    case 'record': return devRecord(data, today);
    case 'foodLib': return devFoodLib(data);
    case 'aiCoach': return devAI(data);
    default: return Promise.resolve({});
  }
}
function devRecord(data, today) {
  const records = ls('get', 'records') || {};
  const myRecords = records[today] || [];
  if (data.action === 'add') {
    myRecords.push(Object.assign({_id: 'dev_' + Date.now(), createdAt: Date.now()}, data.data));
    records[today] = myRecords; ls('set', 'records', records);
    return Promise.resolve({ id: myRecords[myRecords.length-1]._id });
  }
  if (data.action === 'remove') {
    records[today] = myRecords.filter(r => r._id !== data.id);
    ls('set', 'records', records); return Promise.resolve({ removed: 1 });
  }
  if (data.action === 'list') return Promise.resolve(myRecords);
  if (data.action === 'summary') {
    const diet = myRecords.filter(r => r.kcal);
    return Promise.resolve({
      intake: Math.round(diet.reduce((s,r) => s + (r.kcal||0), 0)),
      burned: 0, net: Math.round(diet.reduce((s,r) => s + (r.kcal||0), 0)),
      latestWeight: null, dietCount: diet.length, exerciseCount: 0,
      proteinG: Math.round(diet.reduce((s,r) => s + (r.proteinG||0), 0)),
      carbG: Math.round(diet.reduce((s,r) => s + (r.carbG||0), 0)),
      fatG: Math.round(diet.reduce((s,r) => s + (r.fatG||0), 0))
    });
  }
  if (data.action === 'streak') {
    const days = Object.keys(records).filter(d => (records[d]||[]).length > 0);
    return Promise.resolve({ todayChecked: myRecords.length > 0, streak: days.length, totalDays: days.length, achieved: [], next: 3 });
  }
  if (data.action === 'trend') return Promise.resolve({ intake: [], burned: [], weight: [] });
  return Promise.resolve({});
}
function devFoodLib(data) {
  const FOOD_DB = require('../utils/constants.js').FOOD_DB || [];
  if (data.action === 'search') {
    const kw = (data.keyword || '').toLowerCase();
    return Promise.resolve(FOOD_DB.filter(f => !kw || (f.name||'').toLowerCase().includes(kw)).slice(0, 50));
  }
  return Promise.resolve([]);
}
function devAI(data) {
  const answers = [
    '🐾 本地模式：这是模拟回复，不消耗云端资源。\n\n建议你保持热量缺口300~500千卡，蛋白质每公斤体重1.6~2g，每周训练3~4次。',
    '🐾 本地模式：AI教练回复模拟。\n\n今日数据仅供参考（本地存储），正式使用请关闭DEV_MODE。',
    '🐾 喵～本地模式下我只能说预设的话。\n\n切换 DEV_MODE = false 后我就能查你的真实数据啦！'
  ];
  const answer = answers[Math.floor(Math.random() * answers.length)];
  return Promise.resolve({ answer, chunks: [answer], disclaimer: '本地模式' });
}

// ===== 统一调用入口 =====
async function call(name, data = {}) {
  if (DEV_MODE) return devCall(name, data);
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

function rawPost(path, data) {
  if (DEV_MODE) {
    // 本地模式：login 走模拟
    if (path === '/fit-login') return Promise.resolve({ code: 0, openid: 'dev_user_001', token: 'dev_token' });
    return Promise.resolve({ code: 0, data: {}, msg: 'ok' });
  }
  return post(path, data);
}

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
