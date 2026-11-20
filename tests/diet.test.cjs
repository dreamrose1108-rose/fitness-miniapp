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
    require: name => name.includes('photos') ? {deletePhoto, readPhoto: async () => 'local-photo'} : name.includes('cloud') ? { call } : name.includes('date') ? { formatDate: () => '2026-11-19' } : {
      FOOD_DB: [{ name: '米饭', cat: '主食' }], FOOD_CATEGORIES: [], MEAL_TYPES: []
    },
    wx: { showModal: value => { modal = value; }, showToast() {}, cloud: { deleteFile: async () => {} } },
    setTimeout: fn => { timers.set(++timerId, fn); return timerId; },
    clearTimeout: id => timers.delete(id)
  });
  page.setData = function(data, callback) { Object.assign(this.data, data); if (callback) callback.call(this); };
  return { page, modal: () => modal, runTimer: () => { const [id, fn] = timers.entries().next().value; timers.delete(id); return fn(); } };
}
const foodEvent = { currentTarget: { dataset: { food: { name: '米饭', kcal: 100, unit: '100g' } } } };
test('旧搜索晚返回不会覆盖新搜索', async () => {
  const pending = [];
  const h = setup(() => new Promise(resolve => pending.push(resolve)));
  h.page.data.keyword = '旧'; h.page.filterFoods(); const old = h.runTimer();
  h.page.data.keyword = '新'; h.page.filterFoods(); const recent = h.runTimer();
  pending[1]([{ name: '新结果' }]); await recent;
  pending[0]([{ name: '旧结果' }]); await old;
  assert.equal(h.page.data.filteredFoods[0].name, '新结果');
});
test('切换本地库或卸载使在途搜索失效', async () => {
  for (const unload of [false, true]) {
    let resolve;
    const h = setup(() => new Promise(r => { resolve = r; }));
    h.page.filterFoods(); const running = h.runTimer();
    if (unload) h.page.onUnload();
    else { h.page.data.usingLocalDb = true; h.page.filterFoods(); }
    resolve([{ name: '过期结果' }]); await running;
    assert.equal(h.page.data.filteredFoods.length, unload ? 0 : 1);
    if (!unload) assert.equal(h.page.data.filteredFoods[0].name, '米饭');
  }
});
test('提交期间禁止重复选择和关闭，并保留最初餐次', async () => {
  let resolve; const calls = [];
  const h = setup((name, data) => { calls.push(data); return new Promise(r => { resolve = r; }); });
  h.page.data.showPicker = true;
  h.page.selectFood(foodEvent); const first = h.modal();
  h.page.selectFood(foodEvent); assert.equal(h.modal(), first);
  h.page.data.activeMeal = 'dinner';
  const saving = first.success({ confirm: true, content: '150' });
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
    await h.modal().success({ confirm: true, content });
    assert.equal(h.page._foodSelectionBusy, false);
  }
  h.page.data.cfName = '测试'; h.page.data.cfKcal = 'Infinity';
  await h.page.submitCustom();
  assert.equal(calls, 0);
});
test('提交失败后允许重试', async () => {
  const h = setup(async () => { throw new Error('network'); });
  h.page.selectFood(foodEvent);
  await h.modal().success({ confirm: true, content: '100' });
  assert.equal(h.page._foodSelectionBusy, false);
  h.page.selectFood(foodEvent);
  assert.equal(h.page._foodSelectionBusy, true);
});

test('清理照片失败保留ID，成功重试后才清空', async () => {
 let fail=true; const h=setup(undefined,async()=>{if(fail)throw new Error('network')});
 h.page.data.pendingPhoto='owned-photo';
 assert.equal(await h.page.clearPendingPhoto(),false);assert.equal(h.page.data.pendingPhoto,'owned-photo');
 fail=false;assert.equal(await h.page.clearPendingPhoto(),true);assert.equal(h.page.data.pendingPhoto,'');
});
