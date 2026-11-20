const library=require('./exercise-library');
const {validate}=require('./training-draft-schema');
const {formatDate}=require('./date');
function draft(input){const clean=validate(input,id=>library.get(id));if(!/^[a-zA-Z0-9_-]{8,80}$/.test(input.id||''))throw Error('计划标识无效，请重新生成');return {...clean,id:input.id};}
function date(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))throw Error('日期无效');const [y,m,d]=value.split('-').map(Number),v=new Date(y,m-1,d,12);if(formatDate(v)!==value)throw Error('日期无效');return v;}
function addDays(value,offset){const d=date(value);d.setDate(d.getDate()+offset);return formatDate(d);}
function key(){const owner=getApp().globalData.openid;if(!owner)throw Error('请先登录');return 'trainingSchedule:v1:'+owner;}
function read(){const raw=wx.getStorageSync(key());if(!raw)return [];if(raw.version!==1||!Array.isArray(raw.entries))throw Error('本机日程数据无效，请勿覆盖');return raw.entries;}
function preview(input,start,overrides={}){const plan=draft(input);date(start);return plan.days.map(d=>{const scheduled=overrides[d.offset]||addDays(start,d.offset);date(scheduled);return {date:scheduled,sourceKey:plan.id+':'+start+':'+d.offset,planId:plan.id,planTitle:plan.title,title:d.title,exercises:d.exercises,done:{}};});}
function save(input,start,overrides={},skipConflicts=false){
  const rows=preview(input,start,overrides),today=formatDate(),seen=new Set();
  rows.forEach(r=>{if(r.date<today||r.date>addDays(today,365))throw Error('训练日期需在今天起一年内');if(seen.has(r.date))throw Error('同一天只能安排一次训练');seen.add(r.date);});
  const existing=read(),conflicts=rows.filter(r=>existing.some(x=>x.date===r.date&&x.sourceKey!==r.sourceKey));
  if(conflicts.length&&!skipConflicts)return {conflicts:conflicts.map(r=>r.date),added:0};
  const added=rows.filter(r=>!existing.some(x=>x.date===r.date||x.sourceKey===r.sourceKey));
  if(existing.length+added.length>365)throw Error('本机日程已满，请先移除旧安排');
  if(added.length)wx.setStorageSync(key(),{version:1,entries:existing.concat(added).sort((a,b)=>a.date.localeCompare(b.date))});
  return {conflicts:conflicts.map(r=>r.date),added:added.length};
}
function toggle(sourceKey,id){const entries=read();const row=entries.find(x=>x.sourceKey===sourceKey);if(!row||!row.exercises.some(x=>x.id===id))throw Error('训练动作不存在');row.done={...row.done,[id]:!row.done[id]};wx.setStorageSync(key(),{version:1,entries});}
function remove(sourceKey){const entries=read();wx.setStorageSync(key(),{version:1,entries:entries.filter(x=>x.sourceKey!==sourceKey)});}
module.exports={draft,date,addDays,read,preview,save,toggle,remove};
