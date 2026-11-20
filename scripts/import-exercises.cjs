// Rebuild from the reviewed upstream JSON; no media or executable upstream code.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const raw=fs.readFileSync(path.join(root,'reports/exercise-library/upstream.json'));
const source=JSON.parse(raw);
const seen=new Set();
const items=source.map(x=>{
 if(!/^\d{4}$/.test(x.id)||seen.has(x.id)||!x.name||!Array.isArray(x.instruction_steps.zh)||!x.instruction_steps.zh.length)throw Error('Invalid or duplicate exercise '+x.id);
 seen.add(x.id);
 return {id:x.id,name:x.name,body:x.body_part,equipment:x.equipment,target:x.target,steps:x.instruction_steps.zh};
});
const out=path.join(root,'miniprogram/data');fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'exercises.js'),'// Non-media exercise data. See exercise-license.js.\nmodule.exports='+JSON.stringify(items)+';\n');
const license=fs.readFileSync(path.join(root,'reports/exercise-library/LICENSE'),'utf8');
fs.writeFileSync(path.join(out,'exercise-license.js'),'module.exports='+JSON.stringify(license)+';\n');
fs.writeFileSync(path.join(root,'reports/exercise-library/import-manifest.json'),JSON.stringify({source:'https://github.com/hasaneyldrm/exercises-dataset',downloaded:'2026-11-19',sha256:crypto.createHash('sha256').update(raw).digest('hex'),count:items.length,fields:['id','name','body_part','equipment','target','instruction_steps.zh'],mediaIncluded:false,license:'MIT (non-media only)'},null,2));
console.log('Imported '+items.length+' exercises, '+fs.statSync(path.join(out,'exercises.js')).size+' bytes');
