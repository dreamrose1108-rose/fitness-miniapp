const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function harness(res) {
  const mod = { exports: {} }; const modals = [];
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../miniprogram/utils/cloud.js'), 'utf8'), {
    module: mod, wx: { request: options => options.success(res), showModal: options => modals.push(options), getStorageSync: () => '', showToast() {} }
  });
  return { api: mod.exports, modals };
}
test('网络分类及弹窗不暴露原始凭据', () => {
  const { api, modals } = harness();
  for (const [message, code] of [['request:fail url not in domain list','DOMAIN'],['request:fail ssl error','TLS'],['request:fail timeout','TIMEOUT'],['request:fail ERR_NAME_NOT_RESOLVED','DNS'],['login:fail','WX_LOGIN']]) {
    assert.equal(api.classifyError({errMsg:message}),code);
  }
  api.reportRequestError({errMsg:'request:fail secret-token'},'/fit-login');
  api.reportRequestError({errMsg:'request:fail'},'/fit-record');
  assert.equal(modals.length,1);
  assert.ok(!modals[0].content.includes('secret-token'));
  modals[0].complete();
  api.reportRequestError({},'/fit-login');
  assert.equal(modals.length,2);
});
test('HTTP 错误和异常响应格式单独分类', async () => {
  for (const [response, code] of [[{statusCode:502,data:'bad gateway'},'HTTP_502'],[{statusCode:200,data:'html'},'BAD_RESPONSE']]) {
    await assert.rejects(harness(response).api.rawPost('/fit-login',{}), e => e.diagnosticCode === code);
  }
  assert.equal((await harness({statusCode:200,data:{code:0}}).api.rawPost('/fit-login',{})).code,0);
});
