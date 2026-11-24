const feedback=require('./feedback');
const schedule=require('./training-schedule');
const labels=require('./training-labels');
const {formatDate}=require('./date');
module.exports=function createTrainingPage(todayOnly=false){return {
 data:{todayOnly,draft:null,rows:[],today:'',start:'',maxDate:'',overrides:{},error:'',busy:false,showPast:false,success:'',activeKey:'',restTimer:{visible:false,remain:0,total:0,label:''}},
 onLoad(options={}){
  todayOnly=todayOnly||options.today==='1';this.setData({todayOnly});
  if(todayOnly&&wx.setNavigationBarTitle)wx.setNavigationBarTitle({title:'今日训练'});
  const today=formatDate();this.setData({today,start:today,maxDate:schedule.addDays(today,365)});
  if(!todayOnly && options.preview==='1'){
   const input=getApp().globalData.pendingAITrainingPlan;
   if(!input){this._previewError='计划预览已失效，请返回重新打开';feedback.state(this,{error:this._previewError});return;}
   // Normalize known aliases only. Missing or invalid prescriptions must not be invented.
   const normalized={...input,days:Array.isArray(input.days)?input.days.map(d=>({...d,exercises:Array.isArray(d.exercises)?d.exercises.map(x=>({...x,repsMin:x.repsMin===undefined?x.reps:x.repsMin,repsMax:x.repsMax===undefined?(x.repsMin===undefined?x.reps:x.repsMin):x.repsMax,restSec:x.restSec===undefined?x.rest:x.restSec})):d.exercises})):input.days};
   try{this.setData({draft:schedule.draft(normalized)});delete getApp().globalData.pendingAITrainingPlan;}catch(e){this._previewError=e.message;feedback.state(this,{error:e.message});}
  }
 },
 async onShow(){if(getApp().applyTheme)getApp().applyTheme(this);this._hidden=false;if(!await getApp().login()){feedback.state(this,{error:'请登录后重试'});return;}this.setData({today:formatDate()});this.render();this.resumeTimer();},
 onHide(){this._hidden=true;this.clearTimer();},
 onUnload(){this._hidden=true;this.clearTimer();},
 render(){try{
  const today=this.data.today;
  let rows=this.data.draft?schedule.preview(this.data.draft,this.data.start,this.data.overrides):schedule.read().filter(r=>todayOnly?r.date===today:(this.data.showPast||r.date>=today));
  rows=rows.map(r=>{
   const exercises=r.exercises.map(x=>{const doneSets=schedule.count(r,x),skippedSets=schedule.skippedCount(r,x);return {...labels.exercise(x),doneSets,skippedSets,handled:doneSets+skippedSets>=x.sets,nextSet:doneSets+skippedSets+1,done:doneSets>=x.sets,skipped:!!(r.skipped&&r.skipped[x.id]),setDots:Array.from({length:x.sets},(_,i)=>i<doneSets)};});
   const doneCount=exercises.filter(x=>x.done).length,skippedCount=exercises.filter(x=>x.skipped&&!x.done).length;
   return {...r,displayTitle:labels.session(r),exercises,doneCount,skippedCount,skippedSets:exercises.reduce((sum,x)=>sum+x.skippedSets,0),actualSets:exercises.reduce((sum,x)=>sum+x.doneSets,0),plannedSets:exercises.reduce((sum,x)=>sum+x.sets,0),ready:exercises.every(x=>x.handled),isToday:r.date===today,isPast:r.date<today,dateLabel:r.date===today?'今天':r.date,active:r.sourceKey===this.data.activeKey};
  });
  if(todayOnly&&!rows.some(r=>r.sourceKey===this.data.activeKey)){this.clearTimer();this.setData({activeKey:'',restTimer:{visible:false}});}
  feedback.state(this,{rows,error:this._previewError||''});
 }catch(e){feedback.state(this,{error:e.message});}},
 begin(e){if(this.data.draft)return;try{const key=e.currentTarget.dataset.key;schedule.begin(key);this.setData({activeKey:key,success:'训练已开始，完成一组后点击下方按钮'});this.render();this.resumeTimer();}catch(e){feedback.state(this,{error:e.message});}},
 onSetTap(e){if(this.data.draft||this._setBusy)return;const {key,id,set}=e.currentTarget.dataset;if(key!==this.data.activeKey)return;this._setBusy=true;try{schedule.completeSet(key,id,Number(set));this.render();this.resumeTimer();}catch(e){feedback.state(this,{error:e.message});}finally{this._setBusy=false;}},
 toggle(e){if(this.data.draft)return;const {key,id}=e.currentTarget.dataset;if(key!==this.data.activeKey)return;try{schedule.skipExercise(key,id);this.render();this.resumeTimer();}catch(e){feedback.state(this,{error:e.message});}},
 skipSet(e){if(this.data.draft||this._setBusy)return;const {key,id,set}=e.currentTarget.dataset;if(key!==this.data.activeKey)return;this._setBusy=true;try{schedule.skipSet(key,id,Number(set));this.render();this.resumeTimer();}catch(err){feedback.state(this,{error:err.message});}finally{this._setBusy=false;}},
 requestFinish(e){const key=e.currentTarget.dataset.key;if(key!==this.data.activeKey)return;const row=this.data.rows.find(r=>r.sourceKey===key);if(!row)return;wx.showModal({title:'核对实际完成组数',content:row.exercises.map(x=>x.name+'：'+x.doneSets+' / '+x.sets+' 组'+'，跳过 '+x.skippedSets+' 组').join('\n')+'\n共完成 '+row.actualSets+' 组。按实际记录结束训练？',confirmText:'确认结束',cancelText:'继续训练',success:r=>{if(r.confirm)this.finish(e);}});},
 finish(e){try{const row=schedule.finish(e.currentTarget.dataset.key,true);this.setData({activeKey:'',success:'训练已结束，已保存 '+row.exercises.reduce((sum,x)=>sum+schedule.count(row,x),0)+' 组实际训练；未完成组数不会计入'});this.clearTimer();this.setData({restTimer:{visible:false}});this.render();}catch(e){feedback.state(this,{error:e.message});}},
 clearTimer(){if(this._timer){clearInterval(this._timer);this._timer=null;}},
 resumeTimer(){this.clearTimer();if(this._hidden||!this.data.activeKey)return;const tick=()=>{try{const row=schedule.read().find(r=>r.sourceKey===this.data.activeKey);const rest=row&&row.rest;const remain=rest?Math.max(0,Math.ceil((rest.until-Date.now())/1000)):0;this.setData({restTimer:remain?{...rest,visible:true,remain}:{visible:false}});if(!remain)this.clearTimer();}catch(e){this.clearTimer();this.setData({restTimer:{visible:false},error:e.message});}};tick();if(this.data.restTimer.visible)this._timer=setInterval(tick,1000);},
 skipRest(){try{schedule.endRest(this.data.activeKey);this.clearTimer();this.setData({restTimer:{visible:false}});}catch(e){feedback.state(this,{error:e.message});}},
 start(e){this.setData({start:e.detail.value,overrides:{},success:''});this.render();},
 day(e){const d=this.data.draft&&this.data.draft.days[Number(e.currentTarget.dataset.index)];if(d){this.setData({overrides:{...this.data.overrides,[d.offset]:e.detail.value}});this.render();}},
 async save(){if(this.data.busy||!this.data.draft)return;feedback.state(this,{busy:true,error:''});let confirming=false;try{const result=schedule.save(this.data.draft,this.data.start,this.data.overrides);if(result.conflicts.length){confirming=true;wx.showModal({title:'部分日期已有训练',content:result.conflicts.join('、')+'。跳过冲突日期并保留已有安排？',confirmText:'跳过冲突',success:r=>{if(r.confirm)this.finishSave(true);},complete:()=>this.setData({busy:false})});return;}this.saved(result);}catch(e){feedback.state(this,{error:e.message});}finally{if(!confirming)this.setData({busy:false});}},
 finishSave(skip){try{this.saved(schedule.save(this.data.draft,this.data.start,this.data.overrides,skip));}catch(e){feedback.state(this,{error:e.message});}},
 saved(result){this.setData({draft:null,overrides:{},success:result.added?'已保存 '+result.added+' 个训练日。点击今天的“开始训练”进入逐组打卡。':'该计划已保存或日期已有安排，下方可查看现有日程。'});this.render();wx.pageScrollTo({scrollTop:0,duration:0});},
 remove(e){const key=e.currentTarget.dataset.key;wx.showModal({title:'移除这天的安排？',content:'同时移除本机组数和完成记录。其他日期不受影响。',success:r=>{if(r.confirm)try{schedule.remove(key);if(this.data.activeKey===key){this.clearTimer();this.setData({activeKey:'',restTimer:{visible:false}});}this.render();}catch(e){feedback.state(this,{error:e.message});}}});},
 movement(e){const id=e.currentTarget.dataset.id;const exercise=this.data.rows.flatMap(r=>r.exercises).find(x=>x.id===id);if(!exercise)return;if(exercise.isReference&&!exercise.demoId){wx.setClipboardData({data:exercise.sourceUrl});return;}wx.navigateTo({url:'/pages/movement/movement?id='+encodeURIComponent(exercise.demoId||id)});},
 past(){this.setData({showPast:!this.data.showPast});this.render();},
 freeTraining(){wx.switchTab({url:'/pages/exercise/exercise'});},
 calendar(){wx.navigateTo({url:'/pages/calendar/calendar'});},
 coach(){getApp().globalData.autoGeneratePlan=true;wx.switchTab({url:'/pages/coach/coach'});},
 templates(){wx.navigateTo({url:'/pages/plans/plans'});}
};};
