const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const schedule=require('../miniprogram/utils/training-schedule');
const {formatDate}=require('../miniprogram/utils/date');
const plan={id:'flow_test_123',title:'流程测试',days:[{offset:0,title:'今天',exercises:[{id:'0025',sets:2,repsMin:8,repsMax:12,restSec:60}]}]};
function setup(todayOnly=false){
 let storage={},definition;const exported={exports:{}};const timers=new Map(),app={globalData:{openid:'test',pendingAITrainingPlan:plan},login:async()=>true};
 const wx={getStorageSync:k=>storage[k]?JSON.parse(JSON.stringify(storage[k])):undefined,setStorageSync:(k,v)=>storage[k]=JSON.parse(JSON.stringify(v)),pageScrollTo(){},showModal(){},navigateTo(){}};
 global.wx=wx;global.getApp=()=>app;
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../miniprogram/utils/training-page.js'),'utf8'),{require:n=>n.includes('training-schedule')?schedule:{formatDate},module:exported,getApp:()=>app,wx,setInterval:fn=>{timers.set(1,fn);return 1;},clearInterval:id=>timers.delete(id)});
 definition=exported.exports(todayOnly);
 const create=()=>{const p={...definition,data:JSON.parse(JSON.stringify(definition.data)),setData(v){Object.assign(this.data,v);}};return p;};return {create,timers,app};
}
const e=(key,id='0025',set=1)=>({currentTarget:{dataset:{key,id,set}}});
test('draft -> saved schedule -> start -> set -> demonstration return -> resume -> finish',async()=>{
 const h=setup(),p=h.create();p.onLoad({preview:'1'});await p.onShow();assert.ok(p.data.draft);assert.equal(schedule.read().length,0);
 await p.save();assert.equal(p.data.draft,null);assert.equal(p.data.rows.length,1);
 const key=p.data.rows[0].sourceKey;p.begin(e(key));p.onSetTap(e(key));assert.equal(p.data.rows[0].exercises[0].doneSets,1);assert.equal(h.timers.size,1);
 p.onHide();assert.equal(h.timers.size,0);await p.onShow();assert.equal(p.data.restTimer.visible,true);
 p.onUnload();const next=h.create();next.onLoad({});await next.onShow();assert.equal(next.data.rows[0].exercises[0].doneSets,1);
 next.begin(e(key));next.skipRest();next.onSetTap(e(key,'0025',2));assert.equal(next.data.rows[0].ready,true);next.finish(e(key));assert.ok(next.data.rows[0].finishedAt);assert.equal(h.timers.size,0);
});
test('invalid AI draft does not manufacture reps, sets or rest values',async()=>{
 const h=setup();h.app.globalData.pendingAITrainingPlan={...plan,days:[{offset:0,title:'bad',exercises:[{id:'0025'}]}]};const p=h.create();p.onLoad({preview:'1'});await p.onShow();assert.equal(p.data.draft,null);assert.ok(p.data.error);assert.equal(schedule.read().length,0);
});

test('today page shows only today, never consumes pending plan or exposes other dates',async()=>{
 const h=setup(true),today=formatDate();
 schedule.save({...plan,days:[...plan.days,{...plan.days[0],offset:1,title:'明天'}]},today);
 const rows=schedule.read();
 global.wx.setStorageSync('trainingSchedule:v1:test',{version:1,entries:[...rows,{...rows[0],sourceKey:'yesterday',date:schedule.addDays(today,-1)},{...rows[0],sourceKey:'second-today'}]});
 const p=h.create();p.onLoad({preview:'1'});await p.onShow();
 assert.equal(p.data.todayOnly,true);assert.equal(p.data.draft,null);assert.equal(h.app.globalData.pendingAITrainingPlan.id,plan.id);
 assert.equal(p.data.rows.length,2);assert.ok(p.data.rows.every(r=>r.date===today));
 p.past();assert.equal(p.data.rows.length,2);
 const key=p.data.rows[0].sourceKey;p.begin(e(key));p.onSetTap(e(key));p.onHide();await p.onShow();assert.equal(p.data.rows[0].exercises[0].doneSets,1);assert.equal(p.data.restTimer.visible,true);
 p.onUnload();const next=h.create();next.onLoad();await next.onShow();next.begin(e(key));assert.equal(next.data.restTimer.visible,true);next.skipRest();next.onSetTap(e(key,'0025',2));next.finish(e(key));assert.ok(next.data.rows[0].finishedAt);
});
test('today page is empty when only future sessions exist; schedule retains them',async()=>{
 const h=setup(true);schedule.save(plan,schedule.addDays(formatDate(),1));const p=h.create();p.onLoad();await p.onShow();assert.equal(p.data.rows.length,0);assert.equal(schedule.read().length,1);
});
test('home today-training entry targets dedicated page',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../miniprogram/pages/index/index.js'),'utf8');let definition,url;
 vm.runInNewContext(source,{getApp:()=>({}),require:()=>({}),Page:p=>definition=p,wx:{navigateTo:arg=>url=arg.url}});
 definition.goTraining();assert.equal(url,'/pages/today-training/today-training');
 const app=JSON.parse(fs.readFileSync(path.join(__dirname,'../miniprogram/app.json'),'utf8'));assert.ok(app.pages.includes(url.slice(1)));
});
