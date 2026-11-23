// app.js
const { rawPost, reportRequestError } = require('./utils/cloud.js');

App({
  applyTheme(page) { require('./utils/theme').apply(page); },
  globalData: {
    openid: null,
    userInfo: null,
    privacyAgreed: false
  },

  onLaunch() {
    this.checkPrivacy();
  },

  // 隐私协议检查：健康类数据属敏感个人信息，须先完成授权
  checkPrivacy() {
    if (typeof wx.getPrivacySetting !== 'function') {
      this.globalData.privacyAgreed = true;
      return;
    }
    wx.getPrivacySetting({
      success: (res) => {
        this.globalData.privacyAgreed = !res.needAuthorization;
      },
      fail: () => {
        this.globalData.privacyAgreed = true;
      }
    });
  },

  // 静默登录：wx.login 拿一次性 code → HTTP 换 openid + token
  // 前端不存 session_key；token 存本地，30 天有效，过期后自动重登
  async login() {
    if (this.globalData.openid) return this.globalData.openid;
    try {
      const codeRes = await new Promise((ok, no) => wx.login({ success: ok, fail: no }));
      if (!codeRes.code) throw new Error('wx.login 未返回 code');
      const r = await rawPost('/fit-login', { code: codeRes.code });
      if (r && r.code === 0 && r.openid) {
        this.globalData.openid = r.openid;
        try { wx.setStorageSync('fitToken', r.token); } catch (e) {}
        return r.openid;
      }
      reportRequestError({ diagnosticCode: 'LOGIN_REJECTED' }, '/fit-login');
      return null;
    } catch (err) {
      reportRequestError(err, '/fit-login');
      return null;
    }
  }
});
