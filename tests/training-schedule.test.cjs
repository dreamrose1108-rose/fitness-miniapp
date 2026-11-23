const test=require('node:test'),assert=require('node:assert/strict');
const schedule=require('../miniprogram/utils/training-schedule'),{formatDate}=require('../miniprogram/utils/date');
const plan={id:'ai_test_123',title:'AI 训练',days:[{offset:0,title:'全身 A',exercises:[{id:'0025',sets:2,repsMin:8,repsMax:12,restSec:90}]},{offset:2,title:'全身 B',exercises:[{id:'0336',sets:2,repsMin:8,repsMax:12,restSec:90,eachSide:true}]}]};
let owner,store,fail;function setup(){owner='u1';store={};fail=false;global.getApp=()=>({globalData:{openid:owner}});global.wx={getStorageSync:k=>store[k]?JSON.parse(JSON.stringify(store[k])):undefined,setStorageSync:(k,v)=>{if(fail)throw Error('storage failed');store[k]=JSON.parse(JSON.stringify(v));}};}
test('schedule computes real dates across month/year boundaries',()=>{assert.equal(schedule.addDays('2026-12-31',2),'2027-01-02');assert.equal(schedule.addDays('2028-02-28',1),'2028-02-29');assert.throws(()=>schedule.date('2026-02-30'));});
test('confirmed save persists dates, is idempotent and isolates accounts',()=>{setup();const start=formatDate();assert.equal(schedule.save(plan,start).added,2);assert.equal(schedule.save(plan,start).added,0);assert.equal(schedule.read().length,2);owner='u2';assert.equal(schedule.read().length,0);owner='';assert.throws(()=>schedule.read(),/登录/);});
test('conflicts never overwrite existing completion, skip only adds unoccupied days',()=>{setup();const start=formatDate();schedule.save(plan,start);let row=schedule.read()[0];schedule.toggle(row.sourceKey,'0025');const other={...plan,id:'ai_other_12',days:[plan.days[0],{...plan.days[1],offset:4}]};assert.equal(schedule.save(other,start).conflicts.length,1);assert.equal(schedule.read().length,2);assert.equal(schedule.save(other,start,{},true).added,1);assert.equal(schedule.read()[0].done['0025'],true);});
test('date overrides reject duplicates/past dates and storage failure is not success',()=>{setup();const start=formatDate();assert.throws(()=>schedule.save(plan,start,{2:start}),/同一天/);assert.throws(()=>schedule.save(plan,'2000-01-01'),/一年内/);fail=true;assert.throws(()=>schedule.save(plan,start),/storage failed/);assert.equal(schedule.read().length,0);});
test('completion and removal only affect the selected scheduled session',()=>{setup();schedule.save(plan,formatDate());const [a,b]=schedule.read();schedule.toggle(a.sourceKey,'0025');assert.equal(schedule.read()[0].done['0025'],true);assert.throws(()=>schedule.toggle(b.sourceKey,'0025'),/不存在/);schedule.remove(a.sourceKey);assert.equal(schedule.read()[0].sourceKey,b.sourceKey);});
test('malformed stored data prevents accidental overwrite',()=>{setup();store['trainingSchedule:v1:u1']={version:99,entries:[]};assert.throws(()=>schedule.save(plan,formatDate()),/数据无效/);assert.equal(store['trainingSchedule:v1:u1'].version,99);});
test('all template variants become validated schedules without losing training days',()=>{
 const planner=require('../miniprogram/utils/training-plan');
 for(const template of planner.templates)for(const days of template.days)for(const equipment of ['gym','dumbbell'])for(const level of ['beginner','regular']){
  if(level==='beginner'&&template.id!=='full')continue;
  const p=planner.generate({template:template.id,focus:'all',equipment,days,level});
  const d=schedule.fromTemplate(p);assert.equal(d.days.length,days*4);assert.deepEqual(d.days.map(x=>x.offset),p.weeks.flatMap((w,i)=>w.sessions.filter(s=>!s.rest).map(s=>i*7+s.day)));
  assert.equal(schedule.fromTemplate(p).id,d.id);
 }
});
test('sets persist, duplicate completion is idempotent, skip is not completion',()=>{
 setup();schedule.save(plan,formatDate());const key=schedule.read()[0].sourceKey;
 assert.throws(()=>schedule.completeSet(key,'0025',1),/开始/);schedule.begin(key);
 assert.equal(schedule.completeSet(key,'0025',1).changed,true);
 assert.equal(schedule.read()[0].completedSets['0025'],1);
 assert.ok(schedule.read()[0].rest.until>Date.now());
 assert.throws(()=>schedule.completeSet(key,'0025',2),/休息/);
 schedule.endRest(key);assert.equal(schedule.completeSet(key,'0025',1).changed,false);
 schedule.skipExercise(key,'0025');assert.equal(schedule.read()[0].done['0025'],false);
 assert.equal(schedule.read()[0].skipped['0025'],true);
 schedule.skipExercise(key,'0025');assert.equal(schedule.completeSet(key,'0025',2).changed,true);
 assert.equal(schedule.completeSet(key,'0025',2).changed,false);
 assert.equal(schedule.read()[0].done['0025'],true);schedule.finish(key);
 assert.ok(schedule.read()[0].finishedAt);assert.throws(()=>schedule.begin(key),/结束/);
});
test('future dates cannot execute, failed writes do not advance sets, new session does not inherit old sets',()=>{
 setup();schedule.save(plan,formatDate());const [a,b]=schedule.read();assert.throws(()=>schedule.begin(b.sourceKey),/今天/);
 schedule.begin(a.sourceKey);fail=true;assert.throws(()=>schedule.completeSet(a.sourceKey,'0025',1),/storage failed/);fail=false;assert.equal(schedule.read()[0].completedSets,undefined);
 schedule.completeSet(a.sourceKey,'0025',1);schedule.remove(a.sourceKey);
 const other={...plan,id:'ai_new_session_12',days:[plan.days[0]]};schedule.save(other,formatDate());assert.equal(schedule.read().find(x=>x.planId===other.id).completedSets,undefined);
});
