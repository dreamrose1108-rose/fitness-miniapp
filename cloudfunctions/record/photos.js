const CloudBase = require('@cloudbase/manager-node');
const crypto = require('crypto');
const { one, str, ENV_ID } = require('./fitdb');
let app;
const storage = () => (app || (app = CloudBase.init({ envId: ENV_ID }))).storage;
const MAX_BYTES = 512 * 1024;
function ownerPrefix(openid) { return 'diet-photos/' + crypto.createHash('sha256').update(openid).digest('hex') + '/'; }
function ownedPhoto(fileID, openid) {
  const prefix = ownerPrefix(openid);
  return typeof fileID === 'string' && fileID.startsWith(prefix) && /^[a-f0-9]{32}\.(jpg|png)$/.test(fileID.slice(prefix.length));
}
function imageType(bytes) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpg';
  throw new Error('仅支持 JPG 或 PNG 图片');
}
// 管理SDK仅解析当前环境配置和运行时临时凭证；数据经私有COS对象接口传输。
async function objectCall(method, fileID, extra = {}) {
  const service = storage();
  await service.environment.lazyInit();
  const { bucket, region, basePath } = service.getStorageConfig();
  const prefix = (basePath || '').replace(/^\/+|\/+$/g, '');
  const Key = (prefix ? prefix + '/' : '') + fileID;
  const cos = service.getCos();
  return new Promise((resolve, reject) => cos[method]({ Bucket: bucket, Region: region, Key, ...extra }, (err, data) => err ? reject(err) : resolve(data)));
}
async function handlePhoto(params, openid) {
  if (params.action === 'photoUpload') {
    const input = params.base64;
    if (typeof input !== 'string' || !input.length || input.length > Math.ceil(MAX_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(input)) throw new Error('图片过大或格式无效，请选择小于512KB的图片');
    const bytes = Buffer.from(input, 'base64');
    if (!bytes.length || bytes.length > MAX_BYTES) throw new Error('图片过大');
    const ext = imageType(bytes);
    const fileID = ownerPrefix(openid) + crypto.randomBytes(16).toString('hex') + '.' + ext;
    await objectCall('putObject', fileID, { Body: bytes, ACL: 'private', ContentType: ext === 'png' ? 'image/png' : 'image/jpeg' });
    return { fileID };
  }
  const fileID = params.fileID;
  if (!ownedPhoto(fileID, openid)) throw new Error('无权操作此照片');
  if (params.action === 'photoRead') {
    const result = await objectCall('getObject', fileID, { Range: 'bytes=0-' + MAX_BYTES });
    const bytes = Buffer.isBuffer(result.Body) ? result.Body : Buffer.from(result.Body);
    if (bytes.length > MAX_BYTES) throw new Error('图片过大');
    return { base64: bytes.toString('base64'), extension: imageType(bytes) };
  }
  if (params.action === 'photoDelete') {
    const linked = await one(`SELECT count(*)::int FROM public.fit_diet_records WHERE data->>'photoFileID'=${str(fileID)}`);
    if (Number(linked && linked[0]) > 0) throw new Error('照片仍被饮食记录使用');
    // 管理SDK根据环境解析共享桶前缀，只删除经过所有权校验的单个文件。
    await objectCall('deleteObject', fileID);
    return { removed: true };
  }
  throw new Error('未知照片操作');
}
module.exports = { handlePhoto, ownedPhoto, imageType, MAX_BYTES, objectCall };
