const test=require('node:test'),assert=require('node:assert/strict');
const p=require('../miniprogram/utils/food-portions');
test('portions preserve food form, edible weights and volume units',()=>{
 const apple={name:'苹果',unit:'100g',kcal:52};const opts=p.options(apple);assert.equal(opts[0].unit,'g');assert.equal(opts[2].amount,182);assert.equal(p.calculate(apple,opts[2],'0.5').amount,91);
 for(const name of ['苹果汁','香蕉干','苹果派','橘子罐头','鸡蛋炒饭','生米'])assert.equal(p.options({name,unit:'100g'}).length,1,name);
 assert.equal(p.options({name:'苹果',source:'custom'}).length,1);
 const drink={name:'牛奶',unit:'100ml',kcal:60};assert.equal(p.calculate(drink,p.options(drink)[1],'1').amountUnit,'ml');assert.equal(p.calculate(drink,p.options(drink)[1],'1').kcal,150);
 assert.equal(p.options({name:'米饭（熟）'})[1].amount,186);
});
test('invalid quantities cannot produce a record and absent macros remain absent',()=>{
 const food={name:'苹果',kcal:52},o=p.options(food)[0];for(const x of ['','0','-1','Infinity','1e309','1kg','1,5','100001'])assert.equal(p.calculate(food,o,x),null);
 assert.equal('proteinG' in p.calculate(food,o,'100'),false);
});

test('common household portions cover meals without confusing food preparation',()=>{
 for(const [name,unit,grams] of [['饺子（猪肉）','个',25],['包子（猪肉）','个',80],['全麦面包','片',28],['粥（白米）','碗',250],['鸡胸肉（煎）','份',100],['番茄炒蛋','份',200],['蛋白','个',33],['燕麦粥','碗',234]]){const option=p.options({name,unit:'100g',kcal:100})[1];assert.equal(option.unit,unit,name);assert.equal(option.amount,grams,name);assert.equal(p.calculate({kcal:100},option,'0.5').amount,grams/2);}
 for(const name of ['燕麦片（干）','小米（生）','香蕉干','番茄汁','鸡胸肉粉','饺子皮'])assert.equal(p.options({name,unit:'100g'}).length,1,name);
 const options=p.options({name:'饺子（猪肉）'});assert.equal(options[1].basis,'estimate');assert.equal(options[1].source,'');assert.equal(p.options({name:'燕麦粥'})[1].basis,'reference');
});
