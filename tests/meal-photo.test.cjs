const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const meal = require('../miniprogram/utils/meal-estimate');
const food = {name:'米饭',grams:100,kcal:120,proteinG:3,carbG:26,fatG:0.5};
function load(file, mocks, globals={}) {
  const module={exports:{}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{module,exports:module.exports,require:n=>n in mocks?mocks[n]:require(n),Buffer,process,setTimeout,clearTimeout,...globals});
  return module.exports;
}
function page(call=async()=>({hasFood:true,items:[food],notes:'估算'})) {
  let p;const deleted=[];
  load('miniprogram/pages/meal-review/meal-review.js',{'../../utils/cloud':{call},'../../utils/photos':{deletePhoto:async id=>deleted.push(id)},'../../utils/meal-estimate':meal},{Page:x=>p=x,wx:{showToast(){},navigateBack(){}},getApp:()=>({login:async()=>true})});
  p.setData=data=>Object.assign(p.data,data);
  p.context={fileID:'owned-photo',localPath:'local',date:'2026-11-20',mealType:'lunch'};
  return {p,deleted};
}
const event=(value,index=0)=>({currentTarget:{dataset:{index}},detail:{value}});
test('portion scaling keeps nutrition proportional; malformed values never become zero',()=>{
  assert.equal(meal.resize(food,150).kcal,180);
  assert.equal(meal.totals([food,food]).proteinG,6);
  for(const x of [NaN,Infinity,-1,'120'])assert.throws(()=>meal.normalize([{...food,kcal:x}]));
  assert.throws(()=>meal.normalize([]));
});
test('vision parses wrapped JSON and distinguishes nonfood from failed recognition',()=>{
  const vision=load('server/aiCoach/meal-vision.js',{'./meal-photos':{},'./meal-estimate':meal});
  assert.equal(vision.parse('```json\n'+JSON.stringify({hasFood:true,foods:[food]})+'\n```').items[0].kcal,120);
  assert.equal(vision.parse('{"hasFood":false,"foods":[]}').items.length,0);
  for(const input of ['bad','{}','{"hasFood":true,"foods":[]}'])assert.throws(()=>vision.parse(input));
});
test('photo ownership checked before contacting vision provider',async()=>{
  const vision=load('server/aiCoach/meal-vision.js',{'./meal-photos':{handlePhoto:async()=>{throw Error('foreign photo');}},'./meal-estimate':meal,https:{request(){assert.fail('must not call provider');}}});
  await assert.rejects(vision.analyze('foreign','owner'),/foreign/);
});
test('review can recover invalid grams and updates totals/removal',async()=>{
  const {p}=page();await p.analyze();p.grams(event(''));assert.equal(p.data.totals,null);
  p.grams(event('150'));assert.equal(p.data.totals.kcal,180);assert.equal(p.data.items[0].grams,150);
  p.remove(event(''));assert.equal(p.data.totals,null);
});
test('recognition failure leaves no invented calories',async()=>{
  const {p}=page(async()=>{throw Error('offline');});await p.analyze();assert.equal(p.data.items.length,0);assert.equal(p.data.totals,null);assert.match(p.data.error,/offline/);
});
test('save sends photoFileID, captured date/meal and immutable retry payload',async()=>{
  const calls=[];const {p,deleted}=page(async(n,v)=>{calls.push(v);if(calls.length===1)throw Error('timeout');return {alreadySaved:true};});
  p.data.items=[food];await p.save();assert.equal(p.data.locked,true);assert.equal(calls[0].data.photoFileID,'owned-photo');assert.equal(calls[0].data.date,'2026-11-20');assert.equal(calls[0].data.mealType,'lunch');
  p.context.mealType='dinner';p.edit({currentTarget:{dataset:{index:0,field:'kcal'}},detail:{value:999}});await p.save();assert.equal(calls[1].data,calls[0].data);assert.equal(calls[1].data.items[0].kcal,120);p.onUnload();assert.equal(deleted.length,0);
});
test('leaving before confirmation cleans photo; in-flight save preserves it',()=>{
  const a=page();a.p.onUnload();assert.equal(a.deleted.length,1);
  const b=page();b.p.data.saving=true;b.p.onUnload();assert.equal(b.deleted.length,0);
});
test('large photo is compressed before HTTP upload; oversized output is not sent',async()=>{
  let uploaded=0,compressions=0,small=true;
  const photos=load('miniprogram/utils/photos.js',{'./cloud.js':{call:async(n,p)=>{uploaded++;assert.ok(p.base64.length<110000);return {fileID:'photo'};}}},{wx:{getFileSystemManager:()=>({readFile:o=>o.success({data:'a'.repeat(o.filePath==='small'&&small?50000:200000)})}),compressImage:async()=>{compressions++;return {tempFilePath:'small'};}}});
  await photos.uploadPhoto('large');assert.equal(uploaded,1);assert.equal(compressions,1);
  small=false;await assert.rejects(photos.uploadPhoto('large'),/压缩/);assert.equal(uploaded,1);
});
test('80 KiB photo must compress: base64 plus token stays below gateway body limit',async()=>{
  let compressed=false,bodyBytes=0;
  const photos=load('miniprogram/utils/photos.js',{'./cloud.js':{call:async(n,p)=>{bodyBytes=Buffer.byteLength(JSON.stringify({...p,token:'t'.repeat(4096)}));return {fileID:'photo'};}}},{wx:{
    getFileSystemManager:()=>({readFile:o=>o.success({data:Buffer.alloc(o.filePath==='original'?80*1024:64*1024-2).toString('base64')})}),
    compressImage:async()=>{compressed=true;return {tempFilePath:'compressed'};}
  }});
  await photos.uploadPhoto('original');assert.equal(compressed,true);assert.ok(bodyBytes<100*1024);
});
test('portrait scales by height; PNG falls back to JPEG canvas with bounded dimensions',async()=>{
  const sizes=[],exports=[];let uploaded;
  const canvas={width:1,height:1,createImage(){return {width:3000,height:6000,set src(v){this.onload();}};},getContext(){return {fillRect(){},drawImage(){}};}};
  const photos=load('miniprogram/utils/photos.js',{'./cloud.js':{call:async(n,p)=>{uploaded=p.base64;return {fileID:'photo'};}}},{wx:{
    getFileSystemManager:()=>({readFile:o=>o.success({data:'a'.repeat(o.filePath==='converted'?50000:200000)})}),
    getImageInfo:o=>o.success({width:3000,height:6000}),
    compressImage:async o=>{sizes.push(o);return {tempFilePath:'still-large-png'};},
    createSelectorQuery:()=>({select(){return this;},fields(){return this;},exec(fn){fn([{node:canvas}]);}}),
    canvasToTempFilePath:o=>{exports.push({...o});o.success({tempFilePath:'converted'});}
  }});
  await photos.uploadPhoto('large');assert.ok(sizes.every(x=>x.compressedHeight&&!x.compressedWidth));assert.equal(exports[0].destWidth,640);assert.equal(exports[0].destHeight,1280);assert.equal(exports[0].fileType,'jpg');assert.equal(uploaded.length,50000);assert.equal(canvas.width,1);
});
test('server aggregate is owned, idempotent and validates date/portion',async()=>{
  let stored,insertions=0,heads=0;
  const mod=load('server/record/meal-record.js',{'./meal-estimate':meal,'./photos':{ownedPhoto:(id,owner)=>id==='photo-'+owner,objectCall:async()=>{heads++;}},'./fitdb':{str:x=>JSON.stringify(x),jsonb:x=>{stored=x;return 'payload';},one:async sql=>{if(sql.startsWith('INSERT')){insertions++;return null;}return insertions?[['saved']]:null;}}});
  const input={photoFileID:'photo-alice',date:'2026-11-20',mealType:'lunch',items:[food,{...food,name:'第二份'}]};
  const first=await mod.save(input,'alice');const again=await mod.save(input,'alice');assert.equal(first.id,again.id);assert.equal(again.alreadySaved,true);assert.equal(insertions,1);assert.equal(heads,1);assert.equal(stored.openid,'alice');assert.equal(stored.kcal,240);assert.equal(stored.proteinG,6);assert.equal(stored.estimated,true);
  await assert.rejects(mod.save(input,'bob'),/照片/);await assert.rejects(mod.save({...input,date:'2026-02-30'},'alice'),/日期/);await assert.rejects(mod.save({...input,items:[]},'alice'),/食物/);
});
