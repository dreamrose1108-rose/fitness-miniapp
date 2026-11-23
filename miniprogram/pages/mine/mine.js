// pages/mine/mine.js — 我的：目标设置与隐私
const app = getApp();
const { call } = require('../../utils/cloud.js');

Page({
  data: { profile: {} },

  async onShow() {if(getApp().applyTheme)getApp().applyTheme(this);
    if (!await app.login()) return;
    await this.loadProfile();
  },

  async loadProfile() {
    try {
      const p = await call('userProfile', { action: 'get' });
      this.setData({ profile: p || {} });
    } catch (e) {}
  },

  // 编辑目标字段
  editField(e) {
    const { field, label } = e.currentTarget.dataset;
    wx.showModal({
      title: '修改' + label,
      content: '',
      editable: true,
      placeholderText: String(this.data.profile[field] || ''),
      success: async (res) => {
        if (!res.confirm || !res.content) return;
        const isNum = field !== 'nickname';
        const value = isNum ? Number(res.content) : res.content.trim();
        if (isNum && (!Number.isFinite(value) || value <= 0)) {
          wx.showToast({ title: '请输入有效数字', icon: 'none' });
          return;
        }
        if (!isNum && !value) { wx.showToast({ title: '请输入昵称', icon: 'none' }); return; }
        try {
          const saved = await call('userProfile', { action: 'update', [field]: value });
          if (!saved || saved.updated !== true) { wx.showToast({ title: '资料未保存，请重试', icon: 'none' }); return; }
          wx.showToast({ title: '已保存' });
          this.loadProfile();
        } catch (err) {}
      }
    });
  },

  openPrivacyContract() {
    // 打开隐私保护指引（基础库版本要求以官方文档核实）
    if (typeof wx.openPrivacyContract === 'function') {
      wx.openPrivacyContract({});
    } else {
      wx.showToast({ title: '请在小程序设置中查看', icon: 'none' });
    }
  },

  showPrivacyTip() {
    wx.showModal({
      title: '隐私说明',
      content: '本小程序收集体重、饮食、运动等健康数据，仅用于为你提供记录与趋势分析服务。数据保存在云端，仅你本人可见。你可在小程序设置中管理授权。',
      showCancel: false
    });
  }
});
