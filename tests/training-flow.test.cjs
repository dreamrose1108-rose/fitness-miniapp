const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const schedule=require('../miniprogram/utils/training-schedule');
const {formatDate}=require('../miniprogram/utils/date');
const plan={id:'flow_test_123',title:'流程测试',days:[{offset:0,title:'今天',exercises:[{id:'0025',sets:2,repsMin:8,repsMax:12,restSec:60}]}]};
function setup(){
 let storage={},definition;const timers=new Map(),app={globalData:{openid:'test',pendingAITrainingPlan:plan},login:async()=>true};
 const wx={getStorageSync:k=>storage[k]?JSON.parse(JSON.stringify(storage[k])):undefined,setStorageSync:(k,v)=>storage[k]=JSON.parse(JSON.stringify(v)),pageScrollTo(){},showModal(){},navigateTo(){}};
 global.wx=wx;global.getApp=()=>app;
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../miniprogram/pages/schedule/schedule.js'),'utf8'),{require:n=>n.includes('training-schedule')?schedule:{formatDate},Page:p=>definition=p,getApp:()=>app,wx,setInterval:fn=>{timers.set(1,fn);return 1;},clearInterval:id=>timers.delete(id)});
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
