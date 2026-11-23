// pages/coach/coach.js — AI 教练对话（打字机流式渲染）
const app = getApp();
const { call } = require('../../utils/cloud.js');

let msgSeq = 0;

// Markdown 兜底清洗：气泡是纯文本，AI 若输出 Markdown 语法则转成友好纯文本
function fmtContent(raw) {
  return String(raw || '')
    .replace(/\r/g, '')
    .split('\n').map(l =>
      l
        .replace(/^\s*#{1,6}\s*/, '')        // # 标题 → 纯文字
        .replace(/\*\*(.+?)\*\*/g, '$1')     // **粗体** → 纯文字
        .replace(/^\s*[-*+]\s+/, '🐾 ')      // 列表项 → 猫爪
        .replace(/^\s*>\s?/, '')              // 引用符
        .replace(/\|/g, ' ')                  // 表格竖线 → 空格
        .replace(/`/g, '')
    ).join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

function searchMeta(res={}) {
  const sources=(Array.isArray(res.sources)?res.sources:[]).filter(x=>x&&typeof x.url==='string'&&/^https?:\/\/[^\s]+$/.test(x.url)).slice(0,5).map(x=>({id:x.id,title:String(x.title||x.url),url:x.url,site:String(x.site||''),date:String(x.date||'')}));
  const labels={success:'已联网检索 · 点击来源复制链接',empty:'未找到相关网页',unavailable:'联网搜索暂不可用'};
  return {sources,searchLabel:labels[res.searchStatus]||'',trainingPlan:res.trainingPlan&&Array.isArray(res.trainingPlan.days)?res.trainingPlan:null};
}

Page({
  data: {
    messages: [],
    webSearch: false,
    inputText: '',
    thinking: false,
    sendError: '',
    typing: false,        // 打字机渲染中
    scrollToId: '',
    snapshotCollapsed: false,
    todaySummary: { intake: 0, burned: 0, proteinG: 0 },
    todayTraining: false
  },

  async onLoad() {
    if (!await app.login()) return;
    await this.loadHistory();
  },

  async onShow() {if(getApp().applyTheme)getApp().applyTheme(this);
    // 每次进入页面刷新速览（切 tab 回来也更新）
    this.loadTodaySnapshot();
    // 从训练日程空状态跳转过来 → 自动生成计划
    if (getApp().globalData.autoGeneratePlan) {
      getApp().globalData.autoGeneratePlan = false;
      this.setData({ inputText: '请帮我制定可保存到训练日程的计划。先询问我的目标、训练经验、可用器械和每周训练天数，再生成具体安排。' }, () => {
        this.onSend();
      });
    }
  },

  toggleSnapshot() {
    this.setData({ snapshotCollapsed: !this.data.snapshotCollapsed });
  },

  async loadTodaySnapshot() {
    try {
      const { formatDate } = require('../../utils/date.js');
      const today = formatDate();
      const summary = await call('record', { action: 'summary', type: 'diet', date: today }).catch(() => null);
      if (summary) this.setData({ todaySummary: summary });
      // 检查今日训练
      const schedule = require('../../utils/training-schedule.js');
      const entry = schedule.read().find(x => x.date === today);
      this.setData({ todayTraining: !!entry });
    } catch (e) { /* 速览失败不影响聊天 */ }
  },

  async loadHistory() {
    try {
      const list = await call('record', {
        action: 'list', type: 'coach', limit: 20
      }).catch(() => []);
      const messages = (list || []).map(item => ({
        id: ++msgSeq,
        role: item.role,
        content: fmtContent(item.content),
        ...searchMeta(item)
      }));
      if (!this._hasSent && !this._unloaded) this.setData({ messages }, this.scrollToBottom);
    } catch (e) { /* 无历史不影响使用 */ }
  },

  previewPlan(e){const message=this.data.messages.find(x=>x.id===Number(e.currentTarget.dataset.message));if(!message||!message.trainingPlan)return;app.globalData.pendingAITrainingPlan=message.trainingPlan;wx.navigateTo({url:'/pages/schedule/schedule?preview=1'});},
  toggleSearch(){if(!this.data.thinking&&!this.data.typing)this.setData({webSearch:!this.data.webSearch});},
  copySource(e){const message=this.data.messages.find(x=>x.id===Number(e.currentTarget.dataset.message));const source=message&&message.sources&&message.sources[Number(e.currentTarget.dataset.index)];if(source)wx.setClipboardData({data:source.url});},

  onInput(e) { this.setData({ inputText: e.detail.value }); },

  onQuickQuestion(e) {
    this.setData({ inputText: e.currentTarget.dataset.q }, this.onSend);
  },

  async onSend() {
    const text = (this.data.inputText || '').trim();
    if (!text || this.data.thinking || this.data.typing) return;
    this._hasSent = true;

    const userMsg = { id: ++msgSeq, role: 'user', content: text };
    this.setData({
      messages: [...this.data.messages, userMsg],
      inputText: '',
      sendError: '',
      thinking: true
    }, this.scrollToBottom);

    try {
      const res = await call('aiCoach', { question: text, webSearch:this.data.webSearch });
      if (this._unloaded) return;
      const chunks = res && Array.isArray(res.chunks) ? res.chunks.filter(c => typeof c === 'string' && c.length) : [];
      const answer = res && typeof res.answer === 'string' ? res.answer : chunks.join('');
      if (!answer.trim()) throw new Error('AI 暂未返回回答，请重试');
      this.setData({ thinking: false });
      // 有分片则打字机渲染，否则一次性展示（兼容旧返回/安全兜底文案）
      if (chunks.length > 1 && chunks.join('') === answer) {
        await this.typewriterRender(chunks);
        if(!this._unloaded){const messages=this.data.messages.map(m=>m.id===this._twMsgId?{...m,...searchMeta(res)}:m);this.setData({messages},this.scrollToBottom);}
      } else {
        const aiMsg = { id: ++msgSeq, role: 'assistant', content: fmtContent(answer), ...searchMeta(res) };
        this.setData({
          messages: [...this.data.messages, aiMsg]
        }, this.scrollToBottom);
      }
    } catch (e) {
      if (this._unloaded) return;
      const reason = e && e.message ? e.message : '连接失败，请稍后重试';
      this.setData({ thinking: false, sendError: reason, inputText: text }, this.scrollToBottom);
    }
  },

  // 打字机渲染：先插入空气泡，再按片逐步填充
  // setData 节流：片段入队，定时器每 80ms 批量合并刷新（避免高频 setData 卡顿）
  typewriterRender(chunks) {
    return new Promise((resolve) => {
      const msgId = ++msgSeq;
      // 插入空 AI 气泡
      this.setData({
        messages: [...this.data.messages, { id: msgId, role: 'assistant', content: '' }],
        typing: true
      }, this.scrollToBottom);

      this._twQueue = chunks.slice();   // 待渲染分片
      this._twMsgId = msgId;
      this._twBuf = '';                 // 已渲染文本
      this._twResolve = resolve;

      this._twTimer = setInterval(() => {
        if (!this._twQueue.length) {
          this.finishTypewriter();
          return;
        }
        // 每帧出队 1~2 片，长回答不至于渲染太慢
        const take = this._twQueue.length > 30 ? 2 : 1;
        for (let i = 0; i < take && this._twQueue.length; i++) {
          this._twBuf += this._twQueue.shift();
        }
        this.updateTypingMessage(this._twBuf);
      }, 80);
    });
  },

  // 局部更新当前打字气泡（按 index 精确 setData，不整列表刷新）
  updateTypingMessage(content) {
    const msgs = this.data.messages;
    const idx = msgs.findIndex(m => m.id === this._twMsgId);
    if (idx < 0) return;
    this.setData({
      [`messages[${idx}].content`]: content
    }, this.scrollToBottom);
  },

  finishTypewriter() {
    if (this._twTimer) clearInterval(this._twTimer);
    this._twTimer = null;
    this.setData({ typing: false }, this.scrollToBottom);
    if (this._twResolve) { this._twResolve(); this._twResolve = null; }
  },

  scrollToBottom() {
    const msgs = this.data.messages;
    if (msgs.length) {
      this.setData({ scrollToId: 'msg-' + msgs[msgs.length - 1].id });
    }
  },

  onUnload() {
    this._unloaded = true;
    if (this._twResolve) { this._twResolve(); this._twResolve = null; }
    // 组件销毁清理定时器（E-09：防内存泄漏）
    if (this._twTimer) clearInterval(this._twTimer);
    if (this._searchTimer) clearTimeout(this._searchTimer);
  }
});
