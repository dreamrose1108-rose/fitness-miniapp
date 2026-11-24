const test=require('node:test'),assert=require('node:assert/strict');
const model=require('../miniprogram/utils/reference-plan.js');
const library=require('../miniprogram/utils/exercise-library.js');
test('all article exercises resolve to matching frontend and backend GIFs and original sources',()=>{
 const gifs=require('../miniprogram/data/exercise-gifs');
 const sources=require('../miniprogram/data/article-media');
 const deployed=require('../cloudfunctions/record/exercise-gifs.json');
 const mirror=require('../server/record/exercise-gifs.json');
 assert.deepEqual(deployed,mirror);
 assert.equal(deployed['9524'],'exercise-media/gif-v1/9525-pushTan2026.gif');
 assert.equal(deployed['9526'],'exercise-media/gif-v1/9527-pushTan2026.gif');
 assert.equal(deployed['9531'],'exercise-media/gif-v1/9532-pushTan2026.gif');
 assert.equal(deployed['9521'],undefined);
 for(const day of model.catalog.days.filter(d=>d.id.endsWith('-article'))){
  for(const action of day.actions){
   assert.ok(library.get(action.exerciseId),`${day.id}: ${action.name} missing`);
   if(action.exerciseId==='9532'){assert.ok(!gifs.includes('9532'));assert.equal(deployed['9532'],undefined);continue;}
   assert.ok(gifs.includes(action.exerciseId),`${action.exerciseId} frontend GIF missing`);
   assert.match(deployed[action.exerciseId],/exercise-media\/gif-v1\/\d{4}-[A-Za-z0-9]+\.gif$/);
   assert.equal(sources[action.exerciseId].source,day.source);
  }
 }
});
test('author follow-along lists have unique entries; video days no prescriptions, article day has them',()=>{
 assert.equal(model.catalog.days.length,6);const keys=[];
 const videoDays=model.catalog.days.filter(d=>/jingxuan\.douyin\.com/.test(d.source));
 assert.equal(videoDays.length,3);
 for(const d of videoDays){assert.match(d.source,/jingxuan\.douyin\.com\/m\/video\/\d+$/);assert.equal(d.actions.length,5);for(const a of d.actions){keys.push(d.id+':'+a.key);assert.equal(a.sets,undefined);assert.equal(a.reps,undefined);if(a.exerciseId)assert.ok(library.get(a.exerciseId));}}
 const articleDays=model.catalog.days.filter(d=>/mp\.weixin\.qq\.com/.test(d.source));
 assert.equal(articleDays.length,3);
 for(const ad of articleDays){for(const a of ad.actions){keys.push(ad.id+':'+a.key);if(a.exerciseId)assert.ok(library.get(a.exerciseId));if(a.sets)assert.ok(a.sets>=1&&a.sets<=6);}}
 assert.equal(new Set(keys).size,46); // 15 video + 31 article
 assert.equal(videoDays[0].actions[4].exerciseId,null);
 assert.equal(videoDays[1].actions[3].name,'开肘下拉');
 assert.equal(videoDays[2].actions[2].name,'高脚杯深蹲');
 assert.equal(articleDays[0].actions[4].exerciseId,'9505');
});
test('empty prescriptions are valid drafts, not completed training',()=>{assert.deepEqual(model.validateEntry(),{sets:'',reps:'',rest:''});assert.equal(model.complete({sets:'3',reps:'12'}),false);});
test('numeric limits reject invalid values rather than coercing them to plausible doses',()=>{
 for(const bad of ['0','-1','2.5','abc','Infinity','999'])assert.throws(()=>model.validateEntry({sets:bad}));
 assert.throws(()=>model.validateEntry({rest:'14'}));assert.throws(()=>model.validateEntry({reps:'51'}));
 assert.equal(model.complete({sets:3,reps:10,rest:90}),true);
});
test('local drafts round trip; unknown actions excluded; empty fields auto-fill defaults',()=>{
 let value;global.wx={setStorageSync:(k,v)=>{value=JSON.parse(JSON.stringify(v));},getStorageSync:()=>value};
 model.save({'push:bench':{sets:'3',reps:'10',rest:'90'},'pull:cable-curl':{},fake:{sets:'3'}},{'push:bench':true,'pull:cable-curl':true,fake:true});
 const r=model.restore();
 // 两个动作都完成了（pull:cable-curl 因为预填了默认值所以 complete=true）
 assert.ok(r.progress['push:bench']);
 assert.ok(r.progress['pull:cable-curl']);
 assert.equal(r.entries.fake,undefined);
 assert.ok(r.entries['pull:cable-curl'].sets);
 assert.ok(r.entries['pull:cable-curl'].reps);
 assert.ok(r.entries['pull:cable-curl'].rest);
});
test('storage failures return defaults and corrupt stored data falls back to defaults',()=>{
 global.wx={getStorageSync:()=>({version:1,entries:{'push:bench':{sets:'bad'}}}),setStorageSync:()=>{throw Error('quota');}};
 const r=model.restore();
 // 损坏数据回退到默认方案而非空
 assert.ok(r.entries['push:bench'].sets);
 assert.ok(r.entries['push:bench'].reps);
 assert.deepEqual(r.progress,{});
 assert.throws(()=>model.save({}),/quota/);
});
test('editing a completed action clears its completion and does not write until save',()=>{
 const fs=require('node:fs'),vm=require('node:vm');let def;let writes=0;
 global.wx={setStorageSync:()=>{writes++;}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../miniprogram/pages/reference-plan/reference-plan.js'),'utf8'),{require:()=>model,Page:p=>{def=p;}});
 const p={...def,data:{...def.data,entries:{'push:bench':{sets:'3',reps:'10',rest:'90'}},progress:{'push:bench':true}},setData(patch){Object.assign(this.data,patch);}};
 p.render();p.edit({currentTarget:{dataset:{key:'push:bench',field:'sets'}},detail:{value:'2'}});
 assert.equal(p.data.progress['push:bench'],undefined);assert.equal(p.data.dirty,true);assert.equal(writes,0);
});
test('reference personal plan persists entries and progress, updates existing plan and isolates accounts',()=>{
 const storage=new Map();let owner='first';global.getApp=()=>({globalData:{openid:owner}});global.wx={getStorageSync:k=>storage.get(k),setStorageSync:(k,v)=>storage.set(k,JSON.parse(JSON.stringify(v)))};
 try{model.savePersonal({'push:bench':{sets:'5',reps:'8',rest:'120'}},{'push:bench':true});assert.equal(model.personal().entries['push:bench'].sets,'5');assert.equal(model.restore().progress['push:bench'],true);const rows=model.restore();rows.entries['push:bench'].reps='10';model.save(rows.entries,{});assert.equal(model.personal().entries['push:bench'].reps,'10');owner='second';assert.equal(model.personal(),null);owner='first';assert.equal(model.personal().entries['push:bench'].sets,'5');global.wx.setStorageSync=()=>{throw Error('disk full');};assert.throws(()=>model.savePersonal(rows.entries),/disk full/);assert.equal(model.personal().entries['push:bench'].sets,'5');}finally{delete global.getApp;delete global.wx;}
});
test('save button enrolls reference plan and only reports success after storage succeeds',()=>{
 const fs=require('node:fs'),vm=require('node:vm');let page,called=false,fail=false;const toasts=[];
 vm.runInNewContext(fs.readFileSync('miniprogram/pages/reference-plan/reference-plan.js','utf8'),{Page:p=>page=p,require:()=>({...model,savePersonal:(entries,progress)=>{called=true;if(fail)throw Error('disk full');return {entries,progress};}}),wx:{showToast:x=>toasts.push(x)}});page.setData=function(x){Object.assign(this.data,x);};page.render=()=>{};page.save();assert.equal(called,true);assert.equal(page.data.personalSaved,true);assert.equal(toasts[0].title,'已保存到我的计划');page.data.dirty=true;fail=true;page.save();assert.equal(page.data.dirty,true);assert.equal(toasts[1].icon,'none');
});
