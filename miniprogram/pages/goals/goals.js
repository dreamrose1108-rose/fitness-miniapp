const feedback=require('../../utils/feedback');
const app=getApp();const {call}=require('../../utils/cloud.js');const {goalPatch}=require('../../utils/wellness.js');
Page({
 onShow(){if(getApp().applyTheme)getApp().applyTheme(this);},
 data:{step:1,loading:true,saving:false,error:'',form:{nutritionGoal:'maintain',dailyCalorieTarget:'',dailyWaterTarget:'',proteinTarget:'',carbTarget:'',fatTarget:''},choices:[{key:'maintain',label:'保持状态'},{key:'lose',label:'减脂管理'},{key:'gain',label:'增肌管理'}]},
 async onLoad(){if(await app.login())await this.load();else feedback.state(this,{loading:false,error:'登录未完成，请重试'});},
 async load(){feedback.state(this,{loading:true,error:''});try{const p=await call('userProfile',{action:'get'}),form=Object.assign({},this.data.form);Object.keys(form).forEach(k=>{if(p[k]!==undefined && p[k]!==null)form[k]=p[k];});this.setData({form});}catch(e){feedback.state(this,{error:'目标加载失败，点击重试'});}finally{this.setData({loading:false});}},
 choose(e){this.setData({'form.nutritionGoal':e.currentTarget.dataset.key});},
 input(e){const field=e.currentTarget.dataset.field;if(Object.prototype.hasOwnProperty.call(this.data.form,field))this.setData({['form.'+field]:e.detail.value});},
 next(){this.setData({step:2});},back(){if(!this.data.saving)this.setData({step:1});},
 async save(){if(this.data.saving||this.data.loading||this.data.error)return;let patch;try{patch=goalPatch(this.data.form);}catch(e){feedback.error(e.message);return;}
 this.setData({saving:true});try{const r=await call('userProfile',Object.assign({action:'update'},patch));if(!r||r.updated!==true)throw new Error('未保存');wx.showToast({title:'目标已保存'});wx.navigateBack();}catch(e){feedback.error('保存失败，请重试');}finally{this.setData({saving:false});}}
});
