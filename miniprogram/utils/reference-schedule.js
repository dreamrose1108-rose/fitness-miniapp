const reference=require('./reference-plan');
const families={video:['push','pull','legs'],article:['push-article','pull-article','squat-article']};
function validate(input){
 if(!input||!families[input.referenceVersion]||!Array.isArray(input.days)||input.days.length!==3)throw Error('请选择完整的公开课版本');
 const expected=families[input.referenceVersion],offsets=new Set();
 const days=input.days.map((day,i)=>{
  const original=reference.catalog.days.find(x=>x.id===expected[i]);
  if(day.referenceDay!==original.id||!Number.isInteger(day.offset)||day.offset<0||day.offset>27||offsets.has(day.offset))throw Error('公开课训练日无效');offsets.add(day.offset);
  if(!Array.isArray(day.exercises)||day.exercises.length!==original.actions.length)throw Error('公开课动作清单不完整');
  return {offset:day.offset,referenceDay:original.id,title:original.title,exercises:original.actions.map((action,j)=>{
   const x=day.exercises[j];if(!x||x.referenceKey!==action.key)throw Error('公开课动作顺序无效');
   const entry=reference.validateEntry({sets:x.sets,reps:x.repsMin,rest:x.restSec});if(!reference.complete(entry)||x.repsMax!==x.repsMin)throw Error('请填写完整的个人组次');
   return {id:action.exerciseId||'ref_'+original.id+'_'+action.key,referenceKey:action.key,name:action.name,sets:Number(entry.sets),repsMin:Number(entry.reps),repsMax:Number(entry.reps),restSec:Number(entry.rest),eachSide:action.eachSide===true,warmup:action.warmup===true,demoId:action.exerciseId||null,sourceUrl:original.source,isReference:true};
  })};
 });
 return {version:1,source:'reference:tan',referenceVersion:input.referenceVersion,title:reference.catalog.title+' · '+(input.referenceVersion==='article'?'公众号版':'视频版'),notes:'一轮推、拉、腿；默认间隔一天，可逐日改期。完整保留热身与正式动作。组次为你确认的个人设置，未核实的演示请查看原视频。',days};
}
function create(entries,version){if(!families[version])throw Error('公开课版本无效');return {id:'reference_tan_'+version+'_'+Date.now(),...validate({referenceVersion:version,days:families[version].map((id,i)=>{const day=reference.catalog.days.find(x=>x.id===id);return {referenceDay:id,offset:i*2,exercises:day.actions.map(a=>{const e=reference.validateEntry(entries[id+':'+a.key]);if(!reference.complete(e))throw Error('请补全'+day.title+'的'+a.name+'组次');return {referenceKey:a.key,sets:Number(e.sets),repsMin:Number(e.reps),repsMax:Number(e.reps),restSec:Number(e.rest)};})};})})};}
module.exports={create,validate};
