const {query,str}=require('./fitdb');
async function annotate(docs,openid){
 const ids=[...new Set(docs.flatMap(d=>d.savedMeal&&Array.isArray(d.savedMeal.ids)?d.savedMeal.ids:[]))];if(!ids.length)return docs;
 const rows=await query(`SELECT id FROM public.fit_diet_records WHERE data->>'openid'=${str(openid)} AND id IN (${ids.map(str).join(',')})`);
 const found=new Set(rows.map(r=>r[0]));return docs.map(d=>{if(!d.savedMeal||!Array.isArray(d.savedMeal.ids))return d;const remaining=d.savedMeal.ids.filter(id=>found.has(id)).length;return {...d,savedMeal:{...d.savedMeal,remaining,status:remaining===0?'deleted':remaining<d.savedMeal.ids.length?'partial':'active'}};});
}
module.exports={annotate};
