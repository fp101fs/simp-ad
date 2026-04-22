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

// Race a promise against a timeout; resolves with fallback instead of hanging forever.
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

const PEXELS_API_KEY = process.env.VITE_PEXELS_API_KEY;
const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
// Prefer the non-VITE_ prefixed key (server-side secret); fall back to legacy VITE_ key
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY;
const OPENROUTER_FALLBACK_API_KEY = process.env.OPENROUTER_FALLBACK_API_KEY;

async function checkRateLimit(req: VercelRequest): Promise<
  { allowed: true; key: string | null } |
  { allowed: false; error: string }
> {
  const authHeader = req.headers.authorization as string | undefined;
  let key: string;
  let limit: number;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const info = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000,
      });
      const email: string = info.data.email;
      if (email === process.env.VITE_ADMIN_EMAIL) {
        return { allowed: true, key: null };
      }
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
  const current = await withTimeout(r.get(key), 3000, null);
  const count = current ? parseInt(current, 10) : 0;
  if (count >= limit) {
    return { allowed: false, error: limit === 1
      ? 'Free limit reached: 1 ad per 24 hours per IP address.'
      : `Rate limit reached: ${limit} ads per 24 hours. Try again later.`
    };
  }
  return { allowed: true, key };
}

function rejectAfter(ms: number, label: string): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms));
}

async function callOpenRouter(modelId: string, apiKey: string, prompt: string) {
  const response = await Promise.race([
    axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      { model: modelId, messages: [{ role: 'user', content: buildPrompt(prompt) }] },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://simp.ad',
          'X-Title': 'simp.ad',
        },
      }
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { prompt, model: requestedModel, provider: requestedProvider } = req.query;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "prompt" query parameter' });
  }

  const rateCheck = await withTimeout(
    checkRateLimit(req).catch((err: any) => {
      console.error('Rate limit check failed, allowing request:', err.message);
      return { allowed: true, key: null } as const;
    }),
    6000,
    { allowed: true, key: null } as const
  );
  if (!rateCheck.allowed) {
    return res.status(429).json({ error: (rateCheck as { allowed: false; error: string }).error });
  }

  const modelId = (requestedModel as string) || 'openrouter/free';
  const provider = (requestedProvider as string) || 'openrouter';

  const FREE_MODELS = [
    'liquid/lfm-2.5-1.2b-instruct:free',
    'google/gemma-3n-e2b-it:free',
    'arcee-ai/trinity-mini:free',
  ];

  try {
    let searchTerm = '';
    let adCopy = '';
    let postBody = '';
    let modelUsed = '';
    let modelRequested = '';
    let attemptNumber = 0;
    const failedAttempts: { model: string; error: string }[] = [];
    let tokenUsage: { prompt_tokens: number; completion_tokens: number } | null = null;
    let modelIndex = 0;

    if (provider === 'openrouter') {
      // OpenRouter provider (default)
      if (!OPENROUTER_API_KEY) {
        return res.status(500).json({
          error: 'OpenRouter API key not configured. Add OPENROUTER_API_KEY to your Vercel environment variables.'
        });
      }

      try {
        const redis = await getRedis();
        modelIndex = (await withTimeout(redis.incr('model:index'), 3000, 1)) - 1;
      } catch (err: any) {
        console.error('Redis model:index failed, using 0:', err.message);
        modelIndex = 0;
      }
      modelRequested = FREE_MODELS[modelIndex % FREE_MODELS.length];
      let succeeded = false;
      let lastError: any;

      // Race all free models in parallel — worst-case latency drops from 30s to 10s
      try {
        const raceResults = await Promise.any(
          FREE_MODELS.map((_, i) => {
            const freeModel = FREE_MODELS[(modelIndex + i) % FREE_MODELS.length];
            return callOpenRouter(freeModel, OPENROUTER_API_KEY, prompt)
              .then(result => ({ ...result, freeModel, attempt: i + 1 }))
              .catch((err: any) => {
                failedAttempts.push({ model: freeModel, error: err.message });
                console.log(`❌ Free model failed (${freeModel}): ${err.message}`);
                throw err;
              });
          })
        );
        searchTerm = raceResults.parsed.searchTerm;
        adCopy = raceResults.parsed.adCopy;
        postBody = raceResults.parsed.postBody;
        modelUsed = raceResults.actualModel;
        tokenUsage = raceResults.usage;
        attemptNumber = raceResults.attempt;
        console.log(`✅ Ad generated using model: "${raceResults.actualModel}"`);
        succeeded = true;
      } catch (aggErr: any) {
        lastError = aggErr?.errors?.[aggErr.errors.length - 1] ?? aggErr;
        console.log(`❌ All ${FREE_MODELS.length} free model attempts failed`);
      }

      // Fallback: paid model with fallback key
      if (!succeeded) {
        const FALLBACK_MODEL = 'google/gemini-2.5-flash-lite';
        if (!OPENROUTER_FALLBACK_API_KEY) {
          console.log(`💥 All free attempts failed and OPENROUTER_FALLBACK_API_KEY is not configured.`);
          throw lastError;
        }
        console.log(`🔄 Switching to fallback model "${FALLBACK_MODEL}"...`);
        const { parsed, actualModel, usage } = await callOpenRouter(FALLBACK_MODEL, OPENROUTER_FALLBACK_API_KEY, prompt);
        searchTerm = parsed.searchTerm;
        adCopy = parsed.adCopy;
        postBody = parsed.postBody;
        modelUsed = actualModel;
        tokenUsage = usage;
        attemptNumber = FREE_MODELS.length + 1;
        console.log(`✅ Ad generated using model: "${actualModel}"`);
      }

    } else if (provider === 'google') {
      // Google Gemini SDK (direct — no OpenRouter proxy)
      if (!GEMINI_API_KEY) {
        return res.status(500).json({
          error: 'Gemini API key not configured. Add VITE_GEMINI_API_KEY to your Vercel environment variables.'
        });
      }
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const googleModelId = modelId.includes('gemini-3-flash') ? 'gemini-2.0-flash'
                          : modelId.includes('2.0-flash') ? 'gemini-2.0-flash'
                          : 'gemini-1.5-flash';
      const model = genAI.getGenerativeModel({ model: googleModelId });

      const aiResult = await model.generateContent(buildPrompt(prompt));
      const aiResponse = aiResult.response.text();
      const cleanJson = aiResponse.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      searchTerm = parsed.searchTerm;
      adCopy = parsed.adCopy;
      postBody = parsed.postBody;
      modelUsed = googleModelId;

    } else {
      return res.status(500).json({ error: 'No AI API keys configured.' });
    }

    // Pexels image search
    const pexelsRes = await axios.get(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(searchTerm)}&per_page=1`,
      { headers: { Authorization: PEXELS_API_KEY || '' }, timeout: 8000 }
    );

    const imageUrl = pexelsRes.data.photos?.[0]?.src?.large2x || '';

    // Non-critical Redis writes — fire with short deadlines so they never block the response
    withTimeout(
      getRedis().then(r => r.lPush('ads:recent', JSON.stringify({ ts: new Date().toISOString(), prompt, searchTerm, adCopy, postBody, modelUsed, image: imageUrl }))
        .then(() => r.lTrim('ads:recent', 0, 99))),
      3000, undefined
    ).catch((kvErr: any) => console.error('Redis log failed:', kvErr.message));

    if (rateCheck.key) {
      withTimeout(
        getRedis().then(r => r.incr(rateCheck.key!).then(n => { if (n === 1) r.expire(rateCheck.key!, 86400); })),
        3000, undefined
      ).catch((e: any) => console.error('Rate limit increment failed:', e.message));
    }

    return res.status(200).json({
      prompt,
      searchTerm,
      adCopy,
      postBody,
      modelUsed,
      modelRequested,
      attemptNumber,
      modelIndex: modelIndex % FREE_MODELS.length,
      failedAttempts,
      tokenUsage,
      image: imageUrl,
    });

  } catch (error: any) {
    console.error('💥 All attempts failed:', error.message);
    return res.status(500).json({ error: 'Failed to generate ad', details: error.message });
  }
}
