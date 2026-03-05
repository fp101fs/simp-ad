import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const PEXELS_API_KEY = process.env.VITE_PEXELS_API_KEY;
const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
// Prefer the non-VITE_ prefixed key (server-side secret); fall back to legacy VITE_ key
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY;
const OPENROUTER_FALLBACK_API_KEY = process.env.OPENROUTER_FALLBACK_API_KEY;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function callOpenRouter(modelId: string, apiKey: string, prompt: string) {
  const response = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    { model: modelId, messages: [{ role: 'user', content: buildPrompt(prompt) }] },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://simp.ad',
        'X-Title': 'simp.ad',
      }
    }
  );
  const actualModel = response.data.model || modelId;
  const aiResponse = response.data.choices[0].message.content;
  const cleanJson = aiResponse.replace(/```json|```/g, '').trim();
  return { parsed: JSON.parse(cleanJson), actualModel, usage: response.data.usage ?? null };
}

const buildPrompt = (prompt: string) =>
  `Analyze this business/idea prompt: "${prompt}".
Generate a cohesive, professional, and family-friendly ad concept by providing:
1. "searchTerm": A literal, descriptive image search term (e.g., "scoop of vanilla ice cream on a cone").
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
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { prompt, model: requestedModel, provider: requestedProvider } = req.query;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "prompt" query parameter' });
  }

  const modelId = (requestedModel as string) || 'openrouter/free';
  const provider = (requestedProvider as string) || 'openrouter';


  try {
    let searchTerm = '';
    let adCopy = '';
    let postBody = '';
    let modelUsed = '';
    let tokenUsage: { prompt_tokens: number; completion_tokens: number } | null = null;

    if (provider === 'openrouter') {
      // OpenRouter provider (default)
      if (!OPENROUTER_API_KEY) {
        return res.status(500).json({
          error: 'OpenRouter API key not configured. Add OPENROUTER_API_KEY to your Vercel environment variables.'
        });
      }

      const FREE_MODEL = 'openrouter/free';
      const MAX_FREE_ATTEMPTS = 3;
      const RETRY_DELAY_MS = 3000;
      let lastError: any;
      let succeeded = false;

      // Attempts 1–3: free model with primary key
      for (let attempt = 1; attempt <= MAX_FREE_ATTEMPTS; attempt++) {
        console.log(`🚀 Attempt ${attempt}/${MAX_FREE_ATTEMPTS} with model "${FREE_MODEL}"...`);
        try {
          const { parsed, actualModel, usage } = await callOpenRouter(FREE_MODEL, OPENROUTER_API_KEY, prompt);
          searchTerm = parsed.searchTerm;
          adCopy = parsed.adCopy;
          postBody = parsed.postBody;
          modelUsed = actualModel;
          tokenUsage = usage;
          console.log(`✅ Ad generated using model: "${actualModel}"`);
          succeeded = true;
          break;
        } catch (err: any) {
          lastError = err;
          if (attempt < MAX_FREE_ATTEMPTS) {
            console.log(`❌ Attempt ${attempt} failed: ${err.message}. Retrying in ${RETRY_DELAY_MS / 1000}s...`);
            await sleep(RETRY_DELAY_MS);
          } else {
            console.log(`❌ Attempt ${attempt} failed: ${err.message}.`);
          }
        }
      }

      // Attempt 4: fallback model with fallback key
      if (!succeeded) {
        const FALLBACK_MODEL = 'google/gemini-2.5-flash-lite';
        if (!OPENROUTER_FALLBACK_API_KEY) {
          console.log(`💥 All free attempts failed and OPENROUTER_FALLBACK_API_KEY is not configured.`);
          throw lastError;
        }
        console.log(`🔄 Switching to fallback model "${FALLBACK_MODEL}"...`);
        await sleep(RETRY_DELAY_MS);
        const { parsed, actualModel, usage } = await callOpenRouter(FALLBACK_MODEL, OPENROUTER_FALLBACK_API_KEY, prompt);
        searchTerm = parsed.searchTerm;
        adCopy = parsed.adCopy;
        postBody = parsed.postBody;
        modelUsed = actualModel;
        tokenUsage = usage;
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
      { headers: { Authorization: PEXELS_API_KEY || '' } }
    );

    return res.status(200).json({
      prompt,
      searchTerm,
      adCopy,
      postBody,
      modelUsed,
      tokenUsage,
      image: pexelsRes.data.photos?.[0]?.src?.large2x || '',
    });

  } catch (error: any) {
    console.error('💥 All attempts failed:', error.message);
    return res.status(500).json({ error: 'Failed to generate ad', details: error.message });
  }
}
