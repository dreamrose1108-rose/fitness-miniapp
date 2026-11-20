// Shared validation contract: keep server/aiCoach/training-draft-schema.js identical.
function validate(input, getExercise) {
  if(!input||typeof input!=='object')throw Error('计划格式无效');
  const text=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
  const integer=(v,min,max,label)=>{if(!Number.isInteger(v)||v<min||v>max)throw Error(label+'范围无效');return v;};
  const title=text(input.title,60);if(!title)throw Error('计划缺少名称');
  if(!Array.isArray(input.days)||input.days.length<1||input.days.length>24)throw Error('计划需要 1～24 个训练日');
  const offsets=new Set();
  const days=input.days.map(day=>{
    const offset=integer(day.offset,0,27,'训练日');if(offsets.has(offset))throw Error('训练日重复');offsets.add(offset);
    if(!Array.isArray(day.exercises)||!day.exercises.length||day.exercises.length>8)throw Error('每次训练需为 1～8 个动作');
    const ids=new Set();
    const exercises=day.exercises.map(x=>{
      const item=x&&getExercise(x.id);if(!item)throw Error('动作 ID 不在动作库中，请重新选择');if(ids.has(x.id))throw Error('同一训练日动作重复');ids.add(x.id);
      const repsMin=integer(x.repsMin,1,50,'次数'),repsMax=integer(x.repsMax,1,50,'次数');if(repsMax<repsMin)throw Error('次数上限不能小于下限');
      return {id:x.id,name:item.displayName||item.name,sets:integer(x.sets,1,6,'组数'),repsMin,repsMax,restSec:integer(x.restSec,15,600,'休息秒数'),eachSide:x.eachSide===true};
    });
    return {offset,title:text(day.title,50)||'训练日',exercises};
  }).sort((a,b)=>a.offset-b.offset);
  for(let start=0;start<28;start++)if(days.filter(d=>d.offset>=start&&d.offset<start+7).length>6)throw Error('连续七天至少保留一个休息日');
  return {version:1,title,notes:text(input.notes,600),days};
}
module.exports={validate};
