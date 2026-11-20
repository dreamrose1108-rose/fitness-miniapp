const catalog=require('../data/exercise-catalog.js');
const raw=require('../data/exercises.js').concat(catalog.additional);
const BODY=catalog.body,EQUIPMENT=catalog.equipment,TARGET=catalog.target,NAMES=catalog.names;
const KEYWORDS=[['俯卧撑','push-up'],['深蹲','squat'],['硬拉','deadlift'],['卧推','bench press'],['引体','pull-up'],['卷腹','crunch'],['弯举','curl'],['划船','row'],['推举','press'],['飞鸟','fly'],['平板','plank'],['箭步','lunge'],['弓步','lunge'],['提踵','calf raise'],['拉伸','stretch'],['跳','jump'],['跑','run']];
const items=raw.map(x=>Object.assign({},x,{displayName:NAMES[x.id]||x.name,bodyLabel:BODY[x.body]||x.body,equipmentLabel:EQUIPMENT[x.equipment]||x.equipment,targetLabel:TARGET[x.target]||x.target}));
const index=Object.create(null);items.forEach(x=>{index[x.id]=x;});
function options(field,labels){return [{key:'',label:'全部'}].concat([...new Set(raw.map(x=>x[field]))].map(key=>({key,label:labels[key]||key})));}
function search({query='',body='',equipment='',target='',favoritesOnly=false,favorites=[]}={}){
 const words=query.trim().toLowerCase().split(/\s+/).filter(Boolean),favoriteSet=new Set(favorites);
 const matches=items.filter(x=>{
  if(body&&x.body!==body||equipment&&x.equipment!==equipment||target&&x.target!==target||favoritesOnly&&!favoriteSet.has(x.id))return false;
  const text=[x.name,x.displayName,x.bodyLabel,x.equipmentLabel,x.targetLabel,...x.steps].join(' ').toLowerCase();
  return words.every(word=>text.includes(word)||KEYWORDS.some(([zh,en])=>zh===word&&x.name.includes(en)));
 });
 if(words.length){
  const score=x=>words.reduce((n,word)=>n+(x.displayName.toLowerCase()===word||x.name===word?100:x.displayName.toLowerCase().includes(word)||x.name.includes(word)?20:KEYWORDS.some(([zh,en])=>zh===word&&x.name.includes(en))?10:0),0);
  matches.sort((a,b)=>score(b)-score(a));
 }
 return matches;
}
const FAVORITE_KEY='exerciseFavorites:v1';
function readFavorites(){try{const saved=wx.getStorageSync(FAVORITE_KEY);return Array.isArray(saved)?[...new Set(saved.filter(id=>index[id]))]:[];}catch(e){return [];}}
function toggleFavorite(id){if(!index[id])throw Error('动作不存在');const saved=readFavorites(),at=saved.indexOf(id);if(at>=0)saved.splice(at,1);else saved.push(id);wx.setStorageSync(FAVORITE_KEY,saved);return saved;}
module.exports={items,get:id=>index[id],search,bodyOptions:[{key:'',label:'全部'}].concat(['upper arms','upper legs','back','waist','chest','shoulders','lower legs','lower arms','cardio','neck'].map(key=>({key,label:BODY[key]}))),equipmentOptions:options('equipment',EQUIPMENT),targetOptions:options('target',TARGET),readFavorites,toggleFavorite};
