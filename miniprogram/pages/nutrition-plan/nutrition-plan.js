const model=require('../../utils/nutrition-plan');const {call}=require('../../utils/cloud');
Page({
 data:{loading:true,saving:false,error:'',result:null,saved:false,activity:model.activity,intensity:model.intensity,sexNames:['请选择','男性','女性'],goalNames:['维持','减脂','增肌'],form:{age:'',height:'',weight:'',sex:'',goal:'maintain',activity:0,intensity:1,days:'0',minutes:'30',snack:false,suitability:''},sexIndex:0,goalIndex:0},
 onShow(){if(getApp().applyTheme)getApp().applyTheme(this);},
 async onLoad(){if(!await getApp().login()){this.setData({loading:false,error:'请登录后重新进入'});return;}this.owner=getApp().globalData.openid;try{const stored=wx.getStorageSync('nutritionEstimate:v1:'+this.owner);if(stored&&stored.form){const result=model.estimate(stored.form);this.setData({form:stored.form,result,sexIndex:stored.form.sex==='male'?1:2,goalIndex:['maintain','lose','gain'].indexOf(stored.form.goal)});}}catch(e){}this.setData({loading:false});},
 edit(e){if(this.data.saving)return;const field=e.currentTarget.dataset.field;if(!Object.prototype.hasOwnProperty.call(this.data.form,field))return;this.setData({['form.'+field]:e.detail.value,result:null,saved:false,error:''});},
 chooseSex(e){this.setData({sexIndex:Number(e.detail.value),'form.sex':['','male','female'][Number(e.detail.value)],result:null,saved:false,error:''});},
 chooseGoal(e){this.setData({goalIndex:Number(e.detail.value),'form.goal':['maintain','lose','gain'][Number(e.detail.value)],result:null,saved:false,error:''});},
 suitable(e){this.setData({'form.suitability':e.detail.value,result:null,saved:false,error:''});},
 generate(){try{const result=model.estimate(this.data.form);this.setData({result,error:'',saved:false});wx.pageScrollTo({selector:'#nutrition-result',duration:200});}catch(e){this.setData({error:e.message,result:null});}},
 async apply(){if(this.data.saving||!this.data.result)return;this.setData({saving:true,error:''});try{const result=model.estimate(this.data.form);const response=await call('userProfile',{action:'update',...model.patch(result)});if(!response||response.updated!==true)throw Error('目标未保存，请重试');let localError=false;try{wx.setStorageSync('nutritionEstimate:v1:'+this.owner,{form:this.data.form});}catch(e){localError=true;}this.setData({result,saved:true,error:localError?'每日目标已保存，但本机未能保存计算资料，下次需重新填写。':''});wx.showToast({title:'每日目标已应用'});}catch(e){this.setData({error:e.message||'保存失败，请重试'});}finally{this.setData({saving:false});}},
 goHome(){if(!this.data.saving)wx.switchTab({url:'/pages/index/index',fail:()=>wx.showToast({title:'打开首页失败，请重试',icon:'none'})});},
 goDiet(){if(!this.data.saving)wx.switchTab({url:'/pages/diet/diet',fail:()=>wx.showToast({title:'打开饮食记录失败，请重试',icon:'none'})});},
 copySources(){wx.setClipboardData({data:'计算参考：Mifflin–St Jeor 静息代谢公式 https://pubmed.ncbi.nlm.nih.gov/2305711/\n营养素参考范围 https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-macronutrients.html'});}
});
