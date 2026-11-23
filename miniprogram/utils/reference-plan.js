const catalog=require('../data/tan-training.js');
const KEY='referenceTrainingPlan:tan:v1';
const limits={sets:[1,10],reps:[1,50],rest:[15,600]};
const keys=new Set(catalog.days.reduce((out,d)=>out.concat(d.actions.map(a=>d.id+':'+a.key)),[]));
// 构建推荐方案映射（key → {sets, reps, rest}）
const defaults={};
for(const d of catalog.days){
 for(const a of d.actions){
  const k=d.id+':'+a.key;
  if(a.sets)defaults[k]={sets:a.sets,reps:a.repsMin||a.reps||12,rest:a.restSec||60};
  else if(a.defSets)defaults[k]={sets:a.defSets,reps:a.defReps||12,rest:a.defRest||60};
 }
}
// 获取某动作的推荐方案
function getDefault(key){return defaults[key]||{sets:3,reps:12,rest:60};}
// 用推荐方案填充所有未填写的动作
function fillDefaults(entries={}){
 const out={};
 for(const k of keys){
  const existing=entries[k];
  const def=getDefault(k);
  if(existing&&existing.sets&&existing.reps&&existing.rest){out[k]=existing;continue;}
  out[k]={sets:existing&&existing.sets||String(def.sets),reps:existing&&existing.reps||String(def.reps),rest:existing&&existing.rest||String(def.rest)};
 }
 return out;
}
function validateEntry(entry={}){
 const result={};
 for(const field of Object.keys(limits)){
  const value=entry[field];
  if(value===undefined||value===''){result[field]='';continue;}
  const n=Number(value),[min,max]=limits[field];
  if(!/^\d+$/.test(String(value))||!Number.isInteger(n)||n<min||n>max)throw Error({sets:'组数需为 1～10',reps:'次数需为 1～50',rest:'休息需为 15～600 秒'}[field]);
  result[field]=String(n);
 }
 return result;
}
function normalize(entries={}){const out={};Object.keys(entries).forEach(k=>{if(keys.has(k))out[k]=validateEntry(entries[k]);});return out;}
function complete(entry){try{const e=validateEntry(entry);return !!(e.sets&&e.reps&&e.rest);}catch(e){return false;}}
function save(entries,progress={}){const filled=fillDefaults(entries);const clean=normalize(filled),done={};Object.keys(progress).forEach(k=>{if(keys.has(k)&&complete(clean[k])&&progress[k]===true)done[k]=true;});wx.setStorageSync(KEY,{version:2,entries:clean,progress:done});return {entries:clean,progress:done};}
function restore(){try{const raw=wx.getStorageSync(KEY);if(!raw||raw.version<1)return {entries:fillDefaults({}),progress:{}};const entries=fillDefaults(normalize(raw.entries)),progress={};Object.keys(raw.progress||{}).forEach(k=>{if(keys.has(k)&&complete(entries[k])&&raw.progress[k]===true)progress[k]=true;});return {entries,progress};}catch(e){return {entries:fillDefaults({}),progress:{}};}}
module.exports={catalog,validateEntry,normalize,complete,save,restore,getDefault,fillDefaults};
