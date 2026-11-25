const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('home date refreshes on returning after midnight even if login is unavailable',async()=>{
 let definition,now=new Date(2026,10,24,23,59);const RealDate=Date;
 class Clock extends RealDate{constructor(...args){super(...(args.length?args:[now]));}}
 vm.runInNewContext(fs.readFileSync('miniprogram/pages/index/index.js','utf8'),{Page:p=>definition=p,getApp:()=>({login:async()=>false}),require:()=>({}),Date:Clock});
 const page={...definition,data:{},restoreTheme(){},setData(v){Object.assign(this.data,v);}};
 await page.onLoad();assert.match(page.data.todayLabel,/11月24日/);now=new Date(2026,10,25,0,1);await page.onShow();assert.match(page.data.todayLabel,/11月25日/);
});
test('changing plan steps returns to the first field instead of retaining the old scroll',()=>{
 let definition,calls=[];vm.runInNewContext(fs.readFileSync('miniprogram/pages/plans/plans.js','utf8'),{Page:p=>definition=p,require:()=>({weeks:[{}]}),wx:{pageScrollTo:x=>calls.push(x.scrollTop)}});
 const page={...definition,data:{stage:2},setData(v){Object.assign(this.data,v);}};
 page.settings();assert.equal(page.data.stage,1);page.templates();assert.equal(page.data.stage,0);assert.deepEqual(calls,[0,0]);
});
