const app=getApp();
const {call}=require('../../utils/cloud.js');
const {formatDate}=require('../../utils/date.js');
Page({
  data:{date:'',today:'',total:0,count:0,records:[],goal:null,percent:0,amount:'',busy:false,loading:true,error:'',presets:[200,300,500]},
  async onShow(){if(getApp().applyTheme)getApp().applyTheme(this); const today=formatDate();this.setData({today,date:this.data.date||today});if(await app.login())await this.load();else this.setData({loading:false,error:'登录未完成，请重试'}); },
  async load(){this.setData({loading:true,error:''});try{
    const [result,profile]=await Promise.all([call('record',{action:'waterList',date:this.data.date}),call('userProfile',{action:'get'})]);
    this.setData({goal:profile.dailyWaterTarget||null});this.apply(result);
  }catch(e){this.setData({error:'加载失败，点击重试'});}finally{this.setData({loading:false});}},
  apply(result){this.setData({total:result.total,count:result.count,records:result.records.map(r=>Object.assign({},r,{time:new Date(r.createdAt).toLocaleTimeString('zh-CN',{hour12:false}).slice(0,5)})),percent:this.data.goal?Math.min(100,Math.round(result.total/this.data.goal*100)):0});},
  async changeDate(e){if(this.data.busy||this.data.loading)return;this.pending=null;this.setData({date:e.detail.value});await this.load();},
  input(e){this.setData({amount:e.detail.value});},
  async add(e){if(this.data.busy||this.data.loading||this.data.error)return;const ml=Number(e.currentTarget.dataset.ml||this.data.amount);
    if(!Number.isInteger(ml)||ml<1||ml>2000){wx.showToast({title:'每次请输入1～2000毫升',icon:'none'});return;}
    const date=this.data.date;
    if(!this.pending||this.pending.date!==date||this.pending.ml!==ml)this.pending={date,ml,requestId:'water_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2)};
    this.setData({busy:true});try{const result=await call('record',Object.assign({action:'waterAdd'},this.pending));this.apply(result);this.pending=null;this.setData({amount:''});wx.showToast({title:'已记录'});}catch(e){wx.showToast({title:'保存未确认，可重试同一笔',icon:'none'});}finally{this.setData({busy:false});}},
  remove(e){if(this.data.busy||this.data.loading)return;const id=e.currentTarget.dataset.id;wx.showModal({title:'删除这条饮水记录？',success:async r=>{if(!r.confirm)return;this.setData({busy:true});try{this.apply(await call('record',{action:'waterRemove',date:this.data.date,id}));}catch(e){wx.showToast({title:'删除失败，请重试',icon:'none'});}finally{this.setData({busy:false});}}});},
  goals(){wx.navigateTo({url:'/pages/goals/goals'});}
});
