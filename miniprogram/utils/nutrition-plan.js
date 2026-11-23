// General adult estimate, not a therapeutic diet. See docs/nutrition-plan.md.
const activity=[{label:'久坐为主，日常走动少',factor:1.2},{label:'日常经常走动或站立',factor:1.4},{label:'体力工作，日常活动多',factor:1.6}];
const intensity=[{label:'轻度：散步、舒缓运动',met:3},{label:'中等：快走、一般健身',met:5},{label:'较高：跑步、较高强度运动',met:7}];
const strategies=[
 {key:'balanced',name:'均衡三餐',tag:'日常基础方案',description:'规律安排三餐，可选加餐；不限制进食窗口。',note:'优先选择能长期坚持的方式，营养目标仍按个人需求估算。',hours:0},
 {key:'tre14',name:'14:10 限时进食',tag:'轻断食 · 时间安排',description:'每天在 10 小时内安排饮食，剩余 14 小时不摄入热量。',note:'只调整进食时间，不自动降低营养目标；进食窗口内仍需吃够每日所需。',hours:10},
 {key:'tre16',name:'16:8 限时进食',tag:'轻断食 · 时间安排',description:'每天在 8 小时内安排饮食，剩余 16 小时不摄入热量。',note:'不是必须跳过早餐，也不是窗口内随意吃。可选择符合日常作息的开始时间。',hours:8},
 {key:'fiveTwo',name:'5:2 间歇性能量限制',tag:'轻断食 · 需个别评估',description:'每周 5 天正常安排饮食，另外 2 个不连续的日子显著降低能量摄入。',note:'低能量日与普通每日目标不同，容易影响营养摄入、用药和训练恢复。本版提供方案说明，不自动生成或应用低能量日热量。',hours:0}
];
function strategy(f){const s=strategies.find(x=>x.key===(f.strategy||'balanced'));if(!s)throw Error('请选择支持的饮食方案');return s;}
function eatingWindow(f,s){if(!s.hours)return '';const v=f.windowStart||'08:00';if(!/^\d{2}:\d{2}$/.test(v))throw Error('请选择有效的开始时间');const [h,m]=v.split(':').map(Number);if(h>23||m>59||h*60+m+s.hours*60>=1440)throw Error('请将进食窗口安排在同一天内');return v+'–'+String(h+s.hours).padStart(2,'0')+':'+String(m).padStart(2,'0');}
function number(v,min,max,label){if(String(v===undefined?'':v).trim()==='')throw Error('请填写'+label);const n=Number(v);if(!Number.isFinite(n)||n<min||n>max)throw Error(label+'需为 '+min+'～'+max);return n;}
function estimate(f){
 const chosen=strategy(f);if(chosen.key==='fiveTwo')throw Error('5:2 需要个别评估，本版不自动生成低能量日目标；可选择均衡三餐或限时进食');
 if(f.suitability!=='adult')throw Error('本估算不适用于孕哺期、治疗饮食或进食障碍情况，请由医生或营养师制定目标');
 const age=number(f.age,19,78,'年龄'),height=number(f.height,120,230,'身高（厘米）'),weight=number(f.weight,35,250,'当前体重（公斤）');
 if(!Number.isInteger(age))throw Error('年龄请填写整数');
 if(!['male','female'].includes(f.sex))throw Error('请选择用于代谢估算的生理性别');
 if(!['maintain','lose','gain'].includes(f.goal))throw Error('请选择目标');
 const ai=Number(f.activity),ii=Number(f.intensity);const daily=Number.isInteger(ai)&&activity[ai],exercise=Number.isInteger(ii)&&intensity[ii];if(!daily||!exercise)throw Error('请选择日常活动与运动强度');
 const days=number(f.days,0,7,'每周运动天数');if(!Number.isInteger(days))throw Error('运动天数请填写整数');
 const minutes=days?number(f.minutes,1,180,'每次运动分钟'):0;
 const bmi=weight/(height/100)**2;if(f.goal==='lose'&&bmi<18.5)throw Error('当前体重偏低，不生成减脂目标，请选择维持或咨询营养师');
 if(chosen.hours&&(bmi<18.5||f.fastingSuitable!==true))throw Error('限时进食不适用于体重偏低、降糖用药或需随餐用药等情况，请确认适用范围或选择均衡三餐');
 const window=eatingWindow(f,chosen);
 const resting=10*weight+6.25*height-5*age+(f.sex==='male'?5:-161);
 const movement=(exercise.met-1)*weight*(minutes/60)*days/7;
 const maintenance=resting*daily.factor+movement;
 const factor={maintain:1,lose:.9,gain:1.05}[f.goal],floor=f.sex==='male'?1500:1200;
 const raw=maintenance*factor;const calories=Math.round(Math.max(raw,floor)/10)*10;
 if(calories>6000)throw Error('估算需求较高，请先核对活动量，并由营养师制定目标');
 const protein=Math.round(calories*.25/4),carb=Math.round(calories*.45/4),fat=Math.round(calories*.30/9);
 const ratios=f.snack?[.25,.35,.30,.10]:[.30,.40,.30];const names=chosen.hours?(f.snack?['第 1 餐','第 2 餐','第 3 餐','窗口内加餐']:['第 1 餐','第 2 餐','第 3 餐']):(f.snack?['早餐','午餐','晚餐','加餐']:['早餐','午餐','晚餐']);
 const totals={calories,protein,carb,fat},used={calories:0,protein:0,carb:0,fat:0};
 const meals=names.map((name,i)=>{const meal={name,percent:Math.round(ratios[i]*100)};Object.keys(totals).forEach(k=>{meal[k]=i===names.length-1?totals[k]-used[k]:Math.round(totals[k]*ratios[i]);used[k]+=meal[k];});return meal;});
 return {version:1,strategy:chosen.key,strategyName:chosen.name,eatingWindow:window,calories,protein,carb,fat,resting:Math.round(resting),movement:Math.round(movement),maintenance:Math.round(maintenance),factor:daily.factor,adjustment:f.goal==='lose'?'维持热量减少 10%':f.goal==='gain'?'维持热量增加 5%':'保持估算维持热量',floorApplied:raw<floor,meals,goal:f.goal,createdAt:Date.now()};
}
function patch(p){return {nutritionGoal:p.goal,dailyCalorieTarget:p.calories,proteinTarget:p.protein,carbTarget:p.carb,fatTarget:p.fat};}
module.exports={activity,intensity,strategies,strategy,eatingWindow,estimate,patch};
