const data = require('./catalog.json');
const synonyms = [['西红柿','番茄'],['蕃茄','番茄'],['土豆','马铃薯'],['地瓜','红薯'],['甘薯','红薯'],['青花菜','西兰花'],['西蓝花','西兰花'],['菠萝','凤梨'],['奇异果','猕猴桃'],['牛油果','酪梨'],['桔子','橘子'],['柳橙','橙子'],['优酪乳','酸奶']];
function normalize(value) {
 let text=String(value||'').toLowerCase().split('').map(c=>data.characters[c]||c).join('').replace(/[\s（）()·、，,]/g,'');
 synonyms.forEach(([from,to])=>{text=text.split(from).join(to);});return text;
}
function key(f){return f.source==='custom' ? 'custom:'+f._id : normalize(f.name)+'|'+(f.unit||'100g');}
function merge(primary, secondary=data.foods){
 // Retire old generated snapshots. Current curated values win over unversioned database/cache rows.
 const current=secondary.filter(f=>f.origin==='tfda2025');
 const inputs=[...(primary||[]).filter(f=>f.source==='custom'),...current,...(primary||[]).filter(f=>f.source!=='custom' && !(current.length && f.origin==='tfda2025')),...secondary.filter(f=>f.origin!=='tfda2025')];
 const out=[],seen=new Set();for(const f of inputs){if(!f||f.origin==='tfda2015'||String(f._id||'').startsWith('tfda2015_')||!f.name||!Number.isFinite(Number(f.kcal))||Number(f.kcal)<0)continue;const k=key(f);if(!seen.has(k)){seen.add(k);out.push(f);}}return out;
}
function search(foods, keyword='', cat='全部', limit=100, offset=0){
 const q=normalize(keyword),tokens=q.split(/[+\/]/).filter(Boolean);
 const ranked=[];foods.forEach((f,i)=>{if(cat&&cat!=='全部'&&f.cat!==cat)return;const names=[f.name,...(f.aliases||[])].map(normalize);if(q&&!names.some(n=>n.includes(q))&&!tokens.every(t=>names.some(n=>n.includes(t))))return;
 const score=(q&&names[0]===q?150:q&&names.slice(1).some(n=>n===q)?120:q&&names[0].startsWith(q)?80:0)+(f.source==='custom'?10:0)+(f.origin==='tfda2025'?5:0);ranked.push({f,i,score});});
 ranked.sort((a,b)=>b.score-a.score||a.i-b.i);
 const start=Math.max(0,Number(offset)||0),size=Math.max(1,Math.min(5000,Number(limit)||100));
 return {foods:ranked.slice(start,start+size).map(x=>x.f),total:ranked.length};
}
function questionKeywords(question){
 const q=normalize(question),matches=new Set();
 for(const f of data.foods)for(const name of [f.name,...(f.aliases||[])]){const n=normalize(name);if(n.length>=2&&q.includes(n))matches.add(n);}
 const longest=[...matches].sort((a,b)=>b.length-a.length);
 return longest.filter(n=>!longest.some(other=>other!==n&&other.includes(n))).slice(0,3);
}
module.exports={questionKeywords,foods:merge([],data.foods),meta:data.meta,normalize,merge,search};
