const portions=require('./food-portions');
function definition(c){
 if(c.foodSnapshot&&Array.isArray(c.portionOptions))return {food:c.foodSnapshot,options:c.portionOptions};
 const food={name:c.name,unit:c.amountUnit==='ml'?'100ml':'100g',kcal:c.kcal*100/c.amount};
 for(const [src,dst] of [['proteinG','protein'],['carbG','carb'],['fatG','fat']])if(Number.isFinite(c[src]))food[dst]=c[src]*100/c.amount;
 const base=c.amountUnit==='ml'?'ml':'g';const options=[{id:'base',label:base==='ml'?'毫升（ml）':'克（g）',unit:base,amount:1}];
 if(c.perPortion>0&&(c.portionId!=='base')&&(c.unit||c.portionUnit))options.push({id:c.portionId||'original',label:c.portionUnit||c.unit,unit:c.portionUnit||c.unit,amount:c.perPortion,note:c.note});
 return {food,options};
}
function initial(c){const d=definition(c);const id=c.portionId||d.options.find(o=>o.id!=='base')?.id||'base';return {portionId:id,quantity:String(id==='base'?c.amount:c.quantity||c.amount/d.options.find(o=>o.id===id).amount)};}
function calculate(c,edit){const d=definition(c);const option=d.options.find(o=>o.id===edit.portionId);if(!option)return null;return portions.calculate(d.food,option,edit.quantity);}
function state(c,edit){const d=definition(c),e=edit||initial(c);return {...e,options:d.options,optionIndex:d.options.findIndex(o=>o.id===e.portionId),result:calculate(c,e)};}
module.exports={definition,initial,calculate,state};
