const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
for(const file of ['cloudfunctions/record/index.js','server/record/index.js'])test(file+' persists portion units and allows absent macros but rejects invalid values',async()=>{
 let saved;const exports={};const mocks={'./fitdb':{one:async()=>[],query:async()=>[],str:JSON.stringify,jsonb:d=>{saved=d;return 'json';},newId:()=> 'test'},'./photos':{},'./fitauth':{parseEvent:x=>x,getOpenid:()=> 'owner'}};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{exports,require:n=>mocks[n],console});
 const data={date:'2026-11-24',mealType:'breakfast',foodName:'香蕉',amount:59,kcal:53,amountUnit:'g',portionLabel:'0.5个（中）'};
 assert.equal((await exports.main({action:'add',type:'diet',data})).code,0);assert.equal(saved.portionLabel,data.portionLabel);assert.equal(saved.amountUnit,'g');assert.equal(saved.openid,'owner');assert.equal(saved.proteinG,undefined);
 for(const extra of [{amountUnit:'kg'},{portionLabel:'x'.repeat(41)},{proteinG:Infinity},{carbG:-1},{amount:0}])assert.equal((await exports.main({action:'add',type:'diet',data:{...data,...extra}})).code,-1);
});
