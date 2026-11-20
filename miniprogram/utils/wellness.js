const { formatDate } = require('./date.js');
function monthCells(month, records, today) {
  const [y,m] = month.split('-').map(Number);
  const first = new Date(y,m-1,1,12);
  const count = new Date(y,m,0,12).getDate();
  const map = {}; records.forEach(r => { map[r.date] = r; });
  const cells = [];
  for (let i=0;i<(first.getDay()+6)%7;i++) cells.push({key:'blank'+i, blank:true});
  for (let n=1;n<=count;n++) {
    const date = formatDate(new Date(y,m-1,n,12));
    const r=map[date];
    cells.push({ key:date,date,day:n,hasRecord:!!r,today:date===today,future:date>today });
  }
  return cells;
}
function weeklyReview(records,start,end) {
  const days=records.filter(r=>r.date>=start && r.date<=end);
  const diet=days.filter(r=>r.dietCount>0), exercise=days.filter(r=>r.exerciseCount>0), water=days.filter(r=>r.waterCount>0);
  const sum=(arr,key)=>arr.reduce((n,r)=>n+(Number(r[key])||0),0);
  const weights=days.filter(r=>r.bodyCount>0).sort((a,b)=>a.date.localeCompare(b.date));
  return { recordedDays:days.length,dietDays:diet.length,exerciseDays:exercise.length,waterDays:water.length,
    avgIntake:diet.length?Math.round(sum(diet,'diet')/diet.length):null,
    burned:Math.round(sum(exercise,'exercise')),waterTotal:sum(water,'water'),
    weightChange:weights.length>1?Number((weights[weights.length-1].body-weights[0].body).toFixed(1)):null };
}
function goalPatch(form) {
  if (!['maintain','lose','gain'].includes(form.nutritionGoal)) throw new Error('请选择目标类型');
  const patch={nutritionGoal:form.nutritionGoal};
  const fields=[['dailyCalorieTarget',1,10000,'每日热量'],['dailyWaterTarget',100,10000,'每日饮水'],['proteinTarget',0,1000,'蛋白质'],['carbTarget',0,2000,'碳水'],['fatTarget',0,1000,'脂肪']];
  fields.forEach(([key,min,max,label])=>{
    if (String(form[key]===undefined?'':form[key]).trim()==='') {
      if (key==='dailyCalorieTarget'||key==='dailyWaterTarget') throw new Error('请填写'+label+'目标');
      patch[key]=null;
      return;
    }
    const value=Number(form[key]);
    if (!Number.isFinite(value)||value<min||value>max) throw new Error(label+'目标须在'+min+'～'+max+'之间');
    patch[key]=value;
  });
  return patch;
}
module.exports={monthCells,weeklyReview,goalPatch};
