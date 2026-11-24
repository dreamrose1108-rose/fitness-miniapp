const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const editor=require('../shared/food-portions/record-editor');
const record={foodName:'饺子（猪肉）',amount:150,kcal:348,proteinG:10.5,amountUnit:'g',portionLabel:'6个',date:'2026-11-24',mealType:'lunch',photoFileID:'photo',createdAt:1};
test('existing portions recalculate from original record; repeated edits do not drift',()=>{const s=editor.initial(record);assert.equal(s.quantity,'6');const p=editor.calculate(record,{portionId:s.portionId,quantity:'3'});assert.equal(p.amount,75);assert.equal(p.kcal,174);assert.equal(p.proteinG,5.25);const again=editor.calculate({...record,...p},{portionId:s.portionId,quantity:'6'});assert.equal(again.kcal,348);assert.equal(editor.calculate(record,{portionId:'fake',quantity:'1'}),null);assert.equal(editor.calculate(record,{portionId:s.portionId,quantity:'0'}),null);});
test('photo meal scales all items without losing provenance or photos',()=>{const r={...record,foodName:'米饭、鸡腿',amount:300,kcal:500,items:[{name:'米饭',grams:100,kcal:120,proteinG:3},{name:'鸡腿',grams:200,kcal:380}]};const p=editor.calculate(r,{portionId:'meal',quantity:'0.5'});assert.equal(p.amount,150);assert.equal(p.kcal,250);assert.equal(p.items[0].grams,50);assert.equal(p.items[1].kcal,190);assert.equal(r.photoFileID,'photo');assert.equal(r.items[0].grams,100);});
function load(one){const module={exports:{}};vm.runInNewContext(fs.readFileSync('cloudfunctions/record/update-diet.js','utf8'),{module,require:n=>n==='crypto'?require('crypto'):n==='./record-editor'?editor:{one,str:JSON.stringify,jsonb:x=>JSON.stringify(x)}});return module.exports;}
test('update is owned, revision checked, atomic, and rejects missing/stale rows',async()=>{const queries=[];const m=load(async sql=>{queries.push(sql);return queries.length===1?[JSON.stringify(record)]:[JSON.stringify({...record,amount:75,kcal:174,editRevision:1})];});const r=await m.update({id:'r1',revision:0,portionId:'household',quantity:'3',kcal:1},'owner');assert.equal(r._id,'r1');assert.equal(r.kcal,174);assert.match(queries[1],/UPDATE public.fit_diet_records/);assert.match(queries[1],/openid.*owner/);assert.match(queries[1],/editRevision.*=0/);assert.ok(!queries.some(x=>/DELETE|INSERT/.test(x)));await assert.rejects(load(async()=>null).update({id:'r1',revision:0},'owner'),/不存在/);await assert.rejects(load(async()=>[JSON.stringify({...record,editRevision:2})]).update({id:'r1',revision:0},'owner'),/已被修改/);});

test('cloud SQL bridge may omit UPDATE returning rows; readback confirms own write',async()=>{let calls=0;const m=load(async sql=>{calls++;if(calls===1)return [JSON.stringify(record)];if(calls===2)return null;assert.match(sql,/editRequestId/);return [JSON.stringify({...record,amount:75,kcal:174,editRevision:1})];});const r=await m.update({id:'test',revision:0,quantity:'3',portionId:'household'},'owner');assert.equal(r.kcal,174);assert.equal(calls,3);});
const meal={foodName:'米饭、鸡腿',amount:300,kcal:500,photoFileID:'keep-photo',items:[{name:'米饭',grams:100,kcal:120,proteinG:3,carbG:25,fatG:1},{name:'鸡腿',grams:200,kcal:380,proteinG:30,carbG:0,fatG:20}]};
test('photo items edit independently, preserve densities and reject incomplete/tampered input',()=>{
 const edits=editor.initialItems(meal);edits[0].quantity='50';
 const p=editor.calculateItems(meal,edits);assert.equal(p.kcal,440);assert.equal(p.amount,250);assert.equal(p.proteinG,31.5);assert.equal(p.items[1].grams,200);assert.equal(p.items[1].kcal,380);assert.equal(meal.items[0].grams,100);
 const next=editor.initialItems({...meal,...p});next[0].quantity='100';assert.equal(editor.calculateItems({...meal,...p},next).kcal,500);
 assert.equal(editor.calculateItems(meal,edits.slice(1)),null);assert.equal(editor.calculateItems(meal,[edits[1],edits[0]]),null);assert.equal(editor.calculateItems(meal,[{...edits[0],portionId:'fake'},edits[1]]),null);assert.equal(editor.calculateItems(meal,[{...edits[0],quantity:'0'},edits[1]]),null);
 edits[0].portionId='参考';edits[0].quantity='2';const bowls=editor.calculateItems(meal,edits);assert.equal(bowls.items[0].grams,372);assert.equal(bowls.items[1].grams,200);
 const scaled=editor.calculate(meal,{portionId:'meal',quantity:'0.5'});const migrated=editor.calculateItems({...meal,...scaled},editor.initialItems({...meal,...scaled}));assert.equal(migrated.kcal,250);assert.equal(migrated.amount,150);
});
test('server independently calculates item totals and retains atomic owned update',async()=>{
 let patch;let count=0;
 const m=load(async sql=>{count++;if(count===1)return [JSON.stringify(meal)];if(count===2){patch=JSON.parse(sql.split('SET data=data || ')[1].split(' WHERE id=')[0]);return null;}return [JSON.stringify({...meal,...patch})];});
 const edits=editor.initialItems(meal);edits[0].quantity='50';const saved=await m.update({id:'photo-test',revision:0,itemEdits:edits,kcal:1},'owner');assert.equal(saved.kcal,440);assert.equal(saved.photoFileID,'keep-photo');assert.equal(saved.items[1].kcal,380);assert.equal(saved.editRevision,1);
});
test('original identified portion supports half servings and retains fractional unedited nutrition',()=>{
 const r={items:[{name:'卤鸡腿',grams:100,kcal:166.7,proteinG:20},{name:'米饭',grams:100,kcal:115,proteinG:3}]};
 const edits=editor.initialItems(r);assert.ok(edits[0].options.some(o=>o.id==='original-item'));
 edits[1].quantity='50';let p=editor.calculateItems(r,edits);assert.equal(p.items[0].kcal,166.7);
 edits[0].portionId='original-item';edits[0].quantity='0.5';p=editor.calculateItems(r,edits);assert.equal(p.items[0].grams,50);
 const again=editor.initialItems({...r,...p});assert.equal(again[0].quantity,'0.5');assert.equal(again[0].portionId,'original-item');again[0].quantity='1';assert.equal(editor.calculateItems({...r,...p},again).items[0].grams,100);
});
