const { call } = require('./cloud.js');
const cache = new Map();
// HTTP gateway body limit also includes base64 expansion and authentication.
const MAX_BYTES = 80 * 1024;
async function uploadPhoto(filePath) {
  const fs = wx.getFileSystemManager();
  const read = p => new Promise((resolve, reject) => fs.readFile({ filePath:p, encoding:'base64', success:r=>resolve(r.data), fail:reject }));
  let base64 = await read(filePath);
  for (const [quality,compressedWidth] of [[40,1280],[25,960],[15,640]]) {
    if (base64.length <= Math.ceil(MAX_BYTES / 3) * 4) break;
    if (typeof wx.compressImage !== 'function') break;
    try {
      const compressed = await wx.compressImage({src:filePath,quality,compressedWidth});
      base64 = await read(compressed.tempFilePath);
    } catch (_) {}
  }
  if (base64.length > Math.ceil(MAX_BYTES / 3) * 4) throw new Error('照片压缩后仍较大，请裁剪餐食区域后重试');
  return call('record', { action:'photoUpload', base64 });
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
