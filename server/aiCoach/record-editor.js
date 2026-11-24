const portions=require('./food-portions');
function definition(record){
 if(record.portionBasis)return record.portionBasis;
 if(!Number.isFinite(record.amount)||record.amount<=0||!Number.isFinite(record.kcal))throw Error('原记录份量无效，无法换算');
 const food={name:record.foodName,unit:record.amountUnit==='ml'?'100ml':'100g',kcal:record.kcal*100/record.amount};
 for(const [src,dst] of [['proteinG','protein'],['carbG','carb'],['fatG','fat']])if(Number.isFinite(record[src]))food[dst]=record[src]*100/record.amount;
 let options=portions.options(food);
 if(Array.isArray(record.items)&&record.items.length)options=[options[0],{id:'meal',label:'份（原餐食）',unit:'份',amount:record.amount,note:'一份等于原记录整餐；按相同比例调整各食物，不能代表只改变某一道菜'}];
 return {food,options,originalAmount:record.amount,originalItems:Array.isArray(record.items)?record.items:null};
}
function initial(record){const basis=definition(record);const label=String(record.portionLabel||'');const option=basis.options.find(o=>o.id!=='base'&&label.endsWith(o.label))||basis.options[0];return {basis,portionId:option.id,quantity:String(Math.round(record.amount/option.amount*10000)/10000)};}
function calculate(record,edit){const basis=definition(record);const option=basis.options.find(o=>o.id===edit.portionId);if(!option)return null;const result=portions.calculate(basis.food,option,edit.quantity);if(!result)return null;const patch={...result,portionBasis:basis};if(basis.originalItems){const ratio=result.amount/basis.originalAmount;patch.items=basis.originalItems.map(item=>{const out={...item};for(const key of ['grams','kcal','proteinG','carbG','fatG'])if(Number.isFinite(item[key]))out[key]=Math.round(item[key]*ratio*100)/100;return out;});}return patch;}
module.exports={definition,initial,calculate};
