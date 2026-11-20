const { call } = require('./cloud.js');
const cache = new Map();
const MAX_BYTES = 512 * 1024;
async function uploadPhoto(filePath) {
  const fs = wx.getFileSystemManager();
  const base64 = await new Promise((resolve, reject) => fs.readFile({ filePath, encoding: 'base64', success: r => resolve(r.data), fail: reject }));
  if (base64.length > Math.ceil(MAX_BYTES / 3) * 4) throw new Error('图片较大，请选择小于512KB的图片');
  return call('record', { action: 'photoUpload', base64 });
}
async function readPhoto(fileID) {
  if (cache.has(fileID)) return cache.get(fileID);
  const promise = (async () => {
    const r = await call('record', { action: 'photoRead', fileID });
    if (!r || !['jpg','png'].includes(r.extension) || typeof r.base64 !== 'string') throw new Error('图片内容无效');
    const localPath = wx.env.USER_DATA_PATH + '/meal-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + r.extension;
    await new Promise((resolve, reject) => wx.getFileSystemManager().writeFile({ filePath: localPath, data: r.base64, encoding: 'base64', success: resolve, fail: reject }));
    return localPath;
  })();
  cache.set(fileID, promise);
  try { return await promise; } catch (e) { cache.delete(fileID); throw e; }
}
async function deletePhoto(fileID) {
  const result = await call('record', { action: 'photoDelete', fileID });
  const local = cache.get(fileID); cache.delete(fileID);
  if (local) local.then(filePath => wx.getFileSystemManager().unlink({filePath, fail() {}})).catch(() => {});
  return result;
}
module.exports = { uploadPhoto, readPhoto, deletePhoto };
