const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../miniprogram/pages/diet/diet.js'), 'utf8');
function setup(call = async () => [], deletePhoto = async () => {}) {
  let page, modal;
  const timers = new Map();
  let timerId = 0;
  vm.runInNewContext(source, {
    getApp: () => ({ login: async () => 'user' }),
    Page: value => { page = value; },
    require: name => name.includes('food-portions') ? require('../miniprogram/utils/food-portions') : name.includes('food-cache') ? {read:()=>null,write:()=>true} : name.includes('food-catalog') ? require('../shared/food-catalog') : name.includes('nutrition-plan') ? require('../miniprogram/utils/nutrition-plan') : name.includes('photos') ? {deletePhoto, readPhoto: async () => 'local-photo'} : name.includes('cloud') ? { call } : name.includes('date') ? { formatDate: () => '2026-11-19' } : {
      FOOD_DB: require('../shared/food-catalog').foods, FOOD_CATEGORIES: [], MEAL_TYPES: []
    },
    wx: { showModal: value => { modal = value; }, showToast() {}, cloud: { deleteFile: async () => {} } },
    setTimeout: fn => { timers.set(++timerId, fn); return timerId; },
    clearTimeout: id => timers.delete(id)
  });
  page.setData = function(data, callback) { Object.assign(this.data, data); if (callback) callback.call(this); };
  return { page, modal: () => modal, runTimer: () => { const [id, fn] = timers.entries().next().value; timers.delete(id); return fn(); } };
}
const foodEvent = { currentTarget: { dataset: { food: { name: '米饭', kcal: 100, unit: '100g' } } } };
test('离线完整库匹配简繁与别名，切换关键词不残留旧结果', () => {
  const h=setup();h.page.data.usingLocalDb=true;
  for(const keyword of ['橘子','桔子','雞胸','西红柿']){h.page.data.keyword=keyword;h.page.filterFoods();assert.ok(h.page.data.filteredFoods.length>0,keyword);}
  h.page.data.keyword='不存在的食物123';h.page.filterFoods();assert.equal(h.page.data.filteredFoods.length,0);
});
test('空关键词分页可查看超过100条食物',()=>{
  const h=setup();h.page.filterFoods();assert.equal(h.page.data.filteredFoods.length,100);
  assert.ok(h.page.data.filteredTotal>2000);h.page.loadMoreFoods();assert.equal(h.page.data.filteredFoods.length,200);
});
test('迟到的云端目录不能覆盖后一次同步',async()=>{
  const pending=[];const h=setup(()=>new Promise(r=>pending.push(r)));
  const first=h.page.loadCloudFoods(),second=h.page.loadCloudFoods();
  pending[1]({foods:[{_id:'new',name:'新的测试食物',kcal:10,source:'official'}],version:'new'});await second;
  pending[0]({foods:[{_id:'old',name:'旧的测试食物',kcal:10,source:'official'}],version:'old'});await first;
  assert.equal(h.page.data.foodVersion,require('../shared/food-catalog').meta.version);assert.ok(h.page._foods.some(f=>f._id==='new'));assert.ok(!h.page._foods.some(f=>f._id==='old'));
});

test('提交期间禁止重复选择和关闭，并保留最初餐次', async () => {
  let resolve; const calls = [];
  const h = setup((name, data) => { calls.push(data); return new Promise(r => { resolve = r; }); });
  h.page.data.showPicker = true;
  h.page.selectFood(foodEvent); const first = h.page._portionContext;
  h.page.selectFood(foodEvent); assert.equal(h.page._portionContext, first);
  h.page.data.activeMeal = 'dinner';
  h.page.onPortionQuantity({detail:{value:'150'}});const saving = h.page.submitPortion();
  h.page.closePicker(); assert.equal(h.page.data.showPicker, true);
  assert.equal(calls[0].data.mealType, 'breakfast');
  assert.equal(calls[0].data.kcal, 150);
  resolve({}); await saving;
  assert.equal(h.page.data.showPicker, false);
  assert.equal(h.page._foodSelectionBusy, false);
});
test('异常数值不提交且可重新选择', async () => {
  let calls = 0; const h = setup(async () => { calls++; });
  for (const content of ['Infinity', 'NaN', '-1', '0', '1e309']) {
    h.page.selectFood(foodEvent);
    h.page.onPortionQuantity({detail:{value:content}});await h.page.submitPortion();h.page.closePortion();
    assert.equal(h.page._foodSelectionBusy, false);
  }
  h.page.data.cfName = '测试'; h.page.data.cfKcal = 'Infinity';
  await h.page.submitCustom();
  assert.equal(calls, 0);
});
test('提交失败后允许重试', async () => {
  const h = setup(async () => { throw new Error('network'); });
  h.page.selectFood(foodEvent);
  h.page.onPortionQuantity({detail:{value:'100'}});await h.page.submitPortion();
  assert.equal(h.page.data.portionSaving, false);h.page.closePortion();
  h.page.selectFood(foodEvent);
  assert.equal(h.page._foodSelectionBusy, true);
});

test('清理照片失败保留ID，成功重试后才清空', async () => {
 let fail=true; const h=setup(undefined,async()=>{if(fail)throw new Error('network')});
 h.page.data.pendingPhoto='owned-photo';
 assert.equal(await h.page.clearPendingPhoto(),false);assert.equal(h.page.data.pendingPhoto,'owned-photo');
 fail=false;assert.equal(await h.page.clearPendingPhoto(),true);assert.equal(h.page.data.pendingPhoto,'');
});

test('家用份量按可食重量计算并保留选择，提交失败不丢输入',async()=>{
 let saved;const h=setup(async(name,data)=>{if(data.action==='add')saved=data.data;return [];});
 h.page.selectFood({currentTarget:{dataset:{food:{name:'香蕉',unit:'100g',kcal:89,protein:1.1}}}});
 h.page.onPortionUnit({currentTarget:{dataset:{index:2}}});h.page.onPortionQuantity({detail:{value:'0.5'}});
 assert.equal(h.page.data.portionResult.amount,59);await h.page.submitPortion();
 assert.equal(saved.portionLabel,'0.5个（中）');assert.equal(saved.amount,59);assert.equal(saved.kcal,53);assert.equal(saved.proteinG,0.65);assert.equal(saved.amountUnit,'g');
});
