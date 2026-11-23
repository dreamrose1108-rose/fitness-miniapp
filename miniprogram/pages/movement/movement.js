const library=require('../../utils/exercise-library.js');
const media=require('../../utils/exercise-media.js');
const {call}=require('../../utils/cloud.js');
Page({
 data:{gif:'',gifLoaded:false,item:null,favorite:false,showLicense:false,license:require('../../data/exercise-license.js'),mediaInfo:null,images:[],video:'',frame:0,playing:false,loading:false,mediaError:'',videoError:false,loadedFrames:{},searchingGif:false,gifSearchResult:'',similarWithGif:[]},
 onLoad(options){
  const item=library.get(options.id);
  this.setData({item:item||null,favorite:!!item&&library.readFavorites().includes(item.id),mediaInfo:item&&media.manifest[item.id]||null});
  if(item&&!media.manifest[item.id])this.findSimilar();
 },
 // 找相似动作（有GIF的）
 findSimilar(){
  if(!this.data.item)return;
  const target=this.data.item;
  const similar=library.search({body:target.body||'',equipment:target.equipment||''}).filter(x=>
    x.id!==target.id&&media.manifest[x.id]
  ).slice(0,3);
  this.setData({similarWithGif:similar});
 },
 goSimilar(e){
  const id=e.currentTarget.dataset.id;
  wx.redirectTo({url:'/pages/movement/movement?id='+id});
 },
 // AI 联网搜GIF
 async aiFindGif(){
  if(this.data.searchingGif||!this.data.item)return;
  this.setData({searchingGif:true,gifSearchResult:''});
  try{
   const name=this.data.item.displayName||this.data.item.name;
   const res=await call('aiCoach',{
    question:'联网搜索：「'+name+'」健身动作标准演示视频或GIF。只需返回1个最佳来源的URL链接（YouTube/B站/健身网站均可），不要解释。'
   });
   const answer=(res&&res.answer)||'';
   const urlMatch=answer.match(/https?:\/\/[^\s\]"']+/);
   if(urlMatch){
    this.setData({gifSearchResult:urlMatch[0]});
   }else{
    wx.showToast({title:'AI 未能找到合适的演示链接',icon:'none'});
   }
  }catch(e){
   wx.showToast({title:'搜索失败，请重试',icon:'none'});
  }
  this.setData({searchingGif:false});
 },
 copyGifLink(){
  if(this.data.gifSearchResult){
   wx.setClipboardData({data:this.data.gifSearchResult});
   wx.showToast({title:'链接已复制，请在浏览器打开',icon:'none'});
  }
 },
 onShow(){this.hidden=false;if(this.data.mediaInfo)this.loadMedia();},
 onHide(){this.hidden=true;this.stop();if(this.data.video)wx.createVideoContext('movementVideo',this).pause();},onUnload(){this.hidden=true;this.stop();this.requestId=(this.requestId||0)+1;},
 async loadMedia(force=false){if(!this.data.mediaInfo)return;const requestId=this.requestId=(this.requestId||0)+1;this.stop();this.setData({loading:true,gif:'',gifLoaded:false,mediaError:'',videoError:false,loadedFrames:{}});try{if(!await getApp().login())throw Error('login');const result=await media.load([this.data.item.id],force===true);if(requestId!==this.requestId||this.hidden)return;const item=result[0];if(!item||(!item.images.length&&!item.video))throw Error('missing');this.setData({gif:item.gif||'',images:item.gif?[]:item.images,video:item.gif?'':item.video,frame:0});}catch(e){if(requestId===this.requestId&&!this.hidden)this.setData({mediaError:'演示暂时加载失败，请点击重试'});}finally{if(requestId===this.requestId&&!this.hidden)this.setData({loading:false});}},
 gifLoaded(){this.setData({gifLoaded:true});},
 gifFailed(){this.setData({gifLoaded:false,mediaError:'动图加载失败，请重试'});},
 retry(){this.loadMedia(true);},
 imageLoaded(e){this.setData({['loadedFrames.'+e.currentTarget.dataset.index]:true});},
 imageFailed(){this.stop();this.setData({mediaError:'图片未加载完成，请重试'});},
 videoFailed(){this.setData({videoError:true});},
 changeFrame(e){this.setData({frame:e.detail.current});},
 step(e){this.stop();const count=this.data.images.length;if(count)this.setData({frame:(this.data.frame+Number(e.currentTarget.dataset.delta)+count)%count});},
 stop(){if(this.timer)clearInterval(this.timer);this.timer=null;this.setData({playing:false});},
 togglePlay(){if(this.data.playing){this.stop();return;}if(this.data.images.some((_,i)=>!this.data.loadedFrames[i])){wx.showToast({title:'请等待图片加载完成',icon:'none'});return;}this.setData({playing:true});this.timer=setInterval(()=>{this.setData({frame:(this.data.frame+1)%this.data.images.length});},1200);},
 preview(){
  this.stop();
  if(this.data.gif){this.setData({gifOverlay:true});return;}
  wx.previewImage({urls:this.data.images,current:this.data.images[this.data.frame]});
 },
 closeGifOverlay(){this.setData({gifOverlay:false});},
 copySource(){const m=this.data.mediaInfo;wx.setClipboardData({data:(m.hasGif?[m.gifSource]:[m.photoSource,m.videoSource,m.videoLicenseUrl]).filter(Boolean).join('\n')});},
 favorite(){if(!this.data.item)return;try{const ids=library.toggleFavorite(this.data.item.id);this.setData({favorite:ids.includes(this.data.item.id)});}catch(e){wx.showToast({title:'收藏未保存，请重试',icon:'none'});}},
 record(){if(!this.data.item)return;this.stop();getApp().globalData.pendingExerciseId=this.data.item.id;wx.switchTab({url:'/pages/exercise/exercise',fail:()=>wx.showToast({title:'打开运动记录失败，请重试',icon:'none'})});},
 license(){this.setData({showLicense:!this.data.showLicense});}
});
