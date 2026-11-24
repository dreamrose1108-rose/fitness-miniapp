const feedback=require('../../utils/feedback');
const {call}=require('../../utils/cloud');
const labels={goal:'长期目标',diet:'饮食偏好与限制',training:'训练偏好与经验',equipment:'可用器械',routine:'作息与训练时间',health:'需要注意的身体情况'};
Page({
 data:{rows:[],revision:0,loading:true,saving:false,error:'',notice:''},
 async onLoad(){if(!await getApp().login()){feedback.state(this,{loading:false,error:'请登录后重试'});return;}await this.load();},
 onShow(){if(getApp().applyTheme)getApp().applyTheme(this);},
 async load(){feedback.state(this,{loading:true,error:''});try{const result=await call('aiCoach',{action:'getMemory'});this.render(result);const draft=getApp().globalData.pendingMemoryDraft;if(draft&&labels[draft.key]){const index=this.data.rows.findIndex(x=>x.key===draft.key);this.setData({['rows['+index+'].value']:draft.operation==='delete'?this.data.rows[index].value:draft.value,['rows['+index+'].source']:draft.source||'',notice:draft.operation==='delete'?'请找到“'+labels[draft.key]+'”，点击忘记确认删除。':'下方已填入待确认内容，请核对后点击保存。'});getApp().globalData.pendingMemoryDraft=null;}}catch(e){feedback.state(this,{error:e.message||'读取失败，请重试'});}finally{this.setData({loading:false});}},
 render(result){this.setData({revision:result.revision,rows:Object.keys(labels).map(key=>{const saved=result.items.find(x=>x.key===key);return {key,label:labels[key],value:saved?saved.value:'',saved:!!saved,source:saved?saved.source:'',updated:saved?new Date(saved.updatedAt+8*3600000).toISOString().slice(0,16).replace('T',' '):''};})});},
 onInput(e){if(this.data.saving)return;const i=Number(e.currentTarget.dataset.index);if(!this.data.rows[i])return;this.setData({['rows['+i+'].value']:e.detail.value,['rows['+i+'].source']:'用户在记忆页面填写',['rows['+i+'].dirty']:true});},
 async save(e){const row=this.data.rows[Number(e.currentTarget.dataset.index)];if(!row||this.data.saving)return;if(!row.value.trim()){feedback.error('请填写内容，删除请点忘记');return;}await this.change(row,'save');},
 forget(e){const row=this.data.rows[Number(e.currentTarget.dataset.index)];if(!row||!row.saved||this.data.saving)return;wx.showModal({title:'忘记这条记忆？',content:'删除“'+row.label+'”。后续回答不再读取修改前的聊天上下文；已有饮食、训练记录与聊天展示仍保留。',success:r=>{if(r.confirm)this.change(row,'delete');}});},
 async change(row,operation){if(this.data.saving)return;this.setData({saving:true});try{const result=await call('aiCoach',{action:'changeMemory',data:{key:row.key,value:row.value,source:row.source,operation,revision:this.data.revision,confirmed:true}});const pending=this.data.rows.filter(x=>x.key!==row.key&&x.dirty);this.render(result);this.setData({rows:this.data.rows.map(x=>pending.find(p=>p.key===x.key)||x)});this.setData({notice:operation==='delete'?'已忘记，后续回答不会从旧聊天恢复这条记忆。':'已保存，教练将在后续回答中参考。'});wx.showToast({title:operation==='delete'?'已忘记':'已记住'});}catch(e){feedback.error(e.message||'保存失败，请重试');}finally{this.setData({saving:false});}},
 back(){wx.switchTab({url:'/pages/coach/coach'});}
});
