import { GoogleGenerativeAI } from '@google/generative-ai';
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
const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY;
const OPENROUTER_FALLBACK_API_KEY = process.env.OPENROUTER_FALLBACK_API_KEY;

async function checkRateLimit(req: VercelRequest): Promise<{ allowed: true; key: string | null } | { allowed: false; error: string }> {
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
      key = `ratelimit:user:${email}`;
      limit = 100;
    } catch {
      const ip = ((req.headers['x-forwarded-for'] as string) || '').split(',')[0].trim() || 'unknown';
      key = `ratelimit:ip:${ip}`;
      limit = 1;
    }
  } else {
    const ip = ((req.headers['x-forwarded-for'] as string) || '').split(',')[0].trim() || 'unknown';
    key = `ratelimit:ip:${ip}`;
    limit = 1;
  }

  const r = await getRedis();
  const current = await withFallback(r.get(key), 3000, null);
  const count = current ? parseInt(current, 10) : 0;
  if (count >= limit) {
    return { allowed: false, error: limit === 1 ? 'Free limit reached: 1 ad per 24 hours per IP address.' : `Rate limit reached: ${limit} ads per 24 hours. Try again later.` };
  }
  return { allowed: true, key };
}

async function callOpenRouter(modelId: string, apiKey: string, prompt: string) {
  const response = await Promise.race([
    axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      { model: modelId, messages: [{ role: 'user', content: buildPrompt(prompt) }] },
      { headers: { Authorization: `Bearer ${apiKey}`, 'HTTP-Referer': 'https://simp.ad', 'X-Title': 'simp.ad' } }
    ),
    rejectAfter(10000, modelId),
  ]);
  const actualModel = response.data.model || modelId;
  const aiResponse = response.data.choices[0].message.content;
  const cleanJson = aiResponse.replace(/```json|```/g, '').trim();
  return { parsed: JSON.parse(cleanJson), actualModel, usage: response.data.usage ?? null };
}

const buildPrompt = (prompt: string) =>
  `Analyze this business/idea prompt: "${prompt}".
Generate a cohesive, professional, and family-friendly ad concept by providing:
1. "searchTerm": A short 1-3 word stock photo search term — use the most literal, direct name for the product or subject (e.g., "nachos", "yoga class", "coffee shop"). Do not reinterpret or generalize; if the prompt names something specific, use that exact thing.
2. "adCopy": A short, punchy ad headline (max 10 words).
3. "postBody": An engaging social media caption (1-3 sentences) with relevant hashtags.
Return a JSON object with these three fields.
Return ONLY the JSON, no markdown, no code fences, no explanation.`;

const FREE_MODELS = [
  'liquid/lfm-2.5-1.2b-instruct:free',
  'google/gemma-3n-e2b-it:free',
  'arcee-ai/trinity-mini:free',
];

async function generateAdData(prompt: string, provider: string, modelId: string, rateCheckKey: string | null) {
  let searchTerm = '', adCopy = '', postBody = '', modelUsed = '', modelRequested = '';
  let attemptNumber = 0;
  const failedAttempts: { model: string; error: string }[] = [];
  let tokenUsage: { prompt_tokens: number; completion_tokens: number } | null = null;
  let modelIndex = 0;

  if (provider === 'openrouter') {
    if (!OPENROUTER_API_KEY) throw new Error('OpenRouter API key not configured');

    modelIndex = await withFallback(
      getRedis().then(r => r.incr('model:index')),
      3000, 1
    ).then(v => v - 1).catch(() => 0);

    modelRequested = FREE_MODELS[modelIndex % FREE_MODELS.length];

    // Try all free models in parallel; use first to succeed
    const freeResults = await Promise.all(
      FREE_MODELS.map((_, i) => {
        const freeModel = FREE_MODELS[(modelIndex + i) % FREE_MODELS.length];
        return callOpenRouter(freeModel, OPENROUTER_API_KEY!, prompt)
          .then(r => ({ ok: true as const, result: { ...r, freeModel, attempt: i + 1 } }))
          .catch((err: any) => {
            failedAttempts.push({ model: freeModel, error: err.message });
            console.log(`❌ Free model failed (${freeModel}): ${err.message}`);
            return { ok: false as const };
          });
      })
    );

    const winner = freeResults.find(r => r.ok);
    if (winner && winner.ok) {
      const w = winner.result;
      searchTerm = w.parsed.searchTerm;
      adCopy = w.parsed.adCopy;
      postBody = w.parsed.postBody;
      modelUsed = w.actualModel;
      tokenUsage = w.usage;
      attemptNumber = w.attempt;
      console.log(`✅ Ad generated using model: "${w.actualModel}"`);
    } else {
      if (!OPENROUTER_FALLBACK_API_KEY) {
        console.log('💥 All free attempts failed and OPENROUTER_FALLBACK_API_KEY is not configured.');
        throw new Error(`All free models failed: ${failedAttempts.map(f => f.error).join('; ')}`);
      }
      const FALLBACK_MODEL = 'google/gemini-2.5-flash-lite';
      console.log(`🔄 Switching to fallback model "${FALLBACK_MODEL}"...`);
      const fb = await callOpenRouter(FALLBACK_MODEL, OPENROUTER_FALLBACK_API_KEY, prompt);
      searchTerm = fb.parsed.searchTerm;
      adCopy = fb.parsed.adCopy;
      postBody = fb.parsed.postBody;
      modelUsed = fb.actualModel;
      tokenUsage = fb.usage;
      attemptNumber = FREE_MODELS.length + 1;
      console.log(`✅ Ad generated using model: "${fb.actualModel}"`);
    }

  } else if (provider === 'google') {
    if (!GEMINI_API_KEY) throw new Error('Gemini API key not configured');
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const googleModelId = modelId.includes('2.0-flash') ? 'gemini-2.0-flash' : 'gemini-1.5-flash';
    const model = genAI.getGenerativeModel({ model: googleModelId });
    const aiResult = await model.generateContent(buildPrompt(prompt));
    const cleanJson = aiResult.response.text().replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    searchTerm = parsed.searchTerm; adCopy = parsed.adCopy; postBody = parsed.postBody; modelUsed = googleModelId;
  } else {
    throw new Error('No AI provider configured');
  }

  const pexelsRes = await Promise.race([
    axios.get(`https://api.pexels.com/v1/search?query=${encodeURIComponent(searchTerm)}&per_page=1`, { headers: { Authorization: PEXELS_API_KEY || '' } }),
    rejectAfter(8000, 'pexels'),
  ]);
  const imageUrl = pexelsRes.data.photos?.[0]?.src?.large2x || '';

  // Non-critical Redis writes — fire-and-forget with short deadlines
  withFallback(
    getRedis().then(r => r.lPush('ads:recent', JSON.stringify({ ts: new Date().toISOString(), prompt, searchTerm, adCopy, postBody, modelUsed, image: imageUrl })).then(() => r.lTrim('ads:recent', 0, 99))),
    3000, undefined
  ).catch((e: any) => console.error('Redis log failed:', e.message));

  if (rateCheckKey) {
    withFallback(
      getRedis().then(r => r.incr(rateCheckKey).then(n => { if (n === 1) r.expire(rateCheckKey, 86400); })),
      3000, undefined
    ).catch((e: any) => console.error('Rate limit increment failed:', e.message));
  }

  return { searchTerm, adCopy, postBody, modelUsed, modelRequested, attemptNumber, modelIndex: modelIndex % FREE_MODELS.length, failedAttempts, tokenUsage, imageUrl };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { prompt, model: requestedModel, provider: requestedProvider } = req.query;
  if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'Missing or invalid "prompt" query parameter' });

  const rateCheck = await withFallback(
    checkRateLimit(req).catch((err: any) => { console.error('Rate limit check failed, allowing:', err.message); return { allowed: true, key: null } as const; }),
    6000, { allowed: true, key: null } as const
  );
  if (!rateCheck.allowed) return res.status(429).json({ error: (rateCheck as { allowed: false; error: string }).error });

  const provider = (requestedProvider as string) || 'openrouter';
  const modelId = (requestedModel as string) || 'openrouter/free';

  try {
    // Hard 40s ceiling on the entire generation — nothing can hang past this
    const data = await Promise.race([
      generateAdData(prompt, provider, modelId, rateCheck.key),
      rejectAfter(40000, 'generateAdData'),
    ]);

    return res.status(200).json({
      prompt, searchTerm: data.searchTerm, adCopy: data.adCopy, postBody: data.postBody,
      modelUsed: data.modelUsed, modelRequested: data.modelRequested, attemptNumber: data.attemptNumber,
      modelIndex: data.modelIndex, failedAttempts: data.failedAttempts, tokenUsage: data.tokenUsage,
      image: data.imageUrl,
    });
  } catch (error: any) {
    console.error('💥 All attempts failed:', error.message);
    return res.status(500).json({ error: 'Failed to generate ad', details: error.message });
  }
}
