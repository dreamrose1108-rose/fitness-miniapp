const test=require('node:test'),assert=require('node:assert/strict');
const model=require('../miniprogram/utils/reference-plan.js');
const library=require('../miniprogram/utils/exercise-library.js');
test('author follow-along lists have unique entries; video days no prescriptions, article day has them',()=>{
 assert.equal(model.catalog.days.length,5);const keys=[];
 const videoDays=model.catalog.days.filter(d=>/jingxuan\.douyin\.com/.test(d.source));
 assert.equal(videoDays.length,3);
 for(const d of videoDays){assert.match(d.source,/jingxuan\.douyin\.com\/m\/video\/\d+$/);assert.equal(d.actions.length,5);for(const a of d.actions){keys.push(d.id+':'+a.key);assert.equal(a.sets,undefined);assert.equal(a.reps,undefined);if(a.exerciseId)assert.ok(library.get(a.exerciseId));}}
 const articleDays=model.catalog.days.filter(d=>/mp\.weixin\.qq\.com/.test(d.source));
 assert.equal(articleDays.length,2);
 for(const a of articleDays[0].actions){keys.push(articleDays[0].id+':'+a.key);if(a.exerciseId)assert.ok(library.get(a.exerciseId));if(a.sets)assert.ok(a.sets>=1&&a.sets<=6);}
 assert.equal(new Set(keys).size,35); // 15 video + 10 article
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
