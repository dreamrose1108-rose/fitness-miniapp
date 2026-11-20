const planner=require('../../utils/training-plan.js');
Page({
 data:{stage:0,templates:planner.templates,focuses:planner.focuses,sources:planner.sources,showSources:false,template:'full',templateName:'全身训练',focus:'all',level:'beginner',equipment:'gym',days:3,dayOptions:[2,3],plan:null,saved:false,week:0,day:0,weekInfo:planner.weeks[0],weekSessions:[],session:null,rows:[],doneCount:0,totalCount:0,progress:{}},
 onLoad(){const stored=planner.restore();if(stored){const c=stored.plan.config,t=planner.templates.find(x=>x.id===c.template);this.setData({...c,templateName:t.name,dayOptions:t.days,plan:stored.plan,progress:stored.progress,saved:true,stage:2});this.render();}},
 selectTemplate(e){const t=planner.templates.find(x=>x.id===e.currentTarget.dataset.id);if(!t)return;this.setData({template:t.id,templateName:t.name,dayOptions:t.days,days:t.days.includes(this.data.days)?this.data.days:t.days[0],stage:1});},
 select(e){const {field,value}=e.currentTarget.dataset;if(!['focus','level','equipment','days'].includes(field))return;this.setData({[field]:field==='days'?Number(value):value});},
 templates(){this.setData({stage:0});},
 settings(){this.setData({stage:1});},
 upgrade(){if(!this.data.plan)return;this.setData({...this.data.plan.config});this.generate();},
 generate(){try{const plan=planner.generate(this.data);this.setData({plan,progress:{},saved:false,stage:2,week:0,day:0});this.render();wx.pageScrollTo({scrollTop:0,duration:0});}catch(e){wx.showToast({title:e.message,icon:'none',duration:2500});}},
 save(){try{planner.save(this.data.plan,this.data.progress);this.setData({saved:true});wx.showToast({title:'已保存到本机',icon:'success'});}catch(e){wx.showToast({title:'保存失败，请检查存储空间',icon:'none'});}},
 pickWeek(e){const week=Number(e.currentTarget.dataset.index);if(week>=0&&week<4){this.setData({week});this.render();}},
 pickDay(e){const day=Number(e.currentTarget.dataset.index);if(day>=0&&day<7){this.setData({day});this.render();}},
 render(){const {plan,week,day,progress}=this.data;if(!plan)return;const weekInfo=plan.weeks[week],weekSessions=weekInfo.sessions,session=weekSessions[day];const rows=session.exercises.map(x=>({...x,key:week+':'+day+':'+x.id,done:!!progress[week+':'+day+':'+x.id]}));let totalCount=0,doneCount=0;weekSessions.forEach(s=>s.exercises.forEach(x=>{totalCount++;if(progress[week+':'+s.day+':'+x.id])doneCount++;}));this.setData({session,rows,weekInfo,weekSessions,totalCount,doneCount});},
 toggleDone(e){if(!this.data.saved){wx.showToast({title:'先保存计划，再记录完成情况',icon:'none'});return;}const key=e.currentTarget.dataset.key;if(!this.data.rows.some(x=>x.key===key))return;const progress={...this.data.progress,[key]:!this.data.progress[key]};try{planner.save(this.data.plan,progress);this.setData({progress});this.render();}catch(e){wx.showToast({title:'进度未保存，请重试',icon:'none'});}},
 movement(e){const id=e.currentTarget.dataset.id;if(!this.data.rows.some(x=>x.id===id))return;wx.navigateTo({url:'/pages/movement/movement?id='+encodeURIComponent(id)});},
 sources(){this.setData({showSources:!this.data.showSources});},
 copySource(e){const source=planner.sources[Number(e.currentTarget.dataset.index)];if(source)wx.setClipboardData({data:source.url});}
});
