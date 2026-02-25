import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const PEXELS_API_KEY = process.env.VITE_PEXELS_API_KEY;
const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
// Prefer the non-VITE_ prefixed key (server-side secret); fall back to legacy VITE_ key
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY;

// The actual free model used when the user selects "openrouter/free"
const OPENROUTER_FREE_MODEL = 'meta-llama/llama-3.1-8b-instruct:free';

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

  const modelId = (requestedModel as string) || 'google/gemini-2.5-flash-lite';
  const provider = (requestedProvider as string) || 'google';

  // Resolve the actual OpenRouter model ID ("openrouter/free" → real free model)
  const openRouterModelId = modelId === 'openrouter/free' ? OPENROUTER_FREE_MODEL : modelId;

  try {
    let searchTerm = '';
    let adCopy = '';
    let postBody = '';

    if (provider === 'openrouter') {
      // Explicit OpenRouter provider selected by user
      if (!OPENROUTER_API_KEY) {
        return res.status(500).json({
          error: 'OpenRouter API key not configured. Add OPENROUTER_API_KEY to your Vercel environment variables.'
        });
      }

      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: openRouterModelId,
          messages: [{ role: 'user', content: buildPrompt(prompt) }],
        },
        {
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            'HTTP-Referer': 'https://simp.ad',
            'X-Title': 'simp.ad',
          }
        }
      );

      const aiResponse = response.data.choices[0].message.content;
      const cleanJson = aiResponse.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      searchTerm = parsed.searchTerm;
      adCopy = parsed.adCopy;
      postBody = parsed.postBody;

    } else if (OPENROUTER_API_KEY) {
      // Google provider but OpenRouter key available — use OpenRouter with the requested Gemini-style model
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: modelId,
          messages: [{ role: 'user', content: buildPrompt(prompt) }],
          response_format: { type: 'json_object' }
        },
        {
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            'HTTP-Referer': 'https://simp.ad',
            'X-Title': 'simp.ad',
          }
        }
      );

      const aiResponse = response.data.choices[0].message.content;
      const cleanJson = aiResponse.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      searchTerm = parsed.searchTerm;
      adCopy = parsed.adCopy;
      postBody = parsed.postBody;

    } else if (GEMINI_API_KEY) {
      // Fallback: direct Google Gemini SDK
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
      image: pexelsRes.data.photos?.[0]?.src?.large2x || '',
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Failed to generate ad', details: error.message });
  }
}
