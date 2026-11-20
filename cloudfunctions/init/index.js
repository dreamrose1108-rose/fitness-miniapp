// 云函数 init — 表结构健康检查（HTTP 版，无需鉴权）
const { query } = require('./fitdb');
const { parseEvent } = require('./fitauth');

const TABLES = ['fit_users', 'fit_diet_records', 'fit_exercise_records', 'fit_body_records', 'fit_coach_chats', 'fit_foods'];

exports.main = async (event) => {
  parseEvent(event); // 兼容网关事件
  try {
    const rows = await query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'fit_%'`
    );
    const present = rows.map(r => r[0]);
    const data = TABLES.map(t => ({ name: t, status: present.includes(t) ? 'ready' : 'missing' }));
    const ok = data.every(t => t.status === 'ready');
    return { code: ok ? 0 : -1, data, msg: ok ? '表结构就绪' : '部分表缺失' };
  } catch (err) {
    console.error('init error:', err);
    return { code: -1, msg: '服务异常' };
  }
};
