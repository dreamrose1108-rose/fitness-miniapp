const {call}=require('./cloud.js');
const manifest={...require('../data/exercise-media.js')};
require('../data/exercise-gifs.js').forEach(id=>{manifest[id]={...manifest[id],hasGif:true,gifSource:'https://github.com/hasaneyldrm/exercises-dataset',gifAttribution:'© Gym Visual'};});
const articleSources=require('../data/article-media.js');
Object.keys(articleSources).forEach(id=>{if(manifest[id])Object.assign(manifest[id],{gifSource:articleSources[id].source,gifAttribution:articleSources[id].attribution});});
const cache=Object.create(null);
async function load(ids,force=false){
 const wanted=Array.from(new Set(ids)).filter(id=>Object.prototype.hasOwnProperty.call(manifest,id));
 const missing=wanted.filter(id=>force||!cache[id]||cache[id].expiresAt<Date.now()+60000);
 for(let i=0;i<missing.length;i+=30){
  const result=await call('record',{action:'exerciseMedia',ids:missing.slice(i,i+30)});
  (result.items||[]).forEach(item=>{cache[item.id]=item;});
 }
 return wanted.map(id=>cache[id]).filter(Boolean);
}
module.exports={manifest,load};
