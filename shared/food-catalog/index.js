const data = require('./catalog.json');
const synonyms = [['西红柿','番茄'],['蕃茄','番茄'],['土豆','马铃薯'],['地瓜','红薯'],['甘薯','红薯'],['青花菜','西兰花'],['西蓝花','西兰花'],['菠萝','凤梨'],['奇异果','猕猴桃'],['牛油果','酪梨'],['桔子','橘子'],['柳橙','橙子'],['优酪乳','酸奶']];
function normalize(value) {
 let text=String(value||'').toLowerCase().split('').map(c=>data.characters[c]||c).join('').replace(/[\s（）()·、，,]/g,'');
 synonyms.forEach(([from,to])=>{text=text.split(from).join(to);});return text;
}
function key(f){return f.source==='custom' ? 'custom:'+f._id : normalize(f.name)+'|'+(f.unit||'100g');}
function merge(primary, secondary=data.foods){
 const out=[],seen=new Set();for(const f of [...(primary||[]),...secondary]){if(!f||!f.name||!Number.isFinite(Number(f.kcal))||Number(f.kcal)<0)continue;const k=key(f);if(!seen.has(k)){seen.add(k);out.push(f);}}return out;
}
function search(foods, keyword='', cat='全部', limit=100, offset=0){
 const q=normalize(keyword),tokens=q.split(/[+\/]/).filter(Boolean);
 const ranked=[];foods.forEach((f,i)=>{if(cat&&cat!=='全部'&&f.cat!==cat)return;const names=[f.name,...(f.aliases||[])].map(normalize);if(q&&!names.some(n=>n.includes(q))&&!tokens.every(t=>names.some(n=>n.includes(t))))return;
 const score=(q&&names.some(n=>n===q)?100:q&&names.some(n=>n.startsWith(q))?50:0)+(f.source==='custom'?20:0)+(f.origin==='existing'?5:0);ranked.push({f,i,score});});
 ranked.sort((a,b)=>b.score-a.score||a.i-b.i);
 const start=Math.max(0,Number(offset)||0),size=Math.max(1,Math.min(5000,Number(limit)||100));
 return {foods:ranked.slice(start,start+size).map(x=>x.f),total:ranked.length};
}
module.exports={foods:merge(data.foods,[]),meta:data.meta,normalize,merge,search};
