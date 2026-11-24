const feedback=require('../../utils/feedback');
// pages/exercise/exercise.js — 运动记录
const app = getApp();
const { call } = require('../../utils/cloud.js');
const { formatDate } = require('../../utils/date.js');
const { EXERCISE_DB } = require('../../utils/constants.js');

Page({
  data: {
    exercises: EXERCISE_DB,
    selected: null,
    duration: 30,
    estimatedKcal: 0,
    manualKcal: '',
    weight: 65,
    weightIsDefault: true,
    todayList: [],
    totalBurned: 0,
    submitting: false
  },

  async onShow() {if(getApp().applyTheme)getApp().applyTheme(this);
    const pending = app.globalData && app.globalData.pendingExerciseId;
    if (pending) {
      const item = require('../../utils/exercise-library.js').get(pending);
      app.globalData.pendingExerciseId = null;
      if (item) this.setData({ selected: { id: item.id, name: item.displayName, library: true }, manualKcal: '', estimatedKcal: 0 });
    }
    if (!await app.login()) return;
    await Promise.all([this.loadWeight(), this.loadRecords()]);
  },

  async loadWeight() {
    try {
      const summary = await call('record', { action: 'summary', type: 'diet', date: formatDate() });
      const measured = summary && Number(summary.latestWeight);
      const valid = Number.isFinite(measured) && measured > 0;
      this.setData({ weight: valid ? measured : 65, weightIsDefault: !valid }, this.calcEstimate);
    } catch (e) {}
  },

  async loadRecords() {
    try {
      const today = formatDate();
      const list = await call('record', {
        action: 'list', type: 'exercise', start: today, end: today, limit: 100
      });
      const iconMap = {};
      EXERCISE_DB.forEach(e => { iconMap[e.name] = e.icon; });
      const decorated = list.map(r => ({ ...r, icon: iconMap[r.name] || '🏃' }));
      const total = decorated.reduce((s, r) => s + (r.kcalBurned || 0), 0);
      this.setData({ todayList: decorated, totalBurned: Math.round(total) });
    } catch (e) {}
  },

  selectExercise(e) {
    if (this.data.submitting) return;
    this.setData({ selected: e.currentTarget.dataset.item, manualKcal: '' }, this.calcEstimate);
  },

  onDuration(e) {
    if (this.data.submitting) return;
    this.setData({ duration: Number(e.detail.value) || 0 }, this.calcEstimate);
  },

  // 消耗 = MET × 体重kg × 时长(小时)
  calcEstimate() {
    const { selected, duration, weight } = this.data;
    const kcal = selected && selected.library ? Number(this.data.manualKcal || 0) : selected ? Math.round(selected.met * weight * (duration / 60)) : 0;
    this.setData({ estimatedKcal: kcal });
  },
  onManualKcal(e) { if (!this.data.submitting) this.setData({ manualKcal: e.detail.value }, this.calcEstimate); },

  async onSubmit() {
    if (this.data.submitting) return;
    if (!this.data.selected || !Number.isFinite(this.data.duration) || this.data.duration <= 0 || !Number.isFinite(this.data.estimatedKcal) || this.data.estimatedKcal < 0) { feedback.error('请选择运动并填写有效时长与消耗'); return; }
    this.setData({ submitting: true });
    try {
      await call('record', {
        action: 'add', type: 'exercise',
        data: {
          date: formatDate(),
          name: this.data.selected.name,
          ...(this.data.selected.library ? { exerciseId: this.data.selected.id, calorieSource: String(this.data.manualKcal).trim() === '' ? 'unprovided' : 'manual' } : { met: this.data.selected.met }),
          duration: this.data.duration,
          kcalBurned: this.data.estimatedKcal
        }
      });
      wx.showToast({ title: '已记录' });
      this.setData({ selected: null, duration: 30, estimatedKcal: 0, manualKcal: '' });
      this.loadRecords();
    } catch (e) {} finally {
      this.setData({ submitting: false });
    }
  },

  async onDelete(e) {
    const id = e.currentTarget.dataset.id;
    const confirm = await new Promise(resolve => {
      wx.showModal({ title: '删除记录', content: '确定删除这条记录吗？', success: r => resolve(r.confirm) });
    });
    if (!confirm) return;
    try {
      await call('record', { action: 'remove', type: 'exercise', id });
      wx.showToast({ title: '已删除' });
      this.loadRecords();
    } catch (err) {}
  }
});
