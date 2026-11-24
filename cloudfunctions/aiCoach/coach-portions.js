const portions=require('./food-portions');
const catalog=require('./food-catalog/index.js');
const service=require('./food-service');
const VERSION='2026-11-24-household-v3';
function describe(f){return {id:f._id,name:f.name,kcalPer100:f.kcal,unit:f.unit,portions:portions.options(f),detail:f.detail};}
async function calculate(openid,args){
 const snapshot=await service.load(openid);
 const food=snapshot.foods.find(f=>f._id===args.foodId);
 if(!food)return {error:'食物编号不存在，请先search_food获取当前账号的食物编号'};
 const option=portions.options(food).find(o=>o.id===args.portionId);
 if(!option)return {error:'该食物不支持此份量单位，请使用search_food返回的portionId，不可自造克数'};
 const value=portions.calculate(food,option,String(args.quantity));
 if(!value)return {error:'数量无效，必须大于0且在合理范围内'};
 return {foodSnapshot:{name:food.name,unit:food.unit,kcal:food.kcal,protein:food.protein,carb:food.carb,fat:food.fat},portionOptions:portions.options(food),portionId:option.id,foodId:food._id,name:food.name,quantity:Number(args.quantity),...value,perPortion:option.amount,portionUnit:option.label,hint:option.hint,note:option.note,source:option.source||'',estimated:option.id!=='base',foodVersion:catalog.meta.version,portionVersion:VERSION,recordSaved:false};
}
function number(text){
 if(text==='半')return 0.5;if(/^\d+(\.\d+)?$/.test(text))return Number(text);
 const digits={'零':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};
 if(text.includes('十')){const [a,b]=text.split('十');return (a?digits[a]:1)*10+(b?digits[b]:0);}
 return digits[text];
}
function requests(question){
 const aliases={'鸡蛋':'鸡蛋平均值','水煮蛋':'鸡蛋（煮）','水煮鸡蛋':'鸡蛋（煮）','白煮蛋':'鸡蛋（煮）','茶叶蛋':'茶叶蛋平均值','卤蛋':'卤蛋平均值','饺子':'饺子','饭':'米饭（熟）','米饭':'米饭（熟）','白米饭':'米饭（熟）','白饭':'米饭（熟）'};
 const names=[...new Set([...Object.keys(aliases),...catalog.foods.flatMap(f=>[f.name,...(f.aliases||[])])])].sort((a,b)=>b.length-a.length);
 const re=/(半|\d+(?:\.\d+)?|[一二两三四五六七八九十]{1,3})\s*(个|枚|碗|份|片|根|块|串|只|把|勺|杯|克|毫升|g|ml)\s*(半)?\s*(?:的)?\s*/g;
 const out=[];let m;while((m=re.exec(question))&&out.length<5){if(m.index>0&&/[-\d.]/.test(question[m.index-1]))continue;const tail=question.slice(re.lastIndex);const name=names.find(n=>tail.startsWith(n));if(!name)continue;const quantity=number(m[1])+(m[3]?0.5:0);if(quantity>0)out.push({keyword:aliases[name]||name,quantity,unit:m[2]==='枚'?'个':m[2],phrase:m[0]+name});}
 return out;
}
async function ground(question,openid){
 const out=[];
 for(const req of requests(question)){
  const found=await service.search(openid,req.keyword,'全部',12);
  const candidates=[];
  for(const f of found.foods){
   const choices=portions.options(f).filter(o=>o.unit===req.unit||(o.id==='base'&&((req.unit==='克'&&o.unit==='g')||(req.unit==='毫升'&&o.unit==='ml'))));
   // No silent choice between small, medium and large.
   for(const option of choices){const result=portions.calculate(f,option,String(req.quantity));if(result)candidates.push({foodSnapshot:{name:f.name,unit:f.unit,kcal:f.kcal,protein:f.protein,carb:f.carb,fat:f.fat},portionOptions:portions.options(f),name:f.name,foodId:f._id,portionId:option.id,quantity:req.quantity,...result,perPortion:option.amount,unit:option.label,hint:option.hint,note:option.note,estimated:option.id!=='base'});}
   if(candidates.length>=6)break;
  }
  out.push({...req,candidates:candidates.slice(0,6),note:'候选不是实际摄入记录；品种、大小或做法不明确时须说明假设或询问，不能把多个候选累加。'});
 }
 return {portionVersion:VERSION,items:out,recordSaved:false};
}
module.exports={calculate,describe,requests,ground,VERSION};
