const model=require('../../utils/reference-plan.js');
Page({
 onShow(){if(getApp().applyTheme)getApp().applyTheme(this);},
 data:{catalog:model.catalog,selected:0,day:model.catalog.days[0],rows:[],entries:{},progress:{},dirty:false,done:0},
 onLoad(){this.setData(model.restore());this.render();},
 render(){const day=model.catalog.days[this.data.selected];const rows=day.actions.map(a=>{const key=day.id+':'+a.key;return {...a,key,...(this.data.entries[key]||{sets:'',reps:'',rest:''}),done:!!this.data.progress[key]};});this.setData({day,rows,done:rows.filter(x=>x.done).length});},
 choose(e){const selected=Number(e.currentTarget.dataset.index);if(Number.isInteger(selected)&&selected>=0&&selected<model.catalog.days.length){this.setData({selected});this.render();}},
 edit(e){const {key,field}=e.currentTarget.dataset;if(!this.data.rows.some(x=>x.key===key)||!['sets','reps','rest'].includes(field))return;const entries={...this.data.entries,[key]:{...(this.data.entries[key]||{}),[field]:e.detail.value}};const progress={...this.data.progress};delete progress[key];this.setData({entries,progress,dirty:true});this.render();},
 save(){try{const saved=model.save(this.data.entries,this.data.progress);this.setData({...saved,dirty:false});this.render();wx.showToast({title:'个人安排已保存',icon:'success'});}catch(e){wx.showToast({title:e.message||'保存失败，请重试',icon:'none',duration:2500});}},
 toggle(e){const key=e.currentTarget.dataset.key;if(!this.data.rows.some(x=>x.key===key))return;if(!model.complete(this.data.entries[key])){wx.showToast({title:'先填写组数、次数和休息',icon:'none'});return;}try{const result=model.save(this.data.entries,{...this.data.progress,[key]:!this.data.progress[key]});this.setData({...result,dirty:false});this.render();}catch(e){wx.showToast({title:e.message||'进度未保存',icon:'none'});}},
 reset(){wx.showModal({title:'开始新一轮',content:'保留个人组次设置，清除全部训练日的完成标记。',success:r=>{if(!r.confirm)return;try{const saved=model.save(this.data.entries,{});this.setData({...saved,dirty:false});this.render();}catch(e){wx.showToast({title:e.message||'保存失败',icon:'none'});}}});},
 demo(e){const row=this.data.rows.find(x=>x.key===e.currentTarget.dataset.key);if(row&&row.exerciseId)wx.navigateTo({url:'/pages/movement/movement?id='+row.exerciseId});},
 source(){wx.setClipboardData({data:this.data.day.source});},
 overview(){wx.setClipboardData({data:model.catalog.overview});}
});
