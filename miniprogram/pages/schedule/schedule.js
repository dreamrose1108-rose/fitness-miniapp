const schedule=require('../../utils/training-schedule');
const {formatDate}=require('../../utils/date');
Page({
 data:{draft:null,rows:[],today:'',start:'',maxDate:'',overrides:{},error:'',busy:false,showPast:false,success:''},
 onLoad(options){const today=formatDate();this.setData({today,start:today,maxDate:schedule.addDays(today,365)});if(options.preview==='1'){const input=getApp().globalData.pendingAITrainingPlan;delete getApp().globalData.pendingAITrainingPlan;try{this.setData({draft:schedule.draft(input)});}catch(e){this.setData({error:e.message});}}},
 async onShow(){if(!await getApp().login()){this.setData({error:'请登录后重试'});return;}this.render();},
 render(){try{let rows=this.data.draft?schedule.preview(this.data.draft,this.data.start,this.data.overrides):schedule.read().filter(r=>this.data.showPast||r.date>=this.data.today);const today=this.data.today;const weekdays=['日','一','二','三','四','五','六'];rows=rows.map(r=>{const d=new Date(r.date+'T12:00:00');const isToday=r.date===today;const isPast=r.date<today;const w=weekdays[d.getDay()];const month=d.getMonth()+1,day=d.getDate();const dateLabel=isToday?'今天':isPast&&this.data.showPast?`${month}/${day}（周${w}）`:`${month}月${day}日 周${w}`;return {...r,dateLabel,isToday,isPast,exercises:r.exercises.map(x=>({...x,done:!!(r.done&&r.done[x.id])})),doneCount:r.exercises.filter(x=>r.done&&r.done[x.id]).length};});this.setData({rows,error:''});}catch(e){this.setData({error:e.message});}},
 start(e){this.setData({start:e.detail.value,overrides:{},success:''});this.render();},
 day(e){const index=Number(e.currentTarget.dataset.index),d=this.data.draft&&this.data.draft.days[index];if(!d)return;this.setData({overrides:{...this.data.overrides,[d.offset]:e.detail.value},success:''});this.render();},
 async save(){if(this.data.busy||!this.data.draft)return;this.setData({busy:true});try{const result=schedule.save(this.data.draft,this.data.start,this.data.overrides);if(result.conflicts.length){wx.showModal({title:'这些日期已有训练',content:result.conflicts.join('、')+'。跳过这些日期，保留原安排与完成进度？',confirmText:'跳过冲突',cancelText:'调整日期',success:r=>{if(r.confirm)this.finishSave(true);},complete:()=>this.setData({busy:false})});return;}this.saved(result);}catch(e){this.setData({error:e.message});}this.setData({busy:false});},
 finishSave(skip){try{this.saved(schedule.save(this.data.draft,this.data.start,this.data.overrides,skip));}catch(e){this.setData({error:e.message});}},
 saved(result){if(!result.added){this.setData({error:'没有新增日程：日期已有安排或该计划已保存，请调整日期。'});return;}this.setData({draft:null,success:'已保存 '+result.added+' 个训练日到本机',overrides:{}});this.render();},
 toggle(e){const {key,id}=e.currentTarget.dataset;if(this.data.draft)return;try{schedule.toggle(key,id);this.render();}catch(e){this.setData({error:e.message});}},
 remove(e){const key=e.currentTarget.dataset.key;wx.showModal({title:'移除这天的安排？',content:'同时移除本机的动作完成标记。其他日期不受影响。',success:r=>{if(r.confirm)try{schedule.remove(key);this.render();}catch(e){this.setData({error:e.message});}}});},
 movement(e){const id=e.currentTarget.dataset.id;if(this.data.rows.some(r=>r.exercises.some(x=>x.id===id)))wx.navigateTo({url:'/pages/movement/movement?id='+id});},
 past(){this.setData({showPast:!this.data.showPast});this.render();},
 calendar(){wx.navigateTo({url:'/pages/calendar/calendar'});},
 coach(){wx.switchTab({url:'/pages/coach/coach'});}
});
