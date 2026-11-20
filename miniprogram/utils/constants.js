// utils/constants.js — 内置基础数据表（热量为常见参考值，仅供估算，非医疗建议）

// 常见食物热量表（单位：kcal / 100g）
const FOOD_DB = [
  { name: '米饭（熟）', cat: '主食', kcal: 116, unit: '100g' },
  { name: '全麦面包', cat: '主食', kcal: 246, unit: '100g' },
  { name: '燕麦片', cat: '主食', kcal: 367, unit: '100g' },
  { name: '红薯（蒸）', cat: '主食', kcal: 99, unit: '100g' },
  { name: '玉米（煮）', cat: '主食', kcal: 112, unit: '100g' },
  { name: '鸡蛋（煮）', cat: '蛋白', kcal: 144, unit: '100g' },
  { name: '鸡胸肉（煮）', cat: '蛋白', kcal: 133, unit: '100g' },
  { name: '牛肉（瘦）', cat: '蛋白', kcal: 106, unit: '100g' },
  { name: '三文鱼', cat: '蛋白', kcal: 208, unit: '100g' },
  { name: '豆腐', cat: '蛋白', kcal: 81, unit: '100g' },
  { name: '牛奶（低脂）', cat: '饮品', kcal: 45, unit: '100ml' },
  { name: '无糖酸奶', cat: '饮品', kcal: 60, unit: '100g' },
  { name: '苹果', cat: '果蔬', kcal: 52, unit: '100g' },
  { name: '香蕉', cat: '果蔬', kcal: 89, unit: '100g' },
  { name: '西兰花', cat: '果蔬', kcal: 34, unit: '100g' },
  { name: '番茄', cat: '果蔬', kcal: 18, unit: '100g' }
];

const FOOD_CATEGORIES = ['全部', '主食', '蛋白', '果蔬', '饮品'];
const MEAL_TYPES = [
  { key: 'breakfast', label: '早餐' },
  { key: 'lunch', label: '午餐' },
  { key: 'dinner', label: '晚餐' },
  { key: 'snack', label: '加餐' }
];

// 运动 MET 值（代谢当量），消耗 kcal = MET × 体重kg × 时长h
const EXERCISE_DB = [
  { name: '快走', met: 4.3, icon: '🚶' },
  { name: '跑步', met: 9.8, icon: '🏃' },
  { name: '骑行', met: 7.5, icon: '🚴' },
  { name: '游泳', met: 8.0, icon: '🏊' },
  { name: '跳绳', met: 11.8, icon: '🪢' },
  { name: '力量训练', met: 6.0, icon: '🏋️' },
  { name: '瑜伽', met: 3.0, icon: '🧘' },
  { name: 'HIIT', met: 10.0, icon: '🔥' }
];

module.exports = { FOOD_DB, FOOD_CATEGORIES, MEAL_TYPES, EXERCISE_DB };
