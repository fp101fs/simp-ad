import axios from 'axios';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from 'redis';

let _redis: ReturnType<typeof createClient> | null = null;
async function getRedis() {
  if (!_redis) {
    const client = createClient({ url: process.env.REDIS_URL, socket: { connectTimeout: 5000 }, commandsQueueMaxLength: 10 });
    client.on('error', (err) => console.error('Redis error:', err));
    try {
      await client.connect();
    } catch (err) {
      _redis = null;
      throw err;
    }
    _redis = client;
  }
  return _redis;
}

function rejectAfter(ms: number, label: string): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms));
}

function withFallback<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

const PEXELS_API_KEY = process.env.VITE_PEXELS_API_KEY;
const UNSPLASH_ACCESS_KEY = process.env.VITE_UNSPLASH_ACCESS_KEY;

async function checkImageRateLimit(req: VercelRequest): Promise<{ allowed: true; key: string | null } | { allowed: false; error: string }> {
  const authHeader = req.headers.authorization as string | undefined;
  let key: string;
  let limit: number;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const info = await Promise.race([
        axios.get('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${token}` } }),
        rejectAfter(5000, 'google-auth'),
      ]);
      const email: string = info.data.email;
      if (email === process.env.VITE_ADMIN_EMAIL) return { allowed: true, key: null };
      key = `ratelimit:images:user:${email}`;
      limit = 100;
    } catch {
      const ip = ((req.headers['x-forwarded-for'] as string) || '').split(',')[0].trim() || 'unknown';
      key = `ratelimit:images:ip:${ip}`;
      limit = 10;
    }
  } else {
    const ip = ((req.headers['x-forwarded-for'] as string) || '').split(',')[0].trim() || 'unknown';
    key = `ratelimit:images:ip:${ip}`;
    limit = 10;
  }

  const r = await getRedis();
  const current = await withFallback(r.get(key), 3000, null);
  const count = current ? parseInt(current, 10) : 0;
  if (count >= limit) {
    return {
      allowed: false,
      error: limit === 10
        ? 'Image search limit reached: 10 per 24 hours. Sign in for more.'
        : `Image search limit reached: ${limit} searches per 24 hours. Try again later.`,
    };
  }
  return { allowed: true, key };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { query, page = '1', perPage = '4' } = req.query;
  if (!query || typeof query !== 'string') return res.status(400).json({ error: 'Missing or invalid "query" parameter' });

  const rateCheck = await withFallback(
    checkImageRateLimit(req).catch((err: any) => { console.error('Image rate limit check failed, allowing:', err.message); return { allowed: true, key: null } as const; }),
    6000, { allowed: true, key: null } as const
  );
  if (!rateCheck.allowed) return res.status(429).json({ error: (rateCheck as { allowed: false; error: string }).error });

  let images: string[] = [];

  if (UNSPLASH_ACCESS_KEY) {
    try {
      const unsplashRes = await Promise.race([
        axios.get(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}&client_id=${UNSPLASH_ACCESS_KEY}`),
        rejectAfter(8000, 'unsplash'),
      ]);
      if (unsplashRes.data.results?.length > 0) {
        images = unsplashRes.data.results.map((img: any) => img.urls.regular);
      }
      console.log(`📷 Unsplash ["${query}"] page ${page}: ${images.length} result(s)`);
    } catch (err) {
      console.warn('Unsplash fetch failed, falling back to Pexels', err);
    }
  }

  if (images.length === 0) {
    try {
      const pexelsRes = await Promise.race([
        axios.get(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}`, { headers: { Authorization: PEXELS_API_KEY || '' } }),
        rejectAfter(8000, 'pexels'),
      ]);
      if (pexelsRes.data.photos?.length > 0) {
        images = pexelsRes.data.photos.map((p: any) => p.src.large2x);
      }
      console.log(`📷 Pexels ["${query}"] page ${page}: ${images.length} result(s)`);
    } catch (err) {
      console.error('Pexels fetch failed', err);
    }
  }

  if (rateCheck.key) {
    withFallback(
      getRedis().then(r => r.incr(rateCheck.key!).then(n => { if (n === 1) r.expire(rateCheck.key!, 86400); })),
      3000, undefined
    ).catch((e: any) => console.error('Rate limit increment failed:', e.message));
  }

  return res.status(200).json({ images });
}
