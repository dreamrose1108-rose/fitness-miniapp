// pages/trend/trend.js — 数据趋势（原生 canvas 2d 手绘折线图，无需 npm 构建）
const app = getApp();
const { call } = require('../../utils/cloud.js');
const { lastDays, shortLabel, formatDate } = require('../../utils/date.js');

Page({
  data: {
    ranges: [
      { key: 7, label: '近7天' },
      { key: 14, label: '近14天' },
      { key: 30, label: '近30天' }
    ],
    activeRange: 7,
    weightPoints: [],      // [{date, value}]
    intakePoints: [],
    burnedPoints: [],
    hasWeightData: false,
    hasCalorieData: false,
    weightDelta: 0,
    weightText: '',
    avgIntake: 0,
    avgBurned: 0,
    recordDays: 0
  },

  onLoad() { this.days = lastDays(7); },

  async onShow() {if(getApp().applyTheme)getApp().applyTheme(this);
    if (!await app.login()) return;
    await this.loadTrend();
  },

  switchRange(e) {
    this.setData({ activeRange: e.currentTarget.dataset.key }, () => {
      this.days = lastDays(this.data.activeRange);
      this.loadTrend();
    });
  },

  async loadTrend() {
    const version = this._trendVersion = (this._trendVersion || 0) + 1;
    const days = this.days.slice();
    try {
      const start = days[0];
      const end = formatDate();
      const res = await call('record', { action: 'trend', type: 'diet', start, end });

      if (version !== this._trendVersion) return;
      // 归一化为按天序列（缺失补 null，不画点）
      const toSeries = (aggList, valueKey) => days.map(d => {
        const found = aggList.find(x => x._id === d);
        return { date: d, value: found ? found[valueKey] : null };
      });

      const weightSeries = days.map(date => {
        const row = (res.weight || []).find(r => r.date === date);
        return { date, value: row && Number.isFinite(row.weight) ? row.weight : null };
      });
      const measuredWeights = weightSeries.filter(p => p.value != null);
      const intakeSeries = toSeries(res.intake || [], 'kcal');
      const burnedSeries = toSeries(res.burned || [], 'kcal');

      // 区间小结
      const intakeVals = intakeSeries.filter(x => x.value != null).map(x => x.value);
      const burnedVals = burnedSeries.filter(x => x.value != null).map(x => x.value);
      const avgIntake = intakeVals.length ? Math.round(intakeVals.reduce((a, b) => a + b, 0) / intakeVals.length) : 0;
      const avgBurned = burnedVals.length ? Math.round(burnedVals.reduce((a, b) => a + b, 0) / burnedVals.length) : 0;
      const daySet = new Set([...intakeSeries, ...burnedSeries, ...weightSeries].filter(x => x.value != null).map(x => x.date));

      // 体重变化
      let weightDelta = 0, weightText = '--';
      if (measuredWeights.length >= 2) {
        weightDelta = +(measuredWeights[measuredWeights.length - 1].value - measuredWeights[0].value).toFixed(1);
        weightText = weightDelta <= 0 ? `↓ ${Math.abs(weightDelta)} kg` : `↑ ${weightDelta} kg`;
      }

      this.setData({
        hasWeightData: measuredWeights.length > 0,
        hasCalorieData: intakeVals.length > 0 || burnedVals.length > 0,
        weightPoints: weightSeries,
        intakePoints: intakeSeries,
        burnedPoints: burnedSeries,
        weightDelta, weightText,
        avgIntake, avgBurned,
        recordDays: daySet.size
      }, () => {
        this.drawWeightChart(weightSeries);
        this.drawCalorieChart(intakeSeries, burnedSeries);
      });
    } catch (e) {}
  },

  // 获取 canvas 2d 上下文并按 DPR 缩放
  getCanvasCtx(canvasId, callback) {
    const query = wx.createSelectorQuery().in(this);
    query.select('#' + canvasId).fields({ node: true, size: true }).exec((res) => {
      if (!res[0] || !res[0].node) return;
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const dpr = wx.getWindowInfo ? (wx.getWindowInfo().pixelRatio || 2) : 2;
      canvas.width = res[0].width * dpr;
      canvas.height = res[0].height * dpr;
      ctx.scale(dpr, dpr);
      callback(ctx, res[0].width, res[0].height);
    });
  },

  // 绘制折线图通用方法
  drawLine(ctx, W, H, seriesList, colors, opts = {}) {
    const padL = 56, padR = 20, padT = 24, padB = 44;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;
    ctx.clearRect(0, 0, W, H);

    const allValues = [];
    seriesList.forEach(s => s.forEach(p => { if (p.value != null) allValues.push(p.value); }));
    if (allValues.length === 0) return;

    let min = Math.min(...allValues), max = Math.max(...allValues);
    if (opts.weight) {
      const pad = Math.max(1, (max - min) * 0.3);
      min = Math.floor(min - pad); max = Math.ceil(max + pad);
      if (max === min) { max += 1; }
    } else {
      min = 0; max = max * 1.15 || 1;
    }

    const n = this.days.length;
    const xAt = i => padL + (n === 1 ? chartW / 2 : chartW * i / (n - 1));
    const yAt = v => padT + chartH * (1 - (v - min) / (max - min));

    // 网格 + Y 轴刻度
    const palette = require('../../utils/theme').palettes[this.data.theme || 'cat'];
    ctx.strokeStyle = palette.border;
    ctx.fillStyle = palette.secondary;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const rows = 4;
    for (let r = 0; r <= rows; r++) {
      const val = min + (max - min) * r / rows;
      const y = yAt(val);
      ctx.beginPath();
      ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
      ctx.fillText(opts.weight ? val.toFixed(0) : Math.round(val), padL - 10, y);
    }

    // X 轴标签（每隔几个显示，避免拥挤）
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const step = Math.ceil(n / 6);
    this.days.forEach((d, i) => {
      if (i % step === 0 || i === n - 1) {
        ctx.fillText(shortLabel(d), xAt(i), H - padB + 12);
      }
    });

    // 折线
    seriesList.forEach((series, si) => {
      ctx.strokeStyle = colors[si];
      ctx.fillStyle = colors[si];
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      let started = false;
      series.forEach((p, i) => {
        if (p.value == null) { started = false; return; }
        const x = xAt(i), y = yAt(p.value);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      // 数据点
      series.forEach((p, i) => {
        if (p.value == null) return;
        ctx.beginPath();
        ctx.arc(xAt(i), yAt(p.value), 3.5, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  },

  drawWeightChart(series) {
    this.getCanvasCtx('weightChart', (ctx, W, H) => {
      this.drawLine(ctx, W, H, [series], ['#2e7d5b'], { weight: true });
    });
  },

  drawCalorieChart(intake, burned) {
    this.getCanvasCtx('calorieChart', (ctx, W, H) => {
      this.drawLine(ctx, W, H, [intake, burned], ['#5b9e7d', '#f0a13c']);
    });
  }
});
