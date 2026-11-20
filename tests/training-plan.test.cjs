const test=require('node:test');
const assert=require('node:assert/strict');
const planner=require('../miniprogram/utils/training-plan.js');
const library=require('../miniprogram/utils/exercise-library.js');
const base={template:'full',level:'beginner',equipment:'dumbbell',focus:'all',days:3};
test('all supported configurations produce valid weekly schedules and equipment matches',()=>{
 let count=0;
 for(const t of planner.templates)for(const days of t.days)for(const level of ['beginner','regular'])for(const equipment of ['gym','dumbbell'])for(const f of planner.focuses){
  if(level==='beginner'&&t.id!=='full')continue;
  const p=planner.generate({template:t.id,days,level,equipment,focus:f.id});count++;
  assert.equal(p.weeks.length,4);
  for(const week of p.weeks){
  assert.equal(week.sessions.length,7);assert.equal(week.sessions.filter(s=>!s.rest).length,days);
  for(const s of week.sessions){
   assert.equal(new Set(s.exercises.map(x=>x.id)).size,s.exercises.length);
   if(!s.rest)assert.ok(s.minutes>0);
   for(const x of s.exercises){const item=library.get(x.id);assert.ok(item);assert.ok(x.sets>=1&&x.sets<=4);assert.ok(x.loadNote);if(equipment==='dumbbell')assert.ok(['dumbbell','body weight'].includes(item.equipment));}
  }
  for(const group of ['chest','back','legs','shoulders','core'])assert.ok(week.sessions.filter(s=>s.exercises.some(x=>x.group===group)).length>=2,group+' trained twice');
  }
 }assert.equal(count,84);
});
test('new lifters cannot receive a six-day split or invalid inputs',()=>{
 for(const patch of [{template:'ppl',days:6},{days:6},{focus:'neck'},{equipment:'none'},{level:'unknown'},{template:'unknown'}])assert.throws(()=>planner.generate({...base,...patch}));
});
test('full-body sessions have recovery days, including across the week boundary',()=>{
 for(const days of [2,3]){const s=planner.generate({...base,days}).sessions;for(let i=0;i<7;i++)if(!s[i].rest)assert.equal(s[(i+1)%7].rest,true);}
});
test('focus prioritizes the selected region without doubling the starting volume',()=>{
 const plain=planner.generate({...base,level:'regular'});
 const focus=planner.generate({...base,level:'regular',focus:'chest'});
 focus.weeks[2].sessions.forEach((s,i)=>{if(s.rest)return;assert.ok(s.exercises.reduce((n,x)=>n+x.sets,0)<=plain.weeks[2].sessions[i].exercises.reduce((n,x)=>n+x.sets,0)+1);assert.equal(s.exercises[0].group,'chest');for(const x of s.exercises)assert.ok(x.sets<=3);});
});
test('bodyweight chest choices and no-bench home pool are deliberate',()=>{
 const beginner=planner.generate(base),regular=planner.generate({...base,level:'regular'});
 assert.equal(beginner.sessions[0].exercises.find(x=>x.group==='chest').id,'3211');
 assert.equal(regular.sessions[0].exercises.find(x=>x.group==='chest').id,'0662');
 for(const week of regular.weeks)for(const s of week.sessions)for(const x of s.exercises)assert.ok(!/bench|seated|cable|machine/.test(library.get(x.id).name));
});
test('plan persistence restores progress but rejects malformed and unknown progress entries',()=>{
 let saved;global.wx={setStorageSync:(k,v)=>{saved=JSON.parse(JSON.stringify(v));},getStorageSync:()=>saved};
 const p=planner.generate(base),id=p.sessions[0].exercises[0].id;
 planner.save(p,{['0:0:'+id]:true,'0:0:fake':true,['1:0:'+id]:'true'});
 const r=planner.restore();assert.equal(r.plan.title,p.title);assert.deepEqual(r.progress,{['0:0:'+id]:true});
 saved.config.days=6;assert.equal(planner.restore(),null);
 saved='broken';assert.equal(planner.restore(),null);
});
test('storage failure is exposed to the page rather than reported as saved',()=>{
 global.wx={setStorageSync:()=>{throw Error('quota');},getStorageSync:()=>{throw Error('unavailable');}};
 assert.throws(()=>planner.save(planner.generate(base)),/quota/);assert.equal(planner.restore(),null);
});
test('four weeks have different prescriptions and a real reduced-volume fourth week',()=>{
 for(const level of ['beginner','regular']){
  const plan=planner.generate({...base,level});
  const signatures=plan.weeks.map(w=>JSON.stringify(w.sessions.map(s=>s.exercises.map(x=>[x.id,x.sets,x.reps]))));
  assert.equal(new Set(signatures).size,4);
  assert.equal(plan.weeks[0].totalSets,plan.weeks[1].totalSets);
  if(level==='regular')assert.ok(plan.weeks[2].totalSets>plan.weeks[1].totalSets);
  assert.ok(plan.weeks[3].totalSets<plan.weeks[2].totalSets);
  assert.equal(plan.weeks[0].sessions[0].exercises.find(x=>x.id==='1760').reps,'8～10');
  assert.equal(plan.weeks[1].sessions[0].exercises.find(x=>x.id==='1760').reps,'10～12');
 }
});
test('A/B alternation continues across weeks and contains different exercises',()=>{
 const plan=planner.generate(base);
 assert.deepEqual(plan.weeks[0].sessions.filter(x=>!x.rest).map(x=>x.variant),['A','B','A']);
 assert.deepEqual(plan.weeks[1].sessions.filter(x=>!x.rest).map(x=>x.variant),['B','A','B']);
 assert.notDeepEqual(plan.weeks[0].sessions[0].exercises.map(x=>x.id),plan.weeks[0].sessions[2].exercises.map(x=>x.id));
 for(const template of ['upperLower','ppl']){
  const p=planner.generate({...base,template,days:template==='ppl'?6:4,level:'regular'});
  const sessions=p.weeks[0].sessions.filter(s=>!s.rest),half=sessions.length/2;
  for(let i=0;i<half;i++)assert.notDeepEqual(sessions[i].exercises.map(x=>x.id),sessions[i+half].exercises.map(x=>x.id));
 }
});
test('v2 progress is validated against the correct week and variant',()=>{
 let saved;global.wx={setStorageSync:(k,v)=>{saved=v;},getStorageSync:()=>saved};
 const p=planner.generate(base);
 planner.save(p,{'0:0:1459':true,'1:0:1459':true,'1:0:3013':true,'3:0:3013':true});
 assert.deepEqual(planner.restore().progress,{'0:0:1459':true,'1:0:3013':true,'3:0:3013':true});
});
test('legacy saved plans keep their original exercises and progress until replaced',()=>{
 let saved={version:1,config:base,createdAt:1234,progress:{'1:0:1459':true,'1:0:3013':true}};
 global.wx={setStorageSync:(k,v)=>{saved=v;},getStorageSync:()=>saved};
 const r=planner.restore();assert.equal(r.plan.legacy,true);assert.equal(r.plan.version,1);assert.equal(r.plan.createdAt,1234);
 assert.ok(r.plan.weeks[1].sessions[0].exercises.some(x=>x.id==='1459'));
 assert.deepEqual(r.progress,{'1:0:1459':true});planner.save(r.plan,r.progress);assert.equal(saved.version,1);
 const newer=planner.generate(r.plan.config);assert.equal(saved.version,1);planner.save(newer,{});assert.equal(saved.version,2);assert.deepEqual(planner.restore().progress,{});
});
test('page switches real week sessions, not only the explanatory heading',()=>{
 const fs=require('node:fs'),vm=require('node:vm');let definition;
 vm.runInNewContext(fs.readFileSync(require.resolve('../miniprogram/pages/plans/plans.js'),'utf8'),{require:()=>planner,Page:p=>{definition=p;}});
 const page={...definition,data:{...definition.data,plan:planner.generate(base),progress:{}},setData(patch){Object.assign(this.data,patch);}};
 page.render();const a=page.data.rows.map(x=>[x.id,x.sets,x.reps]);
 page.pickWeek({currentTarget:{dataset:{index:1}}});const b=page.data.rows.map(x=>[x.id,x.sets,x.reps]);
 assert.notDeepEqual(a,b);assert.equal(page.data.session.variant,'B');
 assert.equal(page.data.weekSessions,page.data.plan.weeks[1].sessions);
 assert.ok(page.data.rows.every(x=>x.key.startsWith('1:0:')));
});
