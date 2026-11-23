const test=require('node:test'),assert=require('node:assert/strict');
const library=require('../miniprogram/utils/exercise-library.js');
const base=require('../miniprogram/data/exercises.js');
const media=require('../miniprogram/data/exercise-media.js');
const audit=require('./fixtures/reference-audit.json');
const supplemental=require('./fixtures/supplemental-id-map.json');

test('1399 names and all three classification labels match the captured catalog',()=>{
  assert.equal(audit.complete,true);
  assert.equal(library.items.length,1399);
  for(const row of audit.mapped.concat(supplemental)){
    const item=library.get(row.id);
    assert.ok(item,row.id);
    assert.equal(item.displayName,row.name,row.id);
    assert.equal(item.bodyLabel,row.body,row.id);
    assert.equal(item.equipmentLabel,row.equipment,row.id);
    assert.equal(item.targetLabel,row.target,row.id);
  }
});
test('existing IDs, original names and instructions stay attached to the same action',()=>{
  for(const original of base){
    const item=library.get(original.id);
    assert.equal(item.name,original.name);
    assert.deepEqual(item.steps,original.steps);
    assert.equal(item.body,original.body);
    assert.equal(item.equipment,original.equipment);
    assert.equal(item.target,original.target);
  }
  for(const id of Object.keys(media)) assert.ok(base.some(x=>x.id===id),`media ${id} must retain its original action`);
});
test('body counts match the reference and equipment/muscle pickers reach every item',()=>{
  const counts={'upper arms':304,'upper legs':242,back:215,waist:177,chest:169,shoulders:163,'lower legs':61,'lower arms':37,cardio:29,neck:2};
  for(const [body,count]of Object.entries(counts))assert.equal(library.search({body}).length,count,body);
  for(const field of ['equipment','target']){
    const options=library[field+'Options'].slice(1);
    const ids=options.flatMap(option=>library.search({[field]:option.key}).map(x=>x.id));
    assert.equal(ids.length,1399,field);
    assert.equal(new Set(ids).size,1399,field);
    assert.equal(new Set(options.map(x=>x.label)).size,options.length,field+' duplicate labels');
  }
});
test('all Chinese names are searchable, including separately identified namesakes',()=>{
  for(const item of library.items)assert.ok(library.search({query:item.displayName}).some(x=>x.id===item.id),item.id);
  const namesakes=supplemental.filter(x=>x.name==='哑铃俯身反向飞鸟');
  assert.equal(namesakes.length,2);
  assert.notEqual(namesakes[0].id,namesakes[1].id);
  for(const row of namesakes)assert.ok(library.search({query:row.name}).some(x=>x.id===row.id));
});
test('supplemental IDs work with existing record validation and persistent favorites',()=>{
  let saved=['0662'];global.wx={getStorageSync:()=>saved,setStorageSync:(_,v)=>{saved=v;}};
  try{
    for(const item of supplemental){assert.match(item.id,/^\d{4}$/);assert.ok(!base.some(x=>x.id===item.id));assert.equal(library.get(item.id).steps.length,3);}
    assert.deepEqual(library.toggleFavorite('9000'),['0662','9000']);
    assert.deepEqual(library.readFavorites(),['0662','9000']);
  }finally{delete global.wx;}
});
