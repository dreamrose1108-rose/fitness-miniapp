const test=require('node:test'),assert=require('node:assert/strict');
const p=require('../miniprogram/utils/food-portions');
test('portions preserve food form, edible weights and volume units',()=>{
 const apple={name:'苹果',unit:'100g',kcal:52};const opts=p.options(apple);assert.equal(opts[0].unit,'g');assert.equal(opts[2].amount,182);assert.equal(p.calculate(apple,opts[2],'0.5').amount,91);
 for(const name of ['苹果汁','香蕉干','苹果派','橘子罐头','鸡蛋炒饭','生米','蛋白'])assert.equal(p.options({name,unit:'100g'}).length,1,name);
 assert.equal(p.options({name:'苹果',source:'custom'}).length,1);
 const drink={name:'牛奶',unit:'100ml',kcal:60};assert.equal(p.calculate(drink,p.options(drink)[1],'1').amountUnit,'ml');assert.equal(p.calculate(drink,p.options(drink)[1],'1').kcal,150);
 assert.equal(p.options({name:'米饭（熟）'})[1].amount,186);
});
test('invalid quantities cannot produce a record and absent macros remain absent',()=>{
 const food={name:'苹果',kcal:52},o=p.options(food)[0];for(const x of ['','0','-1','Infinity','1e309','1kg','1,5','100001'])assert.equal(p.calculate(food,o,x),null);
 assert.equal('proteinG' in p.calculate(food,o,'100'),false);
});
