const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const c=require('../shared/food-catalog');
test('public catalog is broad, numeric, unique and consistent in all deployed copies',()=>{
 assert.ok(c.foods.length>2000);assert.equal(new Set(c.foods.map(f=>f._id)).size,c.foods.length);
 for(const f of c.foods){assert.ok(Number.isFinite(Number(f.kcal))&&f.kcal>=0&&f.kcal<=950,f.name);assert.ok(['100g','100ml'].includes(f.unit),f.name);for(const k of ['protein','fat','carb'])if(f[k]!=null)assert.ok(Number.isFinite(Number(f[k]))&&f[k]>=0&&f[k]<=100,f.name+':'+k);}
 assert.deepEqual(require('../miniprogram/utils/food-catalog/catalog.js'),require('../shared/food-catalog/catalog.json'));
 const raw=fs.readFileSync('shared/food-catalog/catalog.json','utf8');for(const path of ['cloudfunctions/foodLib','cloudfunctions/aiCoach','server/aiCoach'])assert.equal(fs.readFileSync(path+'/food-catalog/catalog.json','utf8'),raw);
});
test('aliases preserve food form and units, missing macros stay missing',()=>{
 for(const q of ['桔子','橘子','土豆','西红柿','雞胸','牛奶','米饭','豆腐','面包','苹果','香蕉','坚果'])assert.ok(c.search(c.foods,q).total,q);
 const orange=c.search(c.foods,'橘子').foods[0];assert.equal(orange.kcal,44);assert.equal(orange.unit,'100g');
 assert.notEqual(c.normalize('花椰菜'),c.normalize('西兰花'));
 assert.notEqual(c.normalize('橙汁'),c.normalize('橙子'));
 assert.equal(c.merge([{name:'缺营养数据',kcal:1,unit:'100g',source:'official'}],[])[0].protein,undefined);
});
test('server catalog isolates private foods and merges public snapshot on database failure',async()=>{
 let owner;const src=fs.readFileSync('shared/food-catalog/service.js','utf8');const box={module:{exports:{}},require:n=>n==='./food-catalog'?c:{str:v=>"'"+v.replace(/'/g,"''")+"'",one:async sql=>{if(sql.includes("source'='official'"))return ['[]'];assert.match(sql,/ownerOpenid/);owner=sql;return [JSON.stringify([{_id:'a',name:'家常测试菜',kcal:88,unit:'100g',source:'custom',ownerOpenid:'A'}])];}},Date};vm.runInNewContext(src,box);const result=await box.module.exports.search('A','家常测试菜','全部');assert.equal(result.foods.length,1);assert.match(owner,/ownerOpenid'='A'/);assert.equal(result.foods[0].ownerOpenid,undefined);
 const fail={module:{exports:{}},require:n=>n==='./food-catalog'?c:{one:async()=>{throw Error('offline');},str:v=>"'"+v+"'"},Date};vm.runInNewContext(src,fail);const offline=await fail.module.exports.search('B','橘子','全部');assert.ok(offline.foods.length);assert.equal(offline.available,false);
});
