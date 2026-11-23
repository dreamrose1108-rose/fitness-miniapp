// pages/index/index.js — 首页：今日概览
const app = getApp();
const { call } = require('../../utils/cloud.js');
const { formatDate } = require('../../utils/date.js');
const schedule = require('../../utils/training-schedule.js');
const library = require('../../utils/exercise-library.js');

Page({
  data: {
    todayLabel: '',
    summary: { intake: 0, burned: 0, net: 0, latestWeight: null },
    target: 1800,
    intakePercent: 0,
    userInfo: {},
    streak: { todayChecked: false, streak: 0, totalDays: 0, achieved: [], next: null },
    todayTraining: null
  },

  async onLoad() {
    const d = new Date();
    const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    this.setData({ todayLabel: `${d.getMonth() + 1}月${d.getDate()}日 星期${week}` });
  },

  async onShow() {
    if (!await app.login()) return;
    await Promise.all([this.loadProfile(), this.loadSummary(), this.loadStreak(), this.loadTodayTraining()]);
  },

  // 今日训练安排
  loadTodayTraining() {
    try {
      const today = formatDate();
      const entry = schedule.read().find(x => x.date === today);
      if (!entry) { this.setData({ todayTraining: null }); return; }
      const doneCount = Object.values(entry.done || {}).filter(Boolean).length;
      this.setData({
        todayTraining: {
          title: entry.title,
          planTitle: entry.planTitle,
          sourceKey: entry.sourceKey,
          total: entry.exercises.length,
          done: doneCount,
          names: entry.exercises.map(x => (library.get(x.id) || {}).displayName || x.name || x.id).slice(0, 4),
          more: Math.max(0, entry.exercises.length - 4),
          complete: doneCount >= entry.exercises.length && entry.exercises.length > 0
        }
      });
    } catch (e) {
      this.setData({ todayTraining: null });
    }
  },

  goTraining() {
    wx.navigateTo({ url: '/pages/today-training/today-training' });
  },

  // 打卡统计（饮食/运动/体重任一记录即算打卡）
  async loadStreak() {
    try {
      const streak = await call('record', { action: 'streak', type: 'diet' });
      this.setData({ streak });
    } catch (e) { /* 已提示 */ }
  },

  async loadProfile() {
    try {
      const profile = await call('userProfile', { action: 'get' });
      if (profile) {
        this.setData({
          target: profile.dailyCalorieTarget || 1800,
          userInfo: { nickname: profile.nickname }
        });
      }
    } catch (e) { /* 已由 call 提示 */ }
  },

  async loadSummary() {
    try {
      const summary = await call('record', { action: 'summary', type: 'diet', date: formatDate() });
      const percent = this.data.target > 0
        ? Math.min(100, Math.round((summary.intake / this.data.target) * 100)) : 0;
      this.setData({ summary, intakePercent: percent });
    } catch (e) { /* 已由 call 提示 */ }
  },

  onRecordWeight() {
    wx.showModal({
      title: '记录体重',
      content: '',
      editable: true,
      placeholderText: '请输入今日体重(kg)',
      success: async (res) => {
        if (!res.confirm || !res.content) return;
        const weight = Number(res.content);
        if (!Number.isFinite(weight) || weight <= 0) {
          wx.showToast({ title: '请输入有效数字', icon: 'none' });
          return;
        }
        try {
          await call('record', {
            action: 'add', type: 'body',
            data: { date: formatDate(), weight }
          });
          wx.showToast({ title: '已记录' });
          this.loadSummary();
          this.loadStreak();
        } catch (e) { /* 已提示 */ }
      }
    });
  },

  goDiet() { wx.switchTab({ url: '/pages/diet/diet' }); },
  goExercise() { wx.switchTab({ url: '/pages/exercise/exercise' }); },
  goTrend() { wx.switchTab({ url: '/pages/trend/trend' }); },
  goCoach() { wx.switchTab({ url: '/pages/coach/coach' }); },
  goMine() { wx.navigateTo({ url: '/pages/mine/mine' }); }
});
