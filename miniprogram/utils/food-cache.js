// Account-scoped chunked snapshots: publish the manifest only after all chunks are written.
function key(owner){return 'foodCatalog:v1:'+owner;}
function read(owner){
 if(!owner)return null;
 try{const manifest=wx.getStorageSync(key(owner));if(manifest&&Array.isArray(manifest.foods))return manifest;
 if(!manifest||manifest.format!==2||!Number.isInteger(manifest.parts)||manifest.parts<1||manifest.parts>100)return null;
 const foods=[];for(let i=0;i<manifest.parts;i++){const chunk=wx.getStorageSync(key(owner)+':'+manifest.revision+':'+i);if(!Array.isArray(chunk))return null;foods.push(...chunk);}
 return {version:manifest.version,foods};}catch(e){return null;}
}
function write(owner,snapshot){
 if(!owner)return false;
 const base=key(owner),revision=Date.now().toString(36)+Math.random().toString(36).slice(2,8),written=[];
 try{const old=wx.getStorageSync(base);const parts=Math.ceil(snapshot.foods.length/200);if(!parts||parts>100)return false;
 for(let i=0;i<parts;i++){const partKey=base+':'+revision+':'+i;wx.setStorageSync(partKey,snapshot.foods.slice(i*200,(i+1)*200));written.push(partKey);}
 wx.setStorageSync(base,{format:2,version:snapshot.version,parts,revision});
 if(old&&old.format===2)for(let i=0;i<Math.min(old.parts,100);i++)try{wx.removeStorageSync(base+':'+old.revision+':'+i);}catch(e){}
 return true;}catch(e){for(const partKey of written)try{wx.removeStorageSync(partKey);}catch(e){}return false;}
}
module.exports={read,write};
