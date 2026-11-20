// Shared with the server: all nutrient values describe the displayed portion, not 100g.
function normalize(items){
 if(!Array.isArray(items)||items.length<1||items.length>8)throw Error('请保留 1～8 种食物');
 return items.map(x=>{
  if(!x||typeof x.name!=='string'||!x.name.trim())throw Error('请填写食物名称');
  const out={name:x.name.trim().slice(0,60)};
  for(const [key,min,max] of [['grams',1,3000],['kcal',0,5000],['proteinG',0,1000],['carbG',0,1000],['fatG',0,1000]]){
   const v=x[key];if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error(key==='grams'?'分量需为 1～3000 克':'热量或营养素数值无效');out[key]=Math.round(v*10)/10;
  }
  return out;
 });
}
function totals(items){const sum={grams:0,kcal:0,proteinG:0,carbG:0,fatG:0};normalize(items).forEach(x=>Object.keys(sum).forEach(k=>sum[k]+=x[k]));Object.keys(sum).forEach(k=>sum[k]=Math.round(sum[k]*10)/10);return sum;}
function resize(item,grams){const n=Number(grams);if(!Number.isFinite(n)||n<1||n>3000)throw Error('分量需为 1～3000 克');const ratio=n/item.grams;const out={...item,grams:n};for(const k of ['kcal','proteinG','carbG','fatG'])out[k]=Math.round(item[k]*ratio*10)/10;return normalize([out])[0];}
module.exports={normalize,totals,resize};
