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
// Per-item bases preserve the original AI estimate across repeated edits.
function itemRecord(item){
 const record={...item,foodName:item.name,amount:item.grams,amountUnit:'g'};
 const basis=definition(record);
 if(!basis.options.some(o=>o.id==='original-item'))record.portionBasis={...basis,options:[...basis.options,{id:'original-item',label:'份（原识别份量）',unit:'份',amount:basis.originalAmount,note:'一份等于照片中该食物的原识别重量，可填0.5份；识别重量为估算'}]};
 return record;
}
function initialItems(record){
 if(!Array.isArray(record.items)||!record.items.length)throw Error('餐食份量无效');
 return record.items.map((item,index)=>{const state=initial(itemRecord(item));return {index,name:item.name,options:state.basis.options,portionId:state.portionId,quantity:state.quantity,unitIndex:state.basis.options.findIndex(o=>o.id===state.portionId)};});
}
function calculateItems(record,edits){
 if(!Array.isArray(record.items)||!record.items.length||!Array.isArray(edits)||edits.length!==record.items.length)return null;
 const items=[];
 for(let i=0;i<edits.length;i++){
  if(!edits[i]||edits[i].index!==i)return null;
  const item=record.items[i],result=calculate(itemRecord(item),edits[i]);
  if(!result)return null;
  if(result.amount===item.grams)for(const key of ['kcal','proteinG','carbG','fatG'])if(Number.isFinite(item[key]))result[key]=item[key];
  items.push({...item,grams:result.amount,kcal:result.kcal,portionLabel:result.portionLabel,portionBasis:result.portionBasis,...Object.fromEntries(['proteinG','carbG','fatG'].filter(k=>Number.isFinite(result[k])).map(k=>[k,result[k]]))});
 }
 const sum=key=>Math.round(items.reduce((n,x)=>n+(Number.isFinite(x[key])?x[key]:0),0)*100)/100;
 const patch={items,amount:sum('grams'),amountUnit:'g',kcal:sum('kcal'),portionLabel:'',portionBasis:null};
 for(const key of ['proteinG','carbG','fatG'])if(items.every(x=>Number.isFinite(x[key])))patch[key]=sum(key);else patch[key]=null;
 return patch;
}
module.exports={definition,initial,calculate,initialItems,calculateItems};
