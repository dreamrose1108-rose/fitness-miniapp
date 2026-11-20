const manifest = require('./exercise-media-manifest.json');
const { objectCall } = require('./photos');
function select(ids) {
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 30 || ids.some(id => typeof id !== 'string' || !/^\d{4}$/.test(id))) throw new Error('Invalid ids');
  return [...new Set(ids)].filter(id => Object.prototype.hasOwnProperty.call(manifest, id));
}
async function getMedia(ids) {
  const selected = select(ids);
  const sign = async file => {
    if (!/^exercise-media\/v1\/\d{4}(-\d+)?\.(jpg|mp4)$/.test(file)) throw new Error('Invalid asset');
    const result = await objectCall('getObjectUrl', file, { Sign: true, Expires: 1800, Protocol: 'https:' });
    if (!result.Url || !result.Url.startsWith('https://')) throw new Error('Invalid URL');
    return result.Url;
  };
  const items = await Promise.all(selected.map(async id => {
    const entry = manifest[id];
    return { id, images: await Promise.all(entry.images.map(sign)), video: entry.video ? await sign(entry.video) : '', expiresAt: Date.now() + 1500000 };
  }));
  return { items };
}
module.exports = { getMedia, select };
