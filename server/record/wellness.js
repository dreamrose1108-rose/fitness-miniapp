const { query, one, str, jsonb, newId } = require('./fitdb');
const fs = require('fs');
const path = require('path');
let ready;
// 固定、版本化迁移；仅由已验证身份的服务端入口触发，不接受外部SQL。
function ensureWaterSchema() {
  if (!ready) ready = (async () => {
    const columns = await query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='fit_water_records'");
    if (columns.length && !(['id','data'].every(k => columns.some(r => r[0] === k)))) throw new Error('饮水表结构不兼容');
    const statements = fs.readFileSync(path.join(__dirname, 'migrations/20261119103500_water.sql'), 'utf8').split(';').map(s => s.trim()).filter(Boolean);
    for (const sql of statements) await query(sql);
    const checked = await query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='fit_water_records'");
    if (!checked.some(r => r[0] === 'id' && r[1] === 'text') || !checked.some(r => r[0] === 'data' && r[1] === 'jsonb')) throw new Error('饮水表结构校验失败');
  })().catch(e => { ready = null; throw e; });
  return ready;
}
function validDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s;
}
async function handleWellness(p, openid) {
  const owner = `data->>'openid'=${str(openid)}`;
  if (p.action === 'calendar') {
    if (!validDate(p.start) || !validDate(p.end) || p.start > p.end || (Date.parse(p.end)-Date.parse(p.start))/86400000 > 62) throw new Error('日期范围无效');
    await ensureWaterSchema();
    const range = `${owner} AND data->>'date' BETWEEN ${str(p.start)} AND ${str(p.end)}`;
    const specs = [['diet','fit_diet_records','kcal'],['exercise','fit_exercise_records','kcalBurned'],['body','fit_body_records','weight'],['water','fit_water_records','ml']];
    const days = {};
    await Promise.all(specs.map(async ([kind,table,field]) => {
      const agg = kind === 'body' ? 'max' : 'sum';
      const rows = await query(`SELECT data->>'date', count(*)::int, ${agg}((data->>'${field}')::numeric) FROM public.${table} WHERE ${range} GROUP BY 1 ORDER BY 1`);
      rows.forEach(([date,count,value]) => { if (!days[date]) days[date] = { date }; days[date][kind+'Count'] = Number(count); days[date][kind] = Number(value); });
    }));
    return Object.values(days).sort((a,b) => a.date.localeCompare(b.date));
  }
  if (!validDate(p.date)) throw new Error('日期无效');
  if (p.action === 'waterAdd' && (!Number.isInteger(p.ml) || p.ml < 1 || p.ml > 2000)) throw new Error('每次请输入1～2000毫升');
  if (p.action === 'waterAdd' && (typeof p.requestId !== 'string' || !/^[a-zA-Z0-9_-]{10,80}$/.test(p.requestId))) throw new Error('记录编号无效');
  await ensureWaterSchema();
  if (p.action === 'waterAdd') {
    const data = { openid, date:p.date, ml:p.ml, createdAt:Date.now(), requestId:p.requestId };
    await one(`INSERT INTO public.fit_water_records (id,data) VALUES (${str(newId('w'))},${jsonb(data)}) ON CONFLICT ((data->>'openid'),(data->>'requestId')) DO NOTHING`);
  } else if (p.action === 'waterRemove') {
    if (typeof p.id !== 'string' || !p.id) throw new Error('记录编号无效');
    await one(`DELETE FROM public.fit_water_records WHERE ${owner} AND id=${str(p.id)} AND data->>'date'=${str(p.date)}`);
  } else if (p.action !== 'waterList') throw new Error('未知操作');
  const where = `${owner} AND data->>'date'=${str(p.date)}`;
  const [rows,total] = await Promise.all([
    query(`SELECT id,data::text FROM public.fit_water_records WHERE ${where} ORDER BY (data->>'createdAt')::bigint DESC LIMIT 100`),
    one(`SELECT COALESCE(sum((data->>'ml')::int),0),count(*)::int FROM public.fit_water_records WHERE ${where}`)
  ]);
  return { records:rows.map(r => Object.assign({_id:r[0]},JSON.parse(r[1]))),total:Number(total ? total[0]:0),count:Number(total ? total[1]:0) };
}
module.exports = { handleWellness, validDate };
