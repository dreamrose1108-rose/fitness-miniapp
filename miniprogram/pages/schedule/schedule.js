const schedule=require('../../utils/training-schedule');
const {formatDate}=require('../../utils/date');
const {call}=require('../../utils/cloud.js');
const library=require('../../utils/exercise-library.js');
Page({
 data:{draft:null,rows:[],today:'',start:'',maxDate:'',overrides:{},error:'',busy:false,showPast:false,success:'',
   restTimer:{visible:false,remain:0,total:0,label:''},activeExercise:null},
 onLoad(options){const today=formatDate();this.setData({today,start:today,maxDate:schedule.addDays(today,365)});
  if(options.preview==='1'){
   const input=getApp().globalData.pendingAITrainingPlan;delete getApp().globalData.pendingAITrainingPlan;
   // 字段名规范化：AI 可能生成 reps/rest 而非 repsMin/repsMax/restSec
   if(input&&Array.isArray(input.days)){
    input.days=input.days.map(d=>({...d,exercises:(d.exercises||[]).map(x=>{
     const fixed={...x};
     if(fixed.repsMin===undefined&&fixed.reps!==undefined){const r=Number(fixed.reps)||12;fixed.repsMin=r;fixed.repsMax=r;}
     if(fixed.restSec===undefined&&fixed.rest!==undefined){fixed.restSec=Number(fixed.rest)||60;}
     if(fixed.restSec===undefined&&fixed.restSec!==0){fixed.restSec=60;}
     if(fixed.repsMin===undefined){fixed.repsMin=12;}
     if(fixed.repsMax===undefined){fixed.repsMax=fixed.repsMin;}
     if(fixed.sets===undefined){fixed.sets=3;}
     return fixed;
    })}));
   }
   try{this.setData({draft:schedule.draft(input)});}catch(e){this.setData({error:e.message});}
  }},
 async onShow(){if(!await getApp().login()){this.setData({error:'请登录后重试'});return;}this.render();},
 render(){try{let rows=this.data.draft?schedule.preview(this.data.draft,this.data.start,this.data.overrides):schedule.read().filter(r=>this.data.showPast||r.date>=this.data.today);const today=this.data.today;const weekdays=['日','一','二','三','四','五','六'];rows=rows.map(r=>{const d=new Date(r.date+'T12:00:00');const isToday=r.date===today;const isPast=r.date<today;const w=weekdays[d.getDay()];const month=d.getMonth()+1,day=d.getDate();const dateLabel=isToday?'今天':isPast&&this.data.showPast?`${month}/${day}（周${w}）`:`${month}月${day}日 周${w}`;
  return {...r,dateLabel,isToday,isPast,exercises:r.exercises.map(x=>{
   const doneSets=this._setProgress[r.date+':'+x.id]||0;
   const totalSets=x.sets||1;
   return {...x,done:!!(r.done&&r.done[x.id]),doneSets,totalSets,setDots:Array.from({length:totalSets},(_,i)=>i<doneSets)};
  }),doneCount:r.exercises.filter(x=>r.done&&r.done[x.id]).length};});this.setData({rows,error:''});}catch(e){this.setData({error:e.message});}},

 // ===== 组间打卡 + 倒计时 =====
 _setProgress:{},
 _restTimerId:null,

 onSetTap(e){
  const {key,id,set}=e.currentTarget.dataset;
  const {date}=e.currentTarget.dataset;
  if(this.data.draft)return;
  const progressKey=date+':'+id;
  const current=this._setProgress[progressKey]||0;
  const newDone=current+1;
  const row=this.data.rows.find(r=>r.sourceKey===key);
  if(!row)return;
  const ex=row.exercises.find(x=>x.id===id);
  if(!ex)return;
  const totalSets=ex.sets||1;

  // 更新组数进度
  this._setProgress[progressKey]=newDone;
  this.render();

  if(newDone>=totalSets){
   // 全部组完成 → 标记整体完成 + 自动记录运动消耗
   this._autoRecord(ex,date);
   try{schedule.toggle(key,id);this.render();}catch(e){}
   wx.showToast({title:'✅ 全部完成，已记录消耗',icon:'none',duration:2000});
   this._stopRestTimer();
  }else{
   // 还有剩余组 → 启动组间休息倒计时
   const restSec=ex.restSec||60;
   this._startRestTimer(restSec,ex.name,newDone,totalSets);
   wx.vibrateShort({type:'light'});
  }
 },

 _startRestTimer(sec,label,doneSet,totalSets){
  this._stopRestTimer();
  this.setData({restTimer:{visible:true,remain:sec,total:sec,label:`${label} · 第${doneSet}/${totalSets}组完成`}});
  this._restTimerId=setInterval(()=>{
   const remain=this.data.restTimer.remain-1;
   if(remain<=0){
    this._stopRestTimer();
    wx.vibrateLong();
    wx.showToast({title:'休息结束，开始下一组！',icon:'none',duration:2000});
   }else{
    this.setData({'restTimer.remain':remain});
   }
  },1000);
 },

 _stopRestTimer(){
  if(this._restTimerId){clearInterval(this._restTimerId);this._restTimerId=null;}
  this.setData({'restTimer.visible':false});
 },

 skipRest(){this._stopRestTimer();wx.showToast({title:'跳过休息 💪',icon:'none'});},

 // ===== 自动记录运动消耗 =====
 async _autoRecord(ex,date){
  try{
   const lib=library.get(ex.id);
   const met=lib&&lib.met||4;
   // 估算时长：组数×每组时间(约45秒) + 组间休息
   const estMin=ex.sets*((ex.repsMax||ex.repsMin||10)*3+45)/60 + (ex.sets-1)*(ex.restSec||60)/60;
   const profile=await call('userProfile',{action:'get'}).catch(()=>null);
   const weight=(profile&&profile.targetWeight)||65;
   const kcalBurned=Math.round(met*weight*estMin/60*10)/10;
   await call('record',{
    action:'add',type:'exercise',
    data:{date,name:ex.name,met,duration:Math.round(estMin),kcalBurned}
   });
  }catch(e){console.log('auto record failed:',e.message);}
 },

 // ===== 原有功能 =====
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
