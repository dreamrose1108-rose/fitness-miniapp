// 云函数 foodLib — 云端食物热量库（PG 版）
// 设计要点：
//  1. 官方库懒播种：首次调用时把 OFFICIAL_FOODS 写入 fit_foods（幂等，按 name 去重）
//  2. 用户自定义食物：source='custom'，仅本人可见，写入前经内容安全检查
//  3. 搜索 = 官方库(全员) + 本人自定义，按使用热度降序
//  4. 使用热度回传：记录时调用，热度 +1
// 热量为常见参考值（kcal/100g 或 kcal/100ml），仅供估算，非医疗建议
const cloud = require('wx-server-sdk');
const { one, str, jsonb, newId } = require('./fitdb');
cloud.init({ env: 'everyday-rose-d0gihszbt1940f4d1' });

const OFFICIAL_FOODS = [
  { name: '米饭（熟）', cat: '主食', kcal: 116, unit: '100g' },
  { name: '全麦面包', cat: '主食', kcal: 246, unit: '100g' },
  { name: '燕麦片', cat: '主食', kcal: 367, unit: '100g' },
  { name: '红薯（蒸）', cat: '主食', kcal: 99, unit: '100g' },
  { name: '玉米（煮）', cat: '主食', kcal: 112, unit: '100g' },
  { name: '馒头', cat: '主食', kcal: 223, unit: '100g' },
  { name: '荞麦面（熟）', cat: '主食', kcal: 99, unit: '100g' },
  { name: '饺子（猪肉）', cat: '主食', kcal: 232, unit: '100g' },
  { name: '鸡蛋（煮）', cat: '蛋白', kcal: 144, unit: '100g' },
  { name: '鸡胸肉（煮）', cat: '蛋白', kcal: 133, unit: '100g' },
  { name: '鸡腿肉（去皮）', cat: '蛋白', kcal: 146, unit: '100g' },
  { name: '牛肉（瘦）', cat: '蛋白', kcal: 106, unit: '100g' },
  { name: '猪里脊', cat: '蛋白', kcal: 155, unit: '100g' },
  { name: '三文鱼', cat: '蛋白', kcal: 208, unit: '100g' },
  { name: '虾（白灼）', cat: '蛋白', kcal: 93, unit: '100g' },
  { name: '鳕鱼', cat: '蛋白', kcal: 88, unit: '100g' },
  { name: '豆腐', cat: '蛋白', kcal: 81, unit: '100g' },
  { name: '豆浆（无糖）', cat: '饮品', kcal: 31, unit: '100ml' },
  { name: '鸡蛋清', cat: '蛋白', kcal: 60, unit: '100g' },
  { name: '牛奶（全脂）', cat: '饮品', kcal: 65, unit: '100ml' },
  { name: '牛奶（低脂）', cat: '饮品', kcal: 45, unit: '100ml' },
  { name: '无糖酸奶', cat: '饮品', kcal: 60, unit: '100g' },
  { name: '黑咖啡', cat: '饮品', kcal: 2, unit: '100ml' },
  { name: '苹果', cat: '果蔬', kcal: 52, unit: '100g' },
  { name: '香蕉', cat: '果蔬', kcal: 89, unit: '100g' },
  { name: '橙子', cat: '果蔬', kcal: 47, unit: '100g' },
  { name: '蓝莓', cat: '果蔬', kcal: 57, unit: '100g' },
  { name: '西兰花', cat: '果蔬', kcal: 34, unit: '100g' },
  { name: '番茄', cat: '果蔬', kcal: 18, unit: '100g' },
  { name: '黄瓜', cat: '果蔬', kcal: 15, unit: '100g' },
  { name: '生菜', cat: '果蔬', kcal: 15, unit: '100g' },
  { name: '菠菜', cat: '果蔬', kcal: 28, unit: '100g' },
  { name: '胡萝卜', cat: '果蔬', kcal: 39, unit: '100g' },
  { name: '蘑菇', cat: '果蔬', kcal: 24, unit: '100g' },
  { name: '牛油果', cat: '果蔬', kcal: 160, unit: '100g' },
  { name: '西瓜', cat: '果蔬', kcal: 31, unit: '100g' },
  { name: '葡萄', cat: '果蔬', kcal: 45, unit: '100g' },
  { name: '坚果（混合）', cat: '脂肪', kcal: 607, unit: '100g' },
  { name: '花生', cat: '脂肪', kcal: 574, unit: '100g' },
  { name: '橄榄油', cat: '脂肪', kcal: 899, unit: '100g' },
  { name: '薯条', cat: '快餐', kcal: 323, unit: '100g' },
  { name: '汉堡（牛肉）', cat: '快餐', kcal: 250, unit: '100g' },
  { name: '披萨', cat: '快餐', kcal: 266, unit: '100g' },
  { name: '炸鸡', cat: '快餐', kcal: 279, unit: '100g' },
  { name: '可乐', cat: '快餐', kcal: 43, unit: '100ml' },
  { name: '蛋糕（奶油）', cat: '快餐', kcal: 348, unit: '100g' }
];

// 内容安全检查（结果以官方 msgSecCheck 返回为准）
async function checkText(content, openid) {
  try {
    const res = await cloud.openapi.security.msgSecCheck({
      content, version: 2, scene: 2, openid
    });
    return res.result && res.result.suggest === 'pass';
  } catch (err) {
    console.error('msgSecCheck error:', err);
    return false;
  }
}

function likePattern(kw) {
  return '%' + String(kw).replace(/[\\%_]/g, m => '\\' + m) + '%';
}

// 懒播种官方库（幂等，按 name 去重）
async function seedOfficial() {
  const cnt = await one(`SELECT count(*)::int FROM public.fit_foods WHERE data->>'source'='official'`);
  if (cnt && cnt[0] >= OFFICIAL_FOODS.length) return;
  for (const f of OFFICIAL_FOODS) {
    await one(
      `INSERT INTO public.fit_foods (id, data)
       SELECT ${str(newId('f'))}, ${jsonb(Object.assign({}, f, { source: 'official', useCount: 0, ownerOpenid: '', createdAt: Date.now() }))}
       WHERE NOT EXISTS (SELECT 1 FROM public.fit_foods WHERE data->>'source'='official' AND data->>'name'=${str(f.name)})`
    );
  }
}

async function searchFoods(whereSql, orderLimit) {
  const row = await one(
    `SELECT COALESCE(jsonb_agg(jsonb_build_object('_id', id) || data ORDER BY (data->>'useCount')::int DESC), '[]'::jsonb)::text
     FROM (SELECT id, data FROM public.fit_foods WHERE ${whereSql} ${orderLimit}) t`
  );
  return row ? JSON.parse(row[0]) : [];
}

exports.main = async (event, context) => {
  const { action } = event;
  const openid = cloud.getWXContext().OPENID;
  if (!openid) return { code: -1, msg: '登录态缺失，请从小程序内调用' };

  try {
    switch (action) {
      // 搜索：官方 + 本人自定义
      case 'search': {
        await seedOfficial();
        const { keyword = '', cat = '全部', limit = 50 } = event;
        const conds = [];
        if (keyword) conds.push(`data->>'name' ILIKE ${str(likePattern(keyword))} ESCAPE '\\'`);
        if (cat && cat !== '全部') conds.push(`data->>'cat'=${str(cat)}`);
        const cond = conds.length ? ' AND ' + conds.join(' AND ') : '';

        const [custom, official] = await Promise.all([
          searchFoods(`data->>'source'='custom' AND data->>'ownerOpenid'=${str(openid)}${cond}`, `LIMIT 20`),
          searchFoods(`data->>'source'='official'${cond}`, `LIMIT ${Math.min(limit, 100)}`)
        ]);
        // 自定义排前面（个人习惯优先）
        return { code: 0, data: [...custom, ...official], msg: 'ok' };
      }

      // 添加自定义食物
      case 'addCustom': {
        const { name, cat, kcal, unit } = event;
        if (!name || !name.trim()) return { code: -1, msg: '食物名称不能为空' };
        if (!kcal || kcal <= 0) return { code: -1, msg: '热量需为正数' };
        const safe = await checkText(name.trim(), openid);
        if (!safe) return { code: -1, msg: '名称包含不适宜内容' };
        // 与官方或本人自定义重名则拒绝
        const dup = await one(
          `SELECT count(*)::int FROM public.fit_foods
           WHERE data->>'name'=${str(name.trim())}
             AND (data->>'source'='official' OR (data->>'source'='custom' AND data->>'ownerOpenid'=${str(openid)}))`
        );
        if (dup && dup[0] > 0) return { code: -1, msg: '该食物已存在' };

        const id = newId('f');
        await one(
          `INSERT INTO public.fit_foods (id, data) VALUES (${str(id)}, ${jsonb({
            name: name.trim(),
            cat: cat || '其他',
            kcal: Math.round(kcal),
            unit: unit || '100g',
            source: 'custom',
            ownerOpenid: openid,
            useCount: 0,
            createdAt: Date.now()
          })})`
        );
        return { code: 0, data: { id }, msg: 'ok' };
      }

      // 使用热度 +1（记录饮食时调用）
      case 'used': {
        const { foodId } = event;
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
