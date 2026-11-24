// 云函数 foodLib — 云端食物热量库（HTTP 版）
// 版本化公共食物库 + 数据库增量；本函数负责同步/搜索/自定义/热度
// 热量为常见参考值（kcal/100g 或 kcal/100ml），仅供估算，非医疗建议
const { one, str, jsonb, newId } = require('./fitdb');
const { parseEvent, getOpenid, msgSecCheck } = require('./fitauth');

function likePattern(kw) {
  return '%' + String(kw).replace(/[\\%_]/g, m => '\\' + m) + '%';
}

async function searchFoods(whereSql, orderLimit) {
  const row = await one(
    `SELECT COALESCE(jsonb_agg(jsonb_build_object('_id', id) || data ORDER BY (data->>'useCount')::int DESC), '[]'::jsonb)::text
     FROM (SELECT id, data FROM public.fit_foods WHERE ${whereSql} ${orderLimit}) t`
  );
  return row ? JSON.parse(row[0]) : [];
}

exports.main = async (event) => {
  const params = parseEvent(event);
  const openid = getOpenid(params);
  if (!openid) return { code: -1, msg: '登录态缺失或已过期，请重启小程序' };
  const { action } = params;

  try {
    switch (action) {
      // 搜索：官方 + 本人自定义
      case 'catalog': {
        return { code: 0, data: await require('./food-service').load(openid), msg: 'ok' };
      }
      case 'search': {
        const result = await require('./food-service').search(openid, params.keyword || '', params.cat || '全部', params.limit, params.offset);
        return { code: 0, data: result.foods, total: result.total, version: result.version, msg: 'ok' };
      }

      // 添加自定义食物
      case 'addCustom': {
        const { name, cat, kcal, unit } = params;
        if (!name || !name.trim()) return { code: -1, msg: '食物名称不能为空' };
        if (!kcal || kcal <= 0) return { code: -1, msg: '热量需为正数' };
        const safe = await msgSecCheck(name.trim(), openid);
        if (!safe) return { code: -1, msg: '名称包含不适宜内容' };
        const dup = await one(
          `SELECT count(*)::int FROM public.fit_foods
           WHERE data->>'name'=${str(name.trim())}
             AND (data->>'source'='official' OR (data->>'source'='custom' AND data->>'ownerOpenid'=${str(openid)}))`
        );
        if (dup && dup[0] > 0) return { code: -1, msg: '该食物已存在' };

        // 宏量营养素（可选，克/100g）
        const macro = {};
        ['protein', 'carb', 'fat'].forEach(k => {
          const v = Number(params[k]);
          if (v >= 0 && v < 200) macro[k] = Math.round(v * 10) / 10;
        });

        const id = newId('f');
        await one(
          `INSERT INTO public.fit_foods (id, data) VALUES (${str(id)}, ${jsonb(Object.assign({
            name: name.trim(),
            cat: cat || '其他',
            kcal: Math.round(kcal),
            unit: unit || '100g',
            source: 'custom',
            ownerOpenid: openid,
            useCount: 0,
            createdAt: Date.now()
          }, macro))})`
        );
        return { code: 0, data: { id }, msg: 'ok' };
      }

      // 使用热度 +1（记录饮食时调用）
      case 'used': {
        const { foodId } = params;
        await one(
          `UPDATE public.fit_foods
           SET data = jsonb_set(data, '{useCount}', to_jsonb(COALESCE((data->>'useCount')::int, 0) + 1))
           WHERE id=${str(foodId)}`
        );
        return { code: 0, data: { ok: true }, msg: 'ok' };
      }

      default:
        return { code: -1, msg: '未知操作' };
    }
  } catch (err) {
    console.error('foodLib error:', err);
    return { code: -1, msg: '服务异常' };
  }
};
