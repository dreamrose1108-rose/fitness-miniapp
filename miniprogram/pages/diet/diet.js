// pages/diet/diet.js — 饮食记录（云端食物库 + 离线降级 + 自定义食物）
const app = getApp();
const { uploadPhoto, readPhoto, deletePhoto } = require('../../utils/photos.js');
const { call } = require('../../utils/cloud.js');
const { formatDate } = require('../../utils/date.js');
const { FOOD_DB, FOOD_CATEGORIES, MEAL_TYPES } = require('../../utils/constants.js');

Page({
  data: {
    mealTypes: MEAL_TYPES,
    activeMeal: 'breakfast',
    activeMealLabel: '早餐',
    allRecords: [],
    currentList: [],
    totalIntake: 0,
    target: 1800,
    remain: 1800,
    progressPercent: 0,
    // 弹层
    showPicker: false,
    categories: FOOD_CATEGORIES,
    activeCat: '全部',
    keyword: '',
    filteredFoods: [],
    cloudFoods: [],        // 云端拉取的食物（官方+自定义）
    usingLocalDb: false,   // 云端不可用时降级内置库
    photoUploading: false,
    pendingPhoto: '',      // 待绑定到记录的餐拍照片 fileID
    // 自定义食物表单
    showCustomForm: false,
    cfCats: ['主食', '蛋白', '果蔬', '饮品', '脂肪', '快餐', '其他'],
    cfCatIndex: 6,
    cfName: '',
    cfKcal: '',
    cfSubmitting: false
  },

  async onShow() {
    if (!await app.login()) return;
    await Promise.all([this.loadRecords(), this.loadTarget(), this.loadCloudFoods()]);
  },

  async loadTarget() {
    try {
      const p = await call('userProfile', { action: 'get' });
      if (p) this.setData({ target: p.dailyCalorieTarget || 1800 }, this.updateSummary);
    } catch (e) {}
  },

  async loadRecords() {
    try {
      const today = formatDate();
      const list = await call('record', {
        action: 'list', type: 'diet', start: today, end: today, limit: 100
      });
      const labelMap = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' };
      const decorated = list.map(r => ({ ...r, mealLabel: labelMap[r.mealType] || '' }));
      this.setData({ allRecords: decorated }, this.updateSummary);
      for (const row of decorated.filter(r => r.photoFileID)) {
        try { const photoSrc = await readPhoto(row.photoFileID);
          const records = this.data.allRecords.map(r => r._id === row._id ? Object.assign({}, r, { photoSrc }) : r);
          this.setData({ allRecords: records }, this.updateSummary);
        } catch (e) { /* 单张照片失败不阻塞其他记录 */ }
      }
    } catch (e) {}
  },

  // 拉取云端食物库；失败则降级本地内置库
  async loadCloudFoods() {
    try {
      const foods = await call('foodLib', { action: 'search', keyword: '', cat: '全部', limit: 100 });
      this.setData({ cloudFoods: foods || [], usingLocalDb: false }, this.filterFoods);
    } catch (e) {
      this.setData({ usingLocalDb: true }, this.filterFoods);
    }
  },

  // 当前生效的食物源
  activeFoodSource() {
    return this.data.usingLocalDb ? FOOD_DB : this.data.cloudFoods;
  },

  updateSummary() {
    const total = this.data.allRecords.reduce((s, r) => s + (r.kcal || 0), 0);
    const currentList = this.data.allRecords.filter(r => r.mealType === this.data.activeMeal);
    const remain = this.data.target - total;
    const percent = this.data.target > 0 ? Math.min(100, Math.round(total / this.data.target * 100)) : 0;
    this.setData({
      totalIntake: Math.round(total),
      currentList,
      remain,
      progressPercent: percent
    });
  },

  switchMeal(e) {
    const key = e.currentTarget.dataset.key;
    const meal = this.data.mealTypes.find(m => m.key === key);
    this.setData({ activeMeal: key, activeMealLabel: meal.label }, this.updateSummary);
  },

  // 打开选择器：优先用已缓存的云端数据，未拉到则现场降级
  openPicker() {
    if (this.data.cloudFoods.length === 0 && !this.data.usingLocalDb) {
      this.setData({ usingLocalDb: true });
    }
    this.setData({ showPicker: true, keyword: '', activeCat: '全部' }, this.filterFoods);
  },
  closePicker() {
    if (this._foodSelectionBusy) return;
    this.cancelFoodSearch();
    this.setData({ showPicker: false });
    // 关闭选择器且照片未落库：清理孤儿照片
    if (this.data.pendingPhoto) this.clearPendingPhoto();
  },
  switchCat(e) {
    this.setData({ activeCat: e.currentTarget.dataset.cat }, this.filterFoods);
  },
  onSearch(e) {
    this.setData({ keyword: e.detail.value }, this.filterFoods);
  },

  // 云端模式：条件由云函数处理；本地模式：前端过滤
  cancelFoodSearch() {
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this._searchVersion = (this._searchVersion || 0) + 1;
  },

  async filterFoods() {
    this.cancelFoodSearch();
    const searchVersion = this._searchVersion;
    const { activeCat, keyword, usingLocalDb } = this.data;
    if (usingLocalDb) {
      const list = FOOD_DB.filter(f => {
        const catOk = activeCat === '全部' || f.cat === activeCat;
        const kwOk = !keyword || f.name.indexOf(keyword) >= 0;
        return catOk && kwOk;
      });
      this.setData({ filteredFoods: list });
      return;
    }
    // 云端模式：先用已加载列表本地过滤（即时反馈），再云端查询修正全库结果
    const local = (this.data.cloudFoods || []).filter(f => {
      const catOk = activeCat === '全部' || f.cat === activeCat;
      const kwOk = !keyword || (f.name || '').indexOf(keyword) >= 0;
      return catOk && kwOk;
    });
    this.setData({ filteredFoods: local.slice(0, 100) });
    this._searchTimer = setTimeout(async () => {
      try {
        const list = await call('foodLib', { action: 'search', keyword, cat: activeCat, limit: 100 });
        // 响应到达时关键词已变 → 丢弃（防串台）
        if (this._unloaded || this._searchVersion !== searchVersion) return;
        this.setData({ filteredFoods: list || [] });
      } catch (e) {
        // 云端失败：保留上面的本地过滤结果，不清空列表
      }
    }, 300);
  },

  // ===== 拍照记录 =====
  // 拍照 → 选食物 → 输分量 → 提交时一起落库；取消则删除已传照片（防孤儿文件）
  async onTakePhoto() {
    if (this._foodSelectionBusy || this.data.photoUploading) return;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'], // 压缩图，控制云存储占用（E-10）
      success: async (res) => {
        const tempPath = res.tempFiles[0].tempFilePath;
        this.setData({ photoUploading: true });
        wx.showLoading({ title: '上传照片中' });
        try {
          let filePath = tempPath;
          if (typeof wx.compressImage === 'function') {
            try { const compressed = await wx.compressImage({ src: tempPath, quality: 40 }); filePath = compressed.tempFilePath; } catch (e) {}
          }
          if (this.data.pendingPhoto && !await this.clearPendingPhoto()) return;
          const up = await uploadPhoto(filePath);
          if (this._unloaded) { await deletePhoto(up.fileID); return; }
          this.setData({ pendingPhoto: up.fileID });
          wx.showToast({ title: '照片就绪，请选食物', icon: 'none' });
          this.openPicker();
        } catch (e) {
          wx.showToast({ title: e.message || '照片上传失败', icon: 'none' });
        } finally {
          wx.hideLoading();
          if (!this._unloaded) this.setData({ photoUploading: false });
        }
      }
    });
  },

  // 简单路径标识（云存储目录用，非身份信息）
  _uid() {
    if (!this._uidCache) {
      this._uidCache = Math.random().toString(36).slice(2, 10);
    }
    return this._uidCache;
  },

  // 清除待绑定照片（未落库则删云存储文件）
  async clearPendingPhoto(isDeleteFile = true) {
    if (this._foodSelectionBusy) return;
    const fid = this.data.pendingPhoto;
    try {
      if (fid && isDeleteFile) await deletePhoto(fid);
      if (this.data.pendingPhoto === fid) this.setData({ pendingPhoto: '' });
      return true;
    } catch (e) {
      wx.showToast({ title: '照片清理失败，请稍后重试', icon: 'none' });
      return false;
    }
  },

  // 选中食物 → 输入分量 → 计算热量（含照片绑定）
  selectFood(e) {
    if (this._foodSelectionBusy) return;
    this._foodSelectionBusy = true;
    const food = e.currentTarget.dataset.food;
    const mealType = this.data.activeMeal;
    const date = formatDate();
    const isLiquid = food.unit === '100ml';
    wx.showModal({
      title: food.name,
      content: '',
      editable: true,
      placeholderText: `请输入分量(${isLiquid ? 'ml' : 'g'})`,
      success: async (res) => {
        if (!res.confirm) { this._foodSelectionBusy = false; return; }
        if (!res.content) {
          this._foodSelectionBusy = false;
          // 确认但没输入分量：视为取消，清理照片
          this.clearPendingPhoto();
          return;
        }
        const amount = Number(res.content);
        if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(food.kcal * amount / 100)) {
          this._foodSelectionBusy = false;
          wx.showToast({ title: '请输入有效分量', icon: 'none' });
          this.clearPendingPhoto();
          return;
        }
        // kcal 表中按 100g/100ml 计，实际 = kcal × 分量/100
        const kcal = Math.round(food.kcal * amount / 100);
        // 三大营养素（克）= 食物每100g含量 × 分量/100；无数据时不写（汇总按 0 计）
        const macro = {};
        [['protein', 'proteinG'], ['carb', 'carbG'], ['fat', 'fatG']].forEach(([src, dst]) => {
          if (food[src] !== undefined && food[src] !== null && Number.isFinite(Number(food[src]))) {
            macro[dst] = Math.round(Number(food[src]) * amount) / 100;
          }
        });
        try {
          await call('record', {
            action: 'add', type: 'diet',
            data: Object.assign({
              date,
              mealType,
              foodName: food.name,
              amount,
              kcal,
              photoFileID: this.data.pendingPhoto || ''
            }, macro)
          });
          wx.showToast({ title: '已添加' });
          this.setData({ pendingPhoto: '' }); // 已落库，照片归属记录，不再清理
          this._foodSelectionBusy = false;
          this.closePicker();
          this.loadRecords();
          // 异步回传使用热度（失败不打扰用户）
          if (food._id) {
            call('foodLib', { action: 'used', foodId: food._id }).catch(() => {});
          }
        } catch (err) {
          this._foodSelectionBusy = false;
          this.clearPendingPhoto();
        }
      },
      fail: () => {
        this._foodSelectionBusy = false;
        // 弹层被中断：清理待绑定照片
        this.clearPendingPhoto();
      }
    });
  },

  // 预览餐拍照片
  async previewPhoto(e) {
    try { const url = await readPhoto(e.currentTarget.dataset.fileid); wx.previewImage({ urls: [url] }); }
    catch (e) { wx.showToast({ title: '图片加载失败', icon: 'none' }); }
  },

  async onDelete(e) {
    const id = e.currentTarget.dataset.id;
    const record = this.data.allRecords.find(r => r._id === id);
    const confirm = await new Promise(resolve => {
      wx.showModal({ title: '删除记录', content: '确定删除这条记录吗？', success: r => resolve(r.confirm) });
    });
    if (!confirm) return;
    try {
      await call('record', { action: 'remove', type: 'diet', id });
      // 顺带清理该记录绑定的照片（失败不影响删除结果）
      if (record && record.photoFileID) {
        await deletePhoto(record.photoFileID).catch(() => { wx.showToast({ title: '记录已删除，照片清理失败', icon: 'none' }); });
      }
      wx.showToast({ title: '已删除' });
      this.loadRecords();
    } catch (err) {}
  },

  // ===== 自定义食物 =====
  openCustomForm() {
    // 离线模式下不支持自定义（依赖云端存储）
    if (this.data.usingLocalDb) {
      wx.showToast({ title: '离线模式暂不支持自定义食物', icon: 'none' });
      return;
    }
    this.setData({ showCustomForm: true, cfName: '', cfKcal: '', cfCatIndex: 6 });
  },
  closeCustomForm() { this.setData({ showCustomForm: false }); },
  onCfName(e) { this.setData({ cfName: e.detail.value }); },
  onCfKcal(e) { this.setData({ cfKcal: e.detail.value }); },
  onCfCat(e) { this.setData({ cfCatIndex: Number(e.detail.value) }); },

  async submitCustom() {
    if (this.data.cfSubmitting) return;
    const name = (this.data.cfName || '').trim();
    const kcal = Number(this.data.cfKcal);
    if (!name) { wx.showToast({ title: '请输入名称', icon: 'none' }); return; }
    if (!Number.isFinite(kcal) || kcal <= 0) { wx.showToast({ title: '请输入有效热量', icon: 'none' }); return; }
    this.setData({ cfSubmitting: true });
    try {
      await call('foodLib', {
        action: 'addCustom',
        name,
        cat: this.data.cfCats[this.data.cfCatIndex],
        kcal
      });
      wx.showToast({ title: '已添加' });
      this.setData({ showCustomForm: false });
      this.loadCloudFoods(); // 刷新列表，自定义排最前
    } catch (e) {} finally {
      this.setData({ cfSubmitting: false });
    }
  },

  onUnload() {
    this._unloaded = true;
    if (!this._foodSelectionBusy && this.data.pendingPhoto) this.clearPendingPhoto();
    this.cancelFoodSearch();
  }
});
