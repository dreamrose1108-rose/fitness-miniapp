const library=require('./exercise-library');
const {validate}=require('./training-draft-schema');
const {formatDate}=require('./date');
function draft(input){const clean=validate(input,id=>library.get(id));if(!/^[a-zA-Z0-9_-]{8,80}$/.test(input.id||''))throw Error('计划标识无效，请重新生成');return {...clean,id:input.id};}
function date(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))throw Error('日期无效');const [y,m,d]=value.split('-').map(Number),v=new Date(y,m-1,d,12);if(formatDate(v)!==value)throw Error('日期无效');return v;}
function addDays(value,offset){const d=date(value);d.setDate(d.getDate()+offset);return formatDate(d);}
function key(){const owner=getApp().globalData.openid;if(!owner)throw Error('请先登录');return 'trainingSchedule:v1:'+owner;}
function read(){const raw=wx.getStorageSync(key());if(!raw)return [];if(raw.version!==1||!Array.isArray(raw.entries))throw Error('本机日程数据无效，请勿覆盖');return raw.entries;}
function preview(input,start,overrides={}){const plan=draft(input);date(start);return plan.days.map(d=>{const scheduled=overrides[d.offset]||addDays(start,d.offset);date(scheduled);return {date:scheduled,sourceKey:plan.id+':'+start+':'+d.offset,planId:plan.id,planTitle:plan.title,title:d.title,exercises:d.exercises,done:{}};});}
function save(input,start,overrides={},skipConflicts=false){
  const rows=preview(input,start,overrides),today=formatDate(),seen=new Set();
  rows.forEach(r=>{if(r.date<today||r.date>addDays(today,365))throw Error('训练日期需在今天起一年内');if(seen.has(r.date))throw Error('同一天只能安排一次训练');seen.add(r.date);});
  const existing=read(),conflicts=rows.filter(r=>existing.some(x=>x.date===r.date&&x.sourceKey!==r.sourceKey));
  if(conflicts.length&&!skipConflicts)return {conflicts:conflicts.map(r=>r.date),added:0};
  const added=rows.filter(r=>!existing.some(x=>x.date===r.date||x.sourceKey===r.sourceKey));
  if(existing.length+added.length>365)throw Error('本机日程已满，请先移除旧安排');
  if(added.length)wx.setStorageSync(key(),{version:1,entries:existing.concat(added).sort((a,b)=>a.date.localeCompare(b.date))});
  return {conflicts:conflicts.map(r=>r.date),added:added.length};
}
function toggle(sourceKey,id){const entries=read();const row=entries.find(x=>x.sourceKey===sourceKey);if(!row||!row.exercises.some(x=>x.id===id))throw Error('训练动作不存在');row.done={...row.done,[id]:!row.done[id]};wx.setStorageSync(key(),{version:1,entries});}
function remove(sourceKey){const entries=read();wx.setStorageSync(key(),{version:1,entries:entries.filter(x=>x.sourceKey!==sourceKey)});}
function fromTemplate(plan){
 const days=[];
 plan.weeks.forEach((week,w)=>week.sessions.forEach(session=>{
  if(session.rest)return;
  days.push({offset:w*7+session.day,title:week.title+' · '+session.title,exercises:session.exercises.map(x=>{
   const match=String(x.reps).match(/^(\d+)(?:[～~–-](\d+))?$/);
   if(!match)throw Error('模板次数格式无效');
   return {id:x.id,sets:x.sets,repsMin:Number(match[1]),repsMax:Number(match[2]||match[1]),restSec:x.rest,eachSide:!!x.eachSide};
  })});
 }));
 return draft({id:'template_'+plan.createdAt+'_'+plan.config.template,title:plan.title,notes:'四周安排；开始日期对应第一周第一个训练日。',days});
}
function mutate(sourceKey,fn){const entries=read(),row=entries.find(r=>r.sourceKey===sourceKey);if(!row)throw Error('训练安排已不存在');fn(row);wx.setStorageSync(key(),{version:1,entries});return row;}
function count(row,exercise){const actual=row.completedSets&&row.completedSets[exercise.id];return actual!==undefined?Math.max(0,Number(actual)||0):(row.done&&row.done[exercise.id]?exercise.sets:0);}
function setActualSets(sourceKey,id,value){
 if(!Number.isInteger(value)||value<0||value>50)throw Error('实际组数需为 0～50 的整数');
 return mutate(sourceKey,row=>{
  if(!row.startedAt||row.date!==formatDate()||row.finishedAt)throw Error('请先开始今天的训练');
  const ex=row.exercises.find(x=>x.id===id);if(!ex)throw Error('训练动作不存在');
  row.completedSets={...row.completedSets,[id]:value};row.done={...row.done,[id]:value>=ex.sets};
  row.skipped={...row.skipped,[id]:false};row.rest=null;
 });
}
function begin(sourceKey){return mutate(sourceKey,row=>{
 if(row.date!==formatDate())throw Error('只能开始今天的训练；其他日期可查看安排');
 if(row.finishedAt)throw Error('这次训练已结束');
 row.startedAt=row.startedAt||Date.now();
});}
function completeSet(sourceKey,id,expected){let changed=false;
 const row=mutate(sourceKey,row=>{
  if(!row.startedAt||row.date!==formatDate()||row.finishedAt)throw Error('请先开始今天的训练');
  if(row.rest&&row.rest.until>Date.now())throw Error('正在休息，可先跳过休息');
  const ex=row.exercises.find(x=>x.id===id);if(!ex)throw Error('训练动作不存在');
  const current=count(row,ex);
  if(row.skipped&&row.skipped[id]||current>=ex.sets||expected!==current+1)return;
  row.completedSets={...row.completedSets,[id]:current+1};
  row.done={...row.done,[id]:current+1===ex.sets};
  row.rest=current+1<ex.sets?{until:Date.now()+ex.restSec*1000,total:ex.restSec,label:ex.name+' · 第 '+(current+1)+' 组完成'}:null;
  changed=true;
 });return {row,changed};
}
function skipExercise(sourceKey,id){return mutate(sourceKey,row=>{
 if(!row.startedAt||row.date!==formatDate()||row.finishedAt)throw Error('请先开始今天的训练');
 const ex=row.exercises.find(x=>x.id===id);if(!ex)throw Error('训练动作不存在');
 if(count(row,ex)>=ex.sets)throw Error('已完成的动作不能跳过');
 row.skipped={...row.skipped,[id]:!(row.skipped&&row.skipped[id])};row.rest=null;
});}
function endRest(sourceKey){return mutate(sourceKey,row=>{row.rest=null;});}
function finish(sourceKey,acceptPartial=false){return mutate(sourceKey,row=>{
 if(!row.startedAt||row.date!==formatDate())throw Error('请先开始今天的训练');
 if(!acceptPartial&&!row.exercises.every(x=>count(row,x)>=x.sets||row.skipped&&row.skipped[x.id]))throw Error('还有未完成的动作，请完成或明确跳过');
 row.finishedAt=row.finishedAt||Date.now();row.rest=null;
});}
module.exports={draft,date,addDays,read,preview,save,toggle,remove,fromTemplate,count,setActualSets,begin,completeSet,skipExercise,endRest,finish};
