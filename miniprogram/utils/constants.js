// utils/constants.js — 内置基础数据表（热量为常见参考值，仅供估算，非医疗建议）

// 常见食物热量表（单位：kcal / 100g）
const FOOD_DB = require('./food-catalog/index.js').foods;

const FOOD_CATEGORIES = ['全部', '主食', '蛋白', '果蔬', '饮品', '坚果', '零食', '脂肪', '快餐', '调味', '其他'];
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
