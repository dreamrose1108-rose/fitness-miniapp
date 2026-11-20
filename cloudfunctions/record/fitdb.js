// fitdb.js — 卡路喵 PG 数据桥
// 模式复刻 EZ api 函数：@cloudbase/manager-node 在云函数运行时自动使用
// SCF 注入的临时凭证（无需保存任何密钥），通过 ExecutePGSql 执行 SQL。
const CloudBase = require('@cloudbase/manager-node');
const ENV_ID = 'everyday-rose-d0gihszbt1940f4d1';

let dbApi = null;
function db() {
  if (!dbApi) {
    const app = CloudBase.init({ envId: ENV_ID });
    dbApi = app.database;
  }
  return dbApi;
}

// 返回行数组；每行是列值数组（ExecutePGSql 的 Rows 为 JSON 字符串）
async function query(sql) {
  const result = await db().executePGSql({ EnvId: ENV_ID, Sql: sql });
  return (result.Rows || []).map(row => JSON.parse(row));
}

async function one(sql) {
  const rows = await query(sql);
  return rows.length ? rows[0] : null;
}

// SQL 字符串字面量（转义单引号）
function str(value) {
  if (value === undefined || value === null) return 'NULL';
  return "'" + String(value).replace(/'/g, "''") + "'";
}

// jsonb 字面量：base64 传输，杜绝注入
function jsonb(value) {
  const b64 = Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
  return `convert_from(decode('${b64}','base64'),'UTF8')::jsonb`;
}

function newId(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// 生成插入语句：id + data jsonb
function insertSql(table, data) {
  return `INSERT INTO public."${table}" (id, data) VALUES (${str(data.id || newId('r'))}, ${jsonb(data)})`;
}

module.exports = { query, one, str, jsonb, newId, insertSql, ENV_ID };
