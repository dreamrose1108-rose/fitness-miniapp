const {one,str,jsonb}=require('./fitdb');
const crypto=require('crypto');
const labels={goal:'长期目标',diet:'饮食偏好与限制',training:'训练偏好与经验',equipment:'可用器械',routine:'作息与训练时间',health:'需要注意的身体情况'};
function normalize(raw){return {revision:Number.isInteger(raw&&raw.revision)?raw.revision:0,historyAfter:Number(raw&&raw.historyAfter)||0,items:Array.isArray(raw&&raw.items)?raw.items.filter(x=>x&&Object.hasOwnProperty.call(labels,x.key)&&typeof x.value==='string'):[]};}
function draft(input,source){
 if(!input||!Object.hasOwnProperty.call(labels,input.key)||!['save','delete'].includes(input.operation))throw Error('记忆类型无效');
 const value=input.operation==='delete'?'':String(input.value||'').trim();
 if(input.operation==='save'&&(!value||value.length>160))throw Error('记忆内容需为1～160字');
 return {key:input.key,label:labels[input.key],operation:input.operation,value,source:String(source||'').slice(0,500)};
}
async function read(openid){const row=await one(`SELECT data->'coachMemory' FROM public.fit_users WHERE data->>'openid'=${str(openid)} LIMIT 1`);if(!row)throw Error('请先完成个人资料设置');return normalize(typeof row[0]==='string'?JSON.parse(row[0]||'null'):row[0]);}
async function change(openid,input){
 if(!input||input.confirmed!==true||!Number.isInteger(input.revision))throw Error('请确认记忆后保存');
 const edit=draft(input,input.source),before=await read(openid);
 if(before.revision!==input.revision)throw Error('记忆已更新，请刷新后重试');
 const now=Date.now(),items=before.items.filter(x=>x.key!==edit.key);
 if(edit.operation==='save')items.push({key:edit.key,value:edit.value,updatedAt:now,source:edit.source||'用户在记忆页面填写',confirmed:true});
 // Exclude older chat context after edits/deletion so outdated claims cannot be reintroduced.
 const next={revision:before.revision+1,historyAfter:now,items,writeId:crypto.randomBytes(12).toString('hex')};
 await one(`UPDATE public.fit_users SET data=jsonb_set(data,'{coachMemory}',${jsonb(next)},true) WHERE data->>'openid'=${str(openid)} AND COALESCE((data->'coachMemory'->>'revision')::int,0)=${before.revision}`);
 const saved=await one(`SELECT data->'coachMemory' FROM public.fit_users WHERE data->>'openid'=${str(openid)} AND data->'coachMemory'->>'writeId'=${str(next.writeId)} LIMIT 1`);
 if(!saved)throw Error('记忆已改变，请刷新后重试');return normalize(next);
}
async function context(openid){
 const memory=await read(openid);
 const start=new Date(Date.now()+8*3600000-13*86400000).toISOString().slice(0,10),end=new Date(Date.now()+8*3600000).toISOString().slice(0,10);
 const owner=`data->>'openid'=${str(openid)} AND data->>'date' BETWEEN ${str(start)} AND ${str(end)}`;
 const row=await one(`SELECT (SELECT count(*) FROM public.fit_diet_records WHERE ${owner}), (SELECT count(DISTINCT data->>'date') FROM public.fit_diet_records WHERE ${owner}), (SELECT count(*) FROM public.fit_exercise_records WHERE ${owner})`);
 return {memory,summary:row?{start,end,dietRecords:Number(row[0]),dietRecordedDays:Number(row[1]),exerciseRecords:Number(row[2]),note:'这是已记录条数，不代表实际进食餐数或训练完成次数；没有记录不等于没吃饭或没运动'}:null};
}
function planContext(input){if(!Array.isArray(input))return [];return input.slice(0,14).filter(x=>x&&/^\d{4}-\d{2}-\d{2}$/.test(x.date)).map(x=>({date:x.date,title:String(x.title||'').slice(0,60),planTitle:String(x.planTitle||'').slice(0,60),finished:x.finished===true,exerciseCount:Math.max(0,Math.min(8,Number(x.exerciseCount)||0))}));}
const tool={type:'function',function:{name:'propose_memory',description:'从本轮用户明确表达的长期事实生成待确认记忆或删除请求，不直接保存。不从历史、猜测、临时状态或网页提取。',parameters:{type:'object',properties:{key:{type:'string',enum:Object.keys(labels)},operation:{type:'string',enum:['save','delete']},value:{type:'string',description:'1～160字，同一类别已有内容需要合并或明确替换，不能丢失未被否定的偏好'}},required:['key','operation']}}};
module.exports={labels,normalize,draft,read,change,context,planContext,tool};
