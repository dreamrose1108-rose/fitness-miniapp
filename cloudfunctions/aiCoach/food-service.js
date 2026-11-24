// The public snapshot is bundled; private foods are queried with explicit ownership.
const catalog=require('./food-catalog');
const {one,str}=require('./fitdb');
let officialCache=null,expires=0;
async function read(where){const row=await one(`SELECT COALESCE(jsonb_agg(jsonb_build_object('_id',id)||data),'[]'::jsonb)::text FROM (SELECT id,data FROM public.fit_foods WHERE ${where} ORDER BY id LIMIT 5000) t`);return row?JSON.parse(row[0]):[];}
async function load(openid){
 let official=[],custom=[],available=true;
 try{if(!officialCache||Date.now()>expires){officialCache=await read("data->>'source'='official'");expires=Date.now()+60000;}official=officialCache;}catch(e){available=false;official=officialCache||[];}
 try{custom=await read(`data->>'source'='custom' AND data->>'ownerOpenid'=${str(openid)}`);}catch(e){available=false;}
 const safe=custom.concat(official).map(({ownerOpenid,createdAt,...f})=>f);
 return {foods:catalog.merge(safe),version:catalog.meta.version,meta:catalog.meta,available};
}
async function search(openid,keyword,cat,limit=100,offset=0){const data=await load(openid);return {...catalog.search(data.foods,keyword,cat,limit,offset),version:data.version,available:data.available};}
module.exports={load,search};
