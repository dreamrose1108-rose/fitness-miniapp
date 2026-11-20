const fs=require('fs'),cp=require('child_process'),path=require('path');
const dir='reports/exercise-media';const items=require('../miniprogram/data/exercises.js'), photos=JSON.parse(fs.readFileSync(dir+'/photos-source.json'));
const norm=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
const aliases={'0662':'Pushups','0630':'Mountain Climbers'};
const matches=items.flatMap(x=>{const p=photos.find(y=>norm(x.name)===norm(y.name)||aliases[x.id]===y.name);return p?[{id:x.id,name:x.name,sourceId:p.id,sourceName:p.name,images:p.images}]:[]});
fs.writeFileSync(dir+'/photo-matches.json',JSON.stringify(matches,null,2));
fs.mkdirSync(dir+'/assets',{recursive:true});fs.mkdirSync(dir+'/video-meta',{recursive:true});
let tasks=matches.flatMap(x=>x.images.map((im,i)=>({url:'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'+im.split('/').map(encodeURIComponent).join('/'),dest:dir+'/assets/'+x.id+'-'+i+'.jpg'})));
const v=JSON.parse(fs.readFileSync(dir+'/videos-source.json')).results;
for(const id of [...new Set(v.map(x=>x.exercise))])tasks.push({url:'https://wger.de/api/v2/exerciseinfo/'+id+'/',dest:dir+'/video-meta/'+id+'.json'});
let next=0,done=0,failed=[];async function worker(){while(next<tasks.length){const t=tasks[next++];if(fs.existsSync(t.dest)&&fs.statSync(t.dest).size>1000){done++;continue;}try{await new Promise((res,rej)=>cp.execFile('curl.exe',['-L','--fail','--retry','2','--connect-timeout','10','--max-time','45','-sS',t.url,'-o',t.dest],e=>e?rej(e):res()));done++;}catch(e){failed.push(t.dest)}if((done+failed.length)%30===0)console.log('progress',done,failed.length)}}
Promise.all(Array.from({length:8},worker)).then(()=>{fs.writeFileSync(dir+'/download-result.json',JSON.stringify({done,failed}));console.log('done',done,'failed',failed.length)});

