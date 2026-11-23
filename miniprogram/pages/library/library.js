const media=require('../../utils/exercise-media.js');
const library=require('../../utils/exercise-library.js');
Page({
 data:{mediaOnly:false,mediaCount:Object.keys(media.manifest).length,thumbnails:{},query:'',bodyIndex:0,equipmentIndex:0,targetIndex:0,bodyOptions:library.bodyOptions,equipmentOptions:library.equipmentOptions,targetOptions:library.targetOptions,favoritesOnly:false,results:[],total:0,totalLibrary:library.items.length,hasMore:false},
 onShow(){if(getApp().applyTheme)getApp().applyTheme(this);this.refresh();},
 input(e){this.setData({query:e.detail.value});this.refresh();},
 filter(e){const field=e.currentTarget.dataset.field;if(!['body','equipment','target'].includes(field))return;this.setData({[field+'Index']:Number(e.detail.value)});this.refresh();},
 demos(){this.setData({mediaOnly:!this.data.mediaOnly});this.refresh();},
 favorites(){this.setData({favoritesOnly:!this.data.favoritesOnly});this.refresh();},
 clear(){this.setData({query:'',bodyIndex:0,equipmentIndex:0,targetIndex:0,favoritesOnly:false,mediaOnly:false});this.refresh();},
 refresh(){const d=this.data;this.matches=library.search({query:d.query,body:d.bodyOptions[d.bodyIndex].key,equipment:d.equipmentOptions[d.equipmentIndex].key,target:d.targetOptions[d.targetIndex].key,favoritesOnly:d.favoritesOnly,favorites:library.readFavorites()});if(d.mediaOnly)this.matches=this.matches.filter(x=>media.manifest[x.id]);this.visible=30;this.render();},
 render(){this.setData({results:this.matches.slice(0,this.visible).map(x=>({id:x.id,name:x.displayName,englishName:x.name,body:x.bodyLabel,equipment:x.equipmentLabel,target:x.targetLabel,hasMedia:!!media.manifest[x.id],hasVideo:!!(media.manifest[x.id]&&!media.manifest[x.id].hasGif&&media.manifest[x.id].videoSource)})),total:this.matches.length,hasMore:this.visible<this.matches.length});this.loadThumbnails();},
 async loadThumbnails(){const requestId=this.mediaRequest=(this.mediaRequest||0)+1;const ids=this.matches.slice(0,this.visible).filter(x=>media.manifest[x.id]).map(x=>x.id);if(!ids.length)return;try{if(!await getApp().login())return;const rows=await media.load(ids);if(requestId!==this.mediaRequest)return;const thumbnails={...this.data.thumbnails};rows.forEach(x=>{if(x.images[0])thumbnails[x.id]=x.images[0];});this.setData({thumbnails});}catch(e){}},
 onUnload(){this.mediaRequest=(this.mediaRequest||0)+1;},
 more(){this.visible+=30;this.render();},onReachBottom(){if(this.data.hasMore)this.more();},
 open(e){wx.navigateTo({url:'/pages/movement/movement?id='+encodeURIComponent(e.currentTarget.dataset.id)});}
});
