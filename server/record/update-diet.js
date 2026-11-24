const {one,str,jsonb}=require('./fitdb');
const editor=require('./record-editor');
async function update(input,openid){
 if(!input||typeof input.id!=='string'||!Number.isInteger(input.revision)||input.revision<0)throw Error('记录参数无效，请刷新重试');
 const owner=`data->>'openid'=${str(openid)}`;
 const row=await one(`SELECT data::text FROM public.fit_diet_records WHERE id=${str(input.id)} AND ${owner}`);
 if(!row)throw Error('记录不存在或已删除');const record=JSON.parse(row[0]);
 if((record.editRevision||0)!==input.revision)throw Error('记录已被修改，请刷新后重试');
 const patch=(input.itemEdits!==undefined?editor.calculateItems(record,input.itemEdits):editor.calculate(record,{portionId:input.portionId,quantity:input.quantity}));if(!patch||patch.amount>12000||patch.kcal>12000)throw Error('数量或份量无效');
 patch.editRevision=input.revision+1;patch.updatedAt=Date.now();patch.editRequestId=require('crypto').randomBytes(16).toString('hex');
 await one(`UPDATE public.fit_diet_records SET data=data || ${jsonb(patch)} WHERE id=${str(input.id)} AND ${owner} AND COALESCE((data->>'editRevision')::int,0)=${input.revision} RETURNING data::text`);
 const saved=await one(`SELECT data::text FROM public.fit_diet_records WHERE id=${str(input.id)} AND ${owner} AND data->>'editRequestId'=${str(patch.editRequestId)}`);
 if(!saved)throw Error('记录已改变，请刷新后重试');return {_id:input.id,...JSON.parse(saved[0])};
}
module.exports={update};
