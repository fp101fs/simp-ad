import { createClient } from 'redis';
import axios from 'axios';
import type { VercelRequest, VercelResponse } from '@vercel/node';

let _redis: ReturnType<typeof createClient> | null = null;
async function getRedis() {
  if (!_redis) {
    _redis = createClient({ url: process.env.REDIS_URL });
    _redis.on('error', (err) => console.error('Redis error:', err));
    await _redis.connect();
  }
  return _redis;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Missing token' });

  try {
    const r = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.data.email !== process.env.VITE_ADMIN_EMAIL) return res.status(403).json({ error: 'Forbidden' });
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const r = await getRedis();
  const ads = await r.lRange('ads:recent', 0, 49);
  return res.status(200).json({ ads });
}
