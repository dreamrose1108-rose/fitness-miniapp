const catalog=require('../data/tan-training.js');
const KEY='referenceTrainingPlan:tan:v1';
const limits={sets:[1,10],reps:[1,50],rest:[15,600]};
const keys=new Set(catalog.days.reduce((out,d)=>out.concat(d.actions.map(a=>d.id+':'+a.key)),[]));
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
function save(entries,progress={}){const clean=normalize(entries),done={};Object.keys(progress).forEach(k=>{if(keys.has(k)&&complete(clean[k])&&progress[k]===true)done[k]=true;});wx.setStorageSync(KEY,{version:1,entries:clean,progress:done});return {entries:clean,progress:done};}
function restore(){try{const raw=wx.getStorageSync(KEY);if(!raw||raw.version!==1)return {entries:{},progress:{}};const entries=normalize(raw.entries),progress={};Object.keys(raw.progress||{}).forEach(k=>{if(keys.has(k)&&complete(entries[k])&&raw.progress[k]===true)progress[k]=true;});return {entries,progress};}catch(e){return {entries:{},progress:{}};}}
module.exports={catalog,validateEntry,normalize,complete,save,restore};
