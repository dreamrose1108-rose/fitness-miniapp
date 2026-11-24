const {one,str,jsonb}=require('./fitdb');
const crypto=require('crypto');
function prepare(draft,input,openid){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(input.date||'')||!Number.isFinite(Date.parse(input.date))||new Date(input.date).toISOString().slice(0,10)!==input.date)throw Error('日期无效');
 if(!['breakfast','lunch','dinner','snack'].includes(input.mealType))throw Error('餐次无效');
 if(!draft||!Array.isArray(draft.items)||!draft.items.length||draft.items.length>10||!Array.isArray(input.choices)||input.choices.length!==draft.items.length)throw Error('饮食草稿无效');
 const rows=draft.items.map((item,i)=>{const choice=input.choices[i];if(!Number.isInteger(choice)||choice<0)throw Error('请选择食物份量');let f=item.candidates[choice];if(input.edits!==undefined){if(!Array.isArray(input.edits)||input.edits.length!==draft.items.length||!f)throw Error('份量修改无效');const result=require('./meal-editor').calculate(f,input.edits[i]||{});if(!result)throw Error('请输入有效数量和份量');f={...f,...result};}if(!f||!f.name||!Number.isFinite(f.amount)||f.amount<=0||!Number.isFinite(f.kcal)||f.kcal<0||!['g','ml'].includes(f.amountUnit))throw Error('食物份量无效');const data={openid,date:input.date,mealType:input.mealType,foodName:f.name,amount:f.amount,amountUnit:f.amountUnit,portionLabel:f.portionLabel!==undefined?f.portionLabel:String(f.quantity)+(f.portionUnit||f.unit||''),kcal:f.kcal,estimated:true,calorieSource:'coach_confirmed',coachDraftId:input.draftId,createdAt:Date.now()};for(const k of ['proteinG','carbG','fatG'])if(Number.isFinite(f[k])&&f[k]>=0)data[k]=f[k];return {id:'coachmeal_'+crypto.createHash('sha256').update(openid+':'+input.draftId+':'+i).digest('hex').slice(0,32),data};});
 if(rows.reduce((s,r)=>s+r.data.kcal,0)>12000||rows.some(r=>r.data.amount>12000))throw Error('餐食总量过大，请拆分记录');return rows;
}
async function save(input,openid){
 if(!input||typeof input.draftId!=='string'||input.draftId.length>100)throw Error('饮食草稿无效');
 const row=await one(`SELECT data::text FROM public.fit_coach_chats WHERE id=${str(input.draftId)} AND data->>'openid'=${str(openid)} AND data->>'role'='assistant'`);
 if(!row)throw Error('饮食草稿不存在或不属于当前用户');const chat=JSON.parse(row[0]);
 if(chat.savedMeal)return {...chat.savedMeal,alreadySaved:true};
 const rows=prepare(chat.mealDraft,input,openid);const saved={date:input.date,mealType:input.mealType,ids:rows.map(r=>r.id),count:rows.length,choices:input.choices,edits:input.edits||null,items:rows.map(r=>({foodName:r.data.foodName,amount:r.data.amount,amountUnit:r.data.amountUnit,portionLabel:r.data.portionLabel,kcal:r.data.kcal}))};
 // Lock the owned draft; insert all foods and mark the chat in one atomic SQL statement.
 await one(`WITH owned AS (SELECT id FROM public.fit_coach_chats WHERE id=${str(input.draftId)} AND data->>'openid'=${str(openid)} AND NOT (data ? 'savedMeal') FOR UPDATE), inserted AS (INSERT INTO public.fit_diet_records (id,data) SELECT v.id,v.data FROM (VALUES ${rows.map(r=>`(${str(r.id)},${jsonb(r.data)})`).join(',')}) AS v(id,data) WHERE EXISTS(SELECT 1 FROM owned) ON CONFLICT(id) DO NOTHING RETURNING id) UPDATE public.fit_coach_chats SET data=data || ${jsonb({savedMeal:saved})} WHERE id IN(SELECT id FROM owned) AND (SELECT count(*) FROM inserted)>=0 RETURNING id`);
 const confirmed=await one(`SELECT data->'savedMeal' FROM public.fit_coach_chats WHERE id=${str(input.draftId)} AND data->>'openid'=${str(openid)}`);if(!confirmed||!confirmed[0])throw Error('餐食未保存，请重试');return typeof confirmed[0]==='string'?JSON.parse(confirmed[0]):confirmed[0];
}
module.exports={save,prepare};
