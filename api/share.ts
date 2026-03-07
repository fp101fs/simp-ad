import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from 'redis';
import { randomBytes } from 'crypto';

let _redis: ReturnType<typeof createClient> | null = null;
async function getRedis() {
  if (!_redis) {
    _redis = createClient({ url: process.env.REDIS_URL });
    _redis.on('error', (err) => console.error('Redis error:', err));
    await _redis.connect();
  }
  return _redis;
}

const TTL = 60 * 60 * 24 * 30; // 30 days

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const r = await getRedis();

  if (req.method === 'POST') {
    const { state, platform } = req.body || {};
    if (!state || !platform) return res.status(400).json({ error: 'Missing state or platform' });

    const id = randomBytes(8).toString('base64url').slice(0, 10);
    await r.set(`share:${id}`, JSON.stringify({ state, platform }), { EX: TTL });
    return res.status(200).json({ id });
  }

  if (req.method === 'GET') {
    const { id } = req.query;
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing id' });
    const data = await r.get(`share:${id}`);
    if (!data) return res.status(404).json({ error: 'Not found' });
    return res.status(200).json(JSON.parse(data));
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
