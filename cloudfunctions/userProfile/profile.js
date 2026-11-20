const { one, str, jsonb, newId } = require('./fitdb');
async function ensureProfile(openid) {
  const now = Date.now();
  const defaults = { openid, nickname: '', avatarUrl: '', gender: 'male', height: 170,
    targetWeight: 65, dailyCalorieTarget: 1800, createdAt: now, updatedAt: now };
  await one(`INSERT INTO public.fit_users (id, data) VALUES (${str(newId('u'))}, ${jsonb(defaults)})
    ON CONFLICT ((data->>'openid')) DO NOTHING`);
}
module.exports = { ensureProfile };
