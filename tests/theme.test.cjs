const test=require('node:test'),assert=require('node:assert/strict');
const theme=require('../miniprogram/utils/theme');
test('global theme applies palette, chrome and refreshes existing page',()=>{
 let stored='cat';const nav=[],tab=[];global.wx={getStorageSync:()=>stored,setNavigationBarColor:v=>nav.push(v),setTabBarStyle:v=>tab.push(v),setBackgroundColor:()=>{}};
 const page={data:{},setData(v){Object.assign(this.data,v);}};
 theme.apply(page);assert.equal(page.data.theme,'cat');assert.ok(page.data.appThemeStyle.includes('--color-bg:#fff8f0'));assert.equal(nav.at(-1).backgroundColor,'#fff8f0');
 stored='forest';theme.apply(page);assert.equal(page.data.theme,'forest');assert.ok(page.data.appThemeStyle.includes('--color-primary:#2e7d5b'));assert.equal(tab.at(-1).selectedColor,'#2e7d5b');
 stored='invalid';assert.equal(theme.read(),'cat');global.wx.getStorageSync=()=>{throw Error('unavailable');};assert.equal(theme.read(),'cat');
});
