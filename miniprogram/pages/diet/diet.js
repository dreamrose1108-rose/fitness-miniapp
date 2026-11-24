// pages/diet/diet.js — 饮食记录（云端食物库 + 离线降级 + 自定义食物）
const app = getApp();
const foodCatalog = require('../../utils/food-catalog/index.js');
const nutritionPlan = require('../../utils/nutrition-plan');
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
    viewDate: '',
    viewDateLabel: '今天',
    totalIntake: 0,
    target: 1800,
    nutritionTargets: null,
    targetLabel: '',
    remain: 1800,
    progressPercent: 0,
    // 弹层
    showPicker: false,
    categories: FOOD_CATEGORIES,
    activeCat: '全部',
    keyword: '',
    filteredFoods: [],
    foodTotal: foodCatalog.foods.length,
    filteredTotal: 0,
    foodVisible: 100,
    foodVersion: foodCatalog.meta.version,
    cloudFoods: [],        // 云端拉取的食物（官方+自定义）
    usingLocalDb: false,   // 云端不可用时降级内置库
    aiSearching: false,
    aiResult: null,
    aiSaving: false,
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

  async onShow() {if(getApp().applyTheme)getApp().applyTheme(this);
    if (!await app.login()) return;
    await Promise.all([this.loadRecords(), this.loadTarget(), this.loadCloudFoods()]);
  },

  async loadTarget() {
    try {
      const p = await call('userProfile', { action: 'get' });
      const weekly = nutritionPlan.activeDay(this.data.viewDate || formatDate());
      const current = weekly ? {dailyCalorieTarget:weekly.calories,proteinTarget:weekly.protein,carbTarget:weekly.carb,fatTarget:weekly.fat} : p;
      if (current) { const p = current; this.setData({targetLabel:weekly?'5:2 · '+weekly.type:'', target: p.dailyCalorieTarget || 1800, nutritionTargets: p.proteinTarget != null && p.carbTarget != null && p.fatTarget != null ? {protein:p.proteinTarget,carb:p.carbTarget,fat:p.fatTarget} : null }, this.updateSummary); }
    } catch (e) {}
  },

  async loadRecords() {
    try {
      const date = this.data.viewDate || formatDate();
      const list = await call('record', {
        action: 'list', type: 'diet', start: date, end: date, limit: 100
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
    const owner = (app.globalData || {}).openid || '';
    const cacheKey = 'foodCatalog:v1:' + owner;
    const request = this._catalogRequest = (this._catalogRequest || 0) + 1;
    let cached = [];
    if (owner) try { const saved = wx.getStorageSync(cacheKey); if (saved && Array.isArray(saved.foods)) cached = saved.foods; } catch (e) {}
    this.setData({cloudFoods: foodCatalog.merge(cached), usingLocalDb: true}, this.filterFoods);
    try {
      const snapshot = await call('foodLib', { action: 'catalog' });
      if (this._unloaded || this._catalogRequest !== request || ((app.globalData || {}).openid || '') !== owner) return;
      if (!snapshot || !Array.isArray(snapshot.foods)) throw Error('invalid food catalog');
      const foods = foodCatalog.merge(snapshot.foods, snapshot.available === false ? foodCatalog.merge(cached) : FOOD_DB);
      this.setData({cloudFoods: foods, usingLocalDb: snapshot.available === false, foodVersion: snapshot.version || foodCatalog.meta.version}, this.filterFoods);
      if (owner && snapshot.available !== false) try { wx.setStorageSync(cacheKey, {version:snapshot.version,foods}); } catch (e) { /* 缓存满不影响当前查询 */ }
    } catch (e) { /* 保留当前账号缓存与完整内置库 */ }
  },

  activeFoodSource() {
    return this.data.cloudFoods.length ? this.data.cloudFoods : FOOD_DB;
  },
  showFoodSource() {
    wx.showModal({title:'食物数据来源',content:'公共库含食药署2015版食品营养数据（历史版，非最新版）和原有云端参考值。数据按每100g可食部分整理，饮品以条目单位为准。实际品牌、品种和烹调方法可能不同。\n来源：卫生福利部食品药物管理署；政府资料开放授权条款第1版。',confirmText:'复制来源',success:r=>{if(r.confirm)wx.setClipboardData({data:'https://data.gov.tw/dataset/8543\nhttps://data.gov.tw/license'});}});
  },
  loadMoreFoods() { this.setData({foodVisible:this.data.foodVisible+100}); this.filterFoods(true); },

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
    this.setData({ showPicker: true, keyword: '', activeCat: '全部', aiResult: null, aiSearching: false }, this.filterFoods);
  },

  // AI 联网查询食物热量
  async aiFoodSearch() {
    const kw = this.data.keyword.trim();
    if (!kw) return;
    this.setData({ aiSearching: true, aiResult: null });
    try {
      const res = await call('aiCoach', {
        question: `联网搜索：「${kw}」每100克（或100毫升）的热量是多少千卡？同时查蛋白质、碳水、脂肪（克）。只返回数据，格式：名称|热量kcal|蛋白质g|碳水g|脂肪g|单位（100g或100ml），用竖线分隔，不要解释。`
      });
      const answer = res && res.answer || '';
      // 解析 AI 回答中的竖线分隔数据
      const m = answer.match(/([^|\n]+)\|(\d+)[^0-9]*\|([\d.]+)[^0-9]*\|([\d.]+)[^0-9]*\|([\d.]+)[^0-9]*\|(100g|100ml)/);
      if (m) {
        this.setData({
          aiSearching: false,
          aiResult: { name: m[1].trim(), kcal: Number(m[2]), protein: Number(m[3]), carb: Number(m[4]), fat: Number(m[5]), unit: m[6] }
        });
      } else {
        // 尝试从回答中提取数字
        const kcal = answer.match(/(\d{2,4})\s*(?:千卡|kcal|大卡)/i);
        if (kcal) {
          this.setData({
            aiSearching: false,
            aiResult: { name: kw, kcal: Number(kcal[1]), protein: null, carb: null, fat: null, unit: '100g', raw: answer.slice(0, 200) }
          });
        } else {
          wx.showToast({ title: 'AI 未能查到热量数据', icon: 'none' });
          this.setData({ aiSearching: false });
        }
      }
    } catch (e) {
      this.setData({ aiSearching: false });
      wx.showToast({ title: '查询失败，请重试', icon: 'none' });
    }
  },

  async saveAiFood() {
    const r = this.data.aiResult;
    if (!r || this.data.aiSaving) return;
    this.setData({ aiSaving: true });
    try {
      await call('foodLib', {
        action: 'addCustom',
        name: r.name,
        cat: '其他',
        kcal: r.kcal,
        unit: r.unit,
        protein: r.protein || undefined,
        carb: r.carb || undefined,
        fat: r.fat || undefined
      });
      wx.showToast({ title: '已保存到食物库 🐾' });
      this.setData({ aiResult: null, aiSaving: false });
      this.loadCloudFoods(); // 刷新列表
    } catch (e) {
      this.setData({ aiSaving: false });
      wx.showToast({ title: e.message || '保存失败', icon: 'none' });
    }
  },

  clearAiResult() {
    this.setData({ aiResult: null });
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

  filterFoods(keepPage) {
    this.cancelFoodSearch();
    const limit = keepPage === true ? this.data.foodVisible : 100;
    const foods = this.activeFoodSource();
    const result = foodCatalog.search(foods, this.data.keyword, this.data.activeCat, limit);
    this.setData({filteredFoods:result.foods,filteredTotal:result.total,foodTotal:foods.length,foodVisible:limit});
  },

  // ===== 拍照记录 =====
  // 拍照 → AI 估算 → 用户核对 → 保存；取消则清理未绑定照片。
  async onTakePhoto() {
    if (this._foodSelectionBusy || this.data.photoUploading) return;
    const photoContext={date:formatDate(),mealType:this.data.activeMeal};
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
          const filePath = tempPath;
          if (this.data.pendingPhoto && !await this.clearPendingPhoto()) return;
          const up = await uploadPhoto(filePath);
          if (this._unloaded) { await deletePhoto(up.fileID); return; }
          this.setData({ pendingPhoto: up.fileID });
          app.globalData.pendingMealPhoto={...photoContext,fileID:up.fileID,localPath:filePath};
          wx.navigateTo({url:'/pages/meal-review/meal-review',success:()=>this.setData({pendingPhoto:''}),fail:()=>{delete app.globalData.pendingMealPhoto;this.clearPendingPhoto();wx.showToast({title:'无法打开识别页面，请重试',icon:'none'});}});
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
        // 兼容用户输入"30克""30g""30 克"等带单位写法，提取纯数字
        const amountStr = String(res.content).replace(/[克gGkK\s,，。．]/g, '');
        const amount = Number(amountStr);
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

  // ===== 日期切换 =====
  onDateChange(e) {
    const date = e.detail.value;
    const today = formatDate();
    const d = new Date(date + 'T12:00:00');
    const week = ['日','一','二','三','四','五','六'][d.getDay()];
    const label = date === today ? '今天' : `${d.getMonth()+1}月${d.getDate()}日 周${week}`;
    this.setData({ viewDate: date, viewDateLabel: label }, () => Promise.all([this.loadRecords(),this.loadTarget()]));
  },
  goToday() {
    this.setData({ viewDate: '', viewDateLabel: '今天' }, () => Promise.all([this.loadRecords(),this.loadTarget()]));
  },

  // ===== 编辑记录分量 =====
  onEditRecord(e) {
    const id = e.currentTarget.dataset.id;
    const record = this.data.allRecords.find(r => r._id === id);
    if (!record) return;
    wx.showModal({
      title: `修改「${record.foodName}」`,
      content: '',
      editable: true,
      placeholderText: `当前 ${record.amount}g，输入新分量(g)`,
      success: async res => {
        if (!res.confirm || !res.content) return;
        const newAmount = Number(String(res.content).replace(/[克gG\s]/g, ''));
        if (!Number.isFinite(newAmount) || newAmount <= 0) {
          wx.showToast({ title: '请输入有效分量', icon: 'none' });
          return;
        }
        try {
          // 删旧记录 + 添加新记录（后端无 update，用替换方式）
          await call('record', { action: 'remove', type: 'diet', id });
          const newKcal = Math.round(record.kcal * newAmount / record.amount);
          await call('record', {
            action: 'add', type: 'diet',
            data: {
              date: record.date,
              mealType: record.mealType,
              foodName: record.foodName,
              amount: newAmount,
              kcal: newKcal,
              photoFileID: record.photoFileID || ''
            }
          });
          wx.showToast({ title: '已修改 🐾' });
          this.loadRecords();
        } catch (err) {
          wx.showToast({ title: '修改失败', icon: 'none' });
        }
      }
    });
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
