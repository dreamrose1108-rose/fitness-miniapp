const { call } = require('./cloud.js');
const cache = new Map();
// Gateway rejects bodies above ~100 KiB. 64 KiB becomes ~86 KiB of base64,
// leaving room for JSON, authentication and transport overhead.
const MAX_BYTES = 64 * 1024;
const fits = base64 => base64.length <= Math.floor(MAX_BYTES / 3) * 4;
async function canvasPhoto(filePath, read) {
  const canvas = await new Promise((resolve,reject) => {
    wx.createSelectorQuery().select('#meal-photo-canvas').fields({node:true}).exec(rows => {
      if (rows && rows[0] && rows[0].node) resolve(rows[0].node);
      else reject(new Error('照片处理画布未就绪'));
    });
  });
  const image = canvas.createImage();
  await new Promise((resolve,reject) => { image.onload=resolve;image.onerror=reject;image.src=filePath; });
  if (!image.width || !image.height) throw new Error('无法读取照片尺寸');
  try {
    // Re-encode PNG/phone photos as JPEG; bound BOTH dimensions, including portraits.
    for (const edge of [1280,960,640,480]) {
      const scale=Math.min(1,edge/Math.max(image.width,image.height));
      canvas.width=Math.max(1,Math.round(image.width*scale));
      canvas.height=Math.max(1,Math.round(image.height*scale));
      const ctx=canvas.getContext('2d');
      ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(image,0,0,canvas.width,canvas.height);
      for (const quality of [0.75,0.5,0.3]) {
        const result=await new Promise((resolve,reject)=>wx.canvasToTempFilePath({canvas,width:canvas.width,height:canvas.height,destWidth:canvas.width,destHeight:canvas.height,fileType:'jpg',quality,success:resolve,fail:reject}));
        const base64=await read(result.tempFilePath);
        if (fits(base64)) return base64;
      }
    }
    throw new Error('照片压缩后仍较大，请裁剪餐食区域后重试');
  } finally { canvas.width=1;canvas.height=1; }
}
async function uploadPhoto(filePath) {
  const fs = wx.getFileSystemManager();
  const read = p => new Promise((resolve, reject) => fs.readFile({ filePath:p, encoding:'base64', success:r=>resolve(r.data), fail:reject }));
  let base64 = await read(filePath);
  let dimensions;
  if (!fits(base64) && typeof wx.getImageInfo==='function') {
    try { dimensions=await new Promise((resolve,reject)=>wx.getImageInfo({src:filePath,success:resolve,fail:reject})); } catch (_) {}
  }
  for (const [quality,edge] of [[60,1280],[40,960],[25,640]]) {
    if (fits(base64)) break;
    if (typeof wx.compressImage !== 'function') break;
    try {
      const size=dimensions && dimensions.height>dimensions.width ? {compressedHeight:edge} : {compressedWidth:edge};
      const compressed = await wx.compressImage({src:filePath,quality,...size});
      base64 = await read(compressed.tempFilePath);
    } catch (_) {}
  }
  if (!fits(base64) && typeof wx.createSelectorQuery==='function') {
    try { base64=await canvasPhoto(filePath,read); }
    catch (_) { throw new Error('照片处理失败，请重新选图；可尝试截图后上传'); }
  }
  if (!fits(base64)) throw new Error('照片压缩后仍较大，请裁剪餐食区域后重试');
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
