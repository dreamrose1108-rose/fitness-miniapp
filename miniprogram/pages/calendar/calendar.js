const app=getApp();
const schedule=require('../../utils/training-schedule');
const {call}=require('../../utils/cloud.js');
const {formatDate,lastDays}=require('../../utils/date.js');
const {monthCells,weeklyReview}=require('../../utils/wellness.js');
Page({
 data:{planned:null,scheduleError:'',maxMonth:'',month:'',currentMonth:'',today:'',selected:'',cells:[],weekdays:['一','二','三','四','五','六','日'],detail:{},review:{},loading:true,error:'',weekLabel:''},
 async onShow(){const today=formatDate();this.setData({today,currentMonth:today.slice(0,7),month:this.data.month||today.slice(0,7),selected:this.data.selected||today});if(await app.login()){this.setData({maxMonth:schedule.addDays(today,365).slice(0,7)});try{this.schedules=schedule.read();this.setData({scheduleError:''});}catch(e){this.schedules=[];this.setData({scheduleError:e.message});}this.paintSchedule();await this.load();}else this.setData({loading:false,error:'登录未完成，请重试'});},
 async load(){const version=(this.version||0)+1;this.version=version;this.setData({loading:true,error:''});try{
   const [y,m]=this.data.month.split('-').map(Number);const start=this.data.month+'-01',end=formatDate(new Date(y,m,0,12));const week=lastDays(7);
   const [records,weekly]=await Promise.all([call('record',{action:'calendar',start,end}),call('record',{action:'calendar',start:week[0],end:week[6]})]);
   if(this.version!==version)return;this.records=records;
   this.setData({cells:monthCells(this.data.month,records,this.data.today),detail:records.find(r=>r.date===this.data.selected)||{},review:weeklyReview(weekly,week[0],week[6]),weekLabel:week[0]+' ～ '+week[6]});
   this.paintSchedule();
 }catch(e){if(this.version===version)this.setData({error:'日历加载失败，点击重试'});}finally{if(this.version===version)this.setData({loading:false});}},
 changeMonth(e){const [y,m]=this.data.month.split('-').map(Number);const d=new Date(y,m-1+Number(e.currentTarget.dataset.offset),1,12),month=formatDate(d).slice(0,7);if(month>this.data.maxMonth)return;this.setData({month,selected:month===this.data.today.slice(0,7)?this.data.today:month+'-01'});this.paintSchedule();this.load();},
 select(e){const date=e.currentTarget.dataset.date;if(!date)return;this.setData({selected:date,detail:(this.records||[]).find(r=>r.date===date)||{}});this.paintSchedule();},
 paintSchedule(){const planned=(this.schedules||[]).find(r=>r.date===this.data.selected)||null;const cells=monthCells(this.data.month,this.records||[],this.data.today).map(c=>({...c,hasPlan:(this.schedules||[]).some(r=>r.date===c.date)}));this.setData({planned,cells});},
 schedule(){wx.navigateTo({url:'/pages/schedule/schedule'});}
});
