const library = require('./exercise-library.js');
const KEY = 'trainingPlan:v1';
const templates = [
 {id:'full',name:'全身训练',tag:'新手优先',frequency:'每周 2～3 天',days:[2,3],description:'每次兼顾推、拉、臀腿与核心，训练日之间留出恢复时间。'},
 {id:'upperLower',name:'上下肢分化',tag:'规律训练者',frequency:'每周 4 天',days:[4],description:'上肢与下肢交替，每周各练两次，单次训练更集中。'},
 {id:'ppl',name:'推 / 拉 / 腿',tag:'经验与时间充足',frequency:'每周 6 天',days:[6],description:'推、拉、腿各两次，适合已能稳定恢复的训练者；不是练得越多越好。'}
];
const focuses=[{id:'all',name:'均衡全身'},{id:'chest',name:'胸部'},{id:'back',name:'背部'},{id:'legs',name:'臀腿'},{id:'shoulders',name:'肩部'},{id:'arms',name:'手臂'},{id:'core',name:'核心'}];
const sources=[
 {title:'ACSM · 2026 抗阻训练指南',url:'https://acsm.org/resistance-training-guidelines-update-2026/'},
 {title:'NSCA · 训练频率与分化安排',url:'https://www.nsca.com/education/articles/kinetic-select/determination-of-resistance-training-frequency/'}
];
const weeks=[
 {title:'第 1 周 · 动作适应',note:'正式组从 2 组起步，采用次数范围下段。熟悉 A / B 动作，保留约 3 次余力。'},
 {title:'第 2 周 · 增加次数',note:'组数先不增加，同一动作逐步增加次数。下列是建议目标；若上次未达标或动作变形，沿用上次目标。'},
 {title:'第 3 周 · 条件进阶',note:'规律训练者恢复良好且已达标时，才向下列组数目标进阶；否则沿用第 2 周。新手保持 2 组，不同时追求加组、加重。'},
 {title:'第 4 周 · 减量恢复',note:'本周期安排减量：每个动作比进阶周少 1 组，次数回到较低范围。保持熟悉动作，留出更多余力；四周减量是本模板选择，并非人人必须。'}
];
function config(input={}) {
 const t=templates.find(x=>x.id===input.template);
 if(!t)throw Error('请选择训练模板');
 if(!['beginner','regular'].includes(input.level))throw Error('请选择训练经验');
 if(input.level==='beginner'&&t.id!=='full')throw Error('新手请先选择每周 2～3 天的全身训练');
 if(!['gym','dumbbell'].includes(input.equipment))throw Error('请选择可用器械');
 if(!focuses.some(x=>x.id===input.focus))throw Error('请选择训练重点');
 const days=Number(input.days);
 if(!t.days.includes(days))throw Error('每周次数与模板不匹配');
 return {template:t.id,level:input.level,equipment:input.equipment,focus:input.focus,days};
}
function generateLegacy(input) {
 const c=config(input), t=templates.find(x=>x.id===c.template), gym=c.equipment==='gym', beginner=c.level==='beginner';
 // A small reviewed pool avoids arbitrary matches from exercise names or secondary muscles.
 const pool={
  squat:{id:gym?'0739':'1760',group:'legs',compound:true},
  hinge:{id:'1459',group:'legs',compound:true},
  chest:{id:gym?(beginner?'0577':'0025'):(beginner?'3211':'0662'),group:'chest',compound:true},
  row:{id:gym?'0861':'0293',group:'back',compound:true},
  pull:{id:gym?'0818':'2292',group:gym?'back':'shoulders',compound:gym},
  press:{id:'0426',group:'shoulders',compound:true},
  lateral:{id:'0334',group:'shoulders'},
  curl:{id:'0294',group:'arms'},
  triceps:{id:gym?'0200':'1741',group:'arms'},
  lunge:{id:'0336',group:'legs',compound:true,eachSide:true},
  calf:{id:'0417',group:'legs'},
  core:{id:'0276',group:'core',eachSide:true},
  bridge:{id:'3013',group:'legs'}
 };
 const patterns={full:['squat','chest','row','hinge','press','core'],upper:['chest','row','pull','press','curl','triceps'],lower:['squat','hinge','lunge','calf','core'],push:['chest','press','lateral','triceps','core'],pull:['row','pull','curl','core'],legs:['squat','hinge','lunge','calf','core']};
 const schedules={full:c.days===2?['full',null,null,'full',null,null,null]:['full',null,'full',null,'full',null,null],upperLower:['upper','lower',null,'upper','lower',null,null],ppl:['push','pull','legs',null,'push','pull','legs']};
 const labels={full:'全身训练',upper:'上肢训练',lower:'下肢训练',push:'推 · 胸肩三头',pull:'拉 · 背与二头',legs:'臀腿训练'};
 const weekdays=['周一','周二','周三','周四','周五','周六','周日'];
 const sessions=schedules[c.template].map((type,day)=>{
  if(!type)return {day,label:weekdays[day],title:'休息 / 轻松活动',rest:true,exercises:[],minutes:0};
  let keys=patterns[type].slice();
  if(type==='full'&&c.focus==='arms')keys.push(day===0?'curl':'triceps');
  // Keep compound movements first; prioritize the chosen region within that tier.
  keys.sort((a,b)=>Number(!!pool[b].compound)-Number(!!pool[a].compound)||Number(pool[b].group===c.focus)-Number(pool[a].group===c.focus));
  let emphasized=false;
  const exercises=keys.map(key=>{
   const spec=pool[key], item=library.get(spec.id);
   if(!item)throw Error('动作数据缺失，请更新动作库');
   const focus=c.focus!=='all'&&spec.group===c.focus;
   const bonus=focus&&!beginner&&!emphasized?1:0;
   if(bonus)emphasized=true;
   const sets=(beginner?2:spec.compound?3:2)+bonus;
   const reps=key==='core'?'6～10':spec.compound?'8～12':'10～15';
   return {id:spec.id,name:item.displayName,group:spec.group,equipment:item.equipmentLabel,sets,reps,eachSide:!!spec.eachSide,rest:spec.compound?120:60,focus};
  });
  return {day,label:weekdays[day],title:labels[type],rest:false,exercises,minutes:Math.round((8+exercises.reduce((n,x)=>n+x.sets*(x.eachSide?1.5:0.75)+(x.sets-1)*x.rest/60+1,0))/5)*5};
 });
 return {version:1,config:c,title:t.name,focusName:focuses.find(x=>x.id===c.focus).name,sessions,createdAt:Date.now()};
}
function generate(input) {
 const base=generateLegacy(input), beginner=base.config.level==='beginner', gym=base.config.equipment==='gym';
 const seen={};
 const allWeeks=weeks.map((info,week)=>{
  const sessions=base.sessions.map(session=>{
   if(session.rest)return {...session,exercises:[]};
   const occurrence=seen[session.title]||0;seen[session.title]=occurrence+1;
   const variant=occurrence%2===0?'A':'B';
   const exercises=session.exercises.map(original=>{
    let id=original.id,eachSide=original.eachSide;
    if(variant==='B'){
     if(id==='0276'){id='0872';eachSide=false;}
     if(id==='0200')id='0201';
     if(id==='1741')id='0333';
     if(id==='0294')id='0416';
     if(base.config.template==='full'){
      if(id==='1459')id='3013';
      if(id==='0426')id='0334';
     }else{
      if(id==='0336'){id='3013';eachSide=false;}
      if(gym&&id==='0025')id='0577';
     }
    }
    const item=library.get(id);if(!item)throw Error('动作数据缺失，请更新动作库');
    const core=original.group==='core';
    const compound=original.rest===120&&!['3013','0334'].includes(id);
    const peakSets=beginner?2:Math.min(original.sets,3);
    const sets=week<2?2:week===2?peakSets:Math.max(1,peakSets-1);
    const repRanges=core?['6～8','8～10','8～12','6～8']:compound?['8～10','10～12','8～12','8～10']:['10～12','12～15','10～15','10～12'];
    const bodyweight=item.equipment==='body weight';
    const loadNotes=[
     bodyweight?'动作稳定优先，保留约 3 次余力。':'选能稳定完成的轻负荷，保留约 3 次余力。',
     '沿用上次同动作负荷，达标后每组尝试多 1～2 次；未达标则维持。',
     bodyweight?'达标且恢复良好才增加组数，否则保持上周；不同时提高动作难度。':'达标且恢复良好才增加组数。连续两次同动作达次数上限且仍有约 2 次余力，才加最小档重量；加组时先不加重。',
     bodyweight?'减少正式组，轻松完成，保留约 4 次余力。':'不加重；必要时降低重量，以保留约 4 次余力为准。'
    ];
    return {...original,id,name:item.displayName,equipment:item.equipmentLabel,sets,reps:repRanges[week],eachSide,rest:compound?120:60,loadNote:loadNotes[week]};
   });
   const minutes=Math.round((8+exercises.reduce((n,x)=>n+x.sets*(x.eachSide?1.5:0.75)+(x.sets-1)*x.rest/60+1,0))/5)*5;
   return {...session,title:session.title+' '+variant,variant,exercises,minutes};
  });
  return {...info,sessions,totalSets:sessions.reduce((n,s)=>n+s.exercises.reduce((sum,x)=>sum+x.sets,0),0)};
 });
 return {...base,version:2,weeks:allWeeks,sessions:allWeeks[0].sessions};
}
function save(plan,progress={}) { config(plan.config);if(![1,2].includes(plan.version))throw Error('计划版本无效');wx.setStorageSync(KEY,{version:plan.version,config:plan.config,createdAt:plan.createdAt,progress}); }
function restore() {
 try {
  const raw=wx.getStorageSync(KEY);
  if(!raw||![1,2].includes(raw.version))return null;
  const plan=raw.version===2?generate(raw.config):generateLegacy(raw.config);plan.createdAt=Number(raw.createdAt)||Date.now();
  if(raw.version===1){plan.legacy=true;plan.weeks=[0,1,2,3].map(w=>({title:'第 '+(w+1)+' 周 · 原计划',note:'保留已保存的原安排与进度。可预览新版 A / B 四周递进计划，保存新版后开始新周期。',sessions:plan.sessions,totalSets:plan.sessions.reduce((n,s)=>n+s.exercises.reduce((sum,x)=>sum+x.sets,0),0)}));}
  const allowed=new Set();plan.weeks.forEach((w,index)=>w.sessions.forEach(s=>s.exercises.forEach(x=>allowed.add(index+':'+s.day+':'+x.id))));
  const progress={};if(raw.progress&&typeof raw.progress==='object')Object.keys(raw.progress).forEach(k=>{if(allowed.has(k)&&raw.progress[k]===true)progress[k]=true;});
  return {plan,progress};
 } catch(e) {return null;}
}
module.exports={templates,focuses,sources,weeks,generate,config,save,restore};
