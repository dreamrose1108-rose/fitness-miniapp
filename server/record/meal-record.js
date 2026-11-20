const crypto=require('crypto');
const {one,str,jsonb}=require('./fitdb');
const {ownedPhoto,objectCall}=require('./photos');
const {normalize,totals}=require('./meal-estimate');
async function save(input,openid){
 if(!input||!ownedPhoto(input.photoFileID,openid))throw Error('照片无效或不属于当前用户');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(input.date||'')||!Number.isFinite(Date.parse(input.date))||new Date(input.date).toISOString().slice(0,10)!==input.date)throw Error('日期无效');
 if(!['breakfast','lunch','dinner','snack'].includes(input.mealType))throw Error('餐次无效');
 const items=normalize(input.items),sum=totals(items);
 if(sum.kcal>12000||sum.grams>12000)throw Error('餐食总量过大，请拆分记录');
 const id='meal_'+crypto.createHash('sha256').update(openid+':'+input.photoFileID).digest('hex').slice(0,32);
 // One photo represents one confirmed meal; stable ID makes network retries idempotent.
 const existing=await one(`SELECT data::text FROM public.fit_diet_records WHERE id=${str(id)} AND data->>'openid'=${str(openid)}`);
 if(existing)return {id,alreadySaved:true};
 await objectCall('headObject',input.photoFileID);
 const data={openid,createdAt:Date.now(),date:input.date,mealType:input.mealType,foodName:items.map(x=>x.name).join('、'),amount:sum.grams,kcal:Math.round(sum.kcal),proteinG:sum.proteinG,carbG:sum.carbG,fatG:sum.fatG,photoFileID:input.photoFileID,items,calorieSource:'photo_ai_confirmed',estimated:true};
 await one(`INSERT INTO public.fit_diet_records (id,data) VALUES (${str(id)},${jsonb(data)}) ON CONFLICT (id) DO NOTHING`);
 const saved=await one(`SELECT id FROM public.fit_diet_records WHERE id=${str(id)} AND data->>'openid'=${str(openid)}`);
 if(!saved)throw Error('餐食未保存，请重试');
 return {id,alreadySaved:false};
}
module.exports={save};
