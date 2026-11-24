// One shared error dialog across request and page layers.
let active=false,lastClosed=0;
function error(message,title='操作未完成') {
  const content=typeof message==='string'?message:message&&message.message;
  if(!content||active||Date.now()-lastClosed<500)return false;
  active=true;
  try{wx.showModal({title,content,showCancel:false,confirmText:'知道了',complete(){active=false;lastClosed=Date.now();}});}
  catch(e){active=false;throw e;}
  return true;
}
function state(page,patch,callback){
  const keys=['error','sendError','mediaError','aiSearchError','scheduleError'];
  const key=keys.find(k=>typeof patch[k]==='string'&&patch[k]&&patch[k]!==page.data[k]);
  const video=patch.videoError===true&&!page.data.videoError;
  page.setData(patch,callback);
  if(key)error(patch[key]);else if(video)error('视频加载失败，请重试');
}
module.exports={error,state};
