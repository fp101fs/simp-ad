import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Accessing the same env vars as the frontend for simplicity
const PEXELS_API_KEY = process.env.VITE_PEXELS_API_KEY;
const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
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

  const { prompt } = req.query;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "prompt" query parameter' });
  }

  if (!GEMINI_API_KEY || !PEXELS_API_KEY) {
    return res.status(500).json({ error: 'Server configuration error (Missing API Keys)' });
  }

  try {
    // 1. Gemini Analysis
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const aiPrompt = `Analyze this business/idea prompt: "${prompt}". 
    Return a JSON object with:
    1. "searchTerm": A single effective image search term for Pexels.
    2. "adCopy": A short, punchy ad headline (max 10 words).
    Return ONLY the JSON.`;

    const aiResult = await model.generateContent(aiPrompt);
    const aiResponse = aiResult.response.text();
    const cleanJson = aiResponse.replace(/```json|```/g, '').trim();
    const { searchTerm, adCopy } = JSON.parse(cleanJson);

    // 2. Pexels Search
    const pexelsRes = await axios.get(`https://api.pexels.com/v1/search?query=${encodeURIComponent(searchTerm)}&per_page=1`, {
      headers: { Authorization: PEXELS_API_KEY }
    });

    if (pexelsRes.data.photos.length > 0) {
      return res.status(200).json({
        prompt: prompt,
        searchTerm: searchTerm,
        image: pexelsRes.data.photos[0].src.large2x,
        copy: adCopy
      });
    } else {
      return res.status(404).json({ error: 'No relevant images found.' });
    }

  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Failed to generate ad', details: error.message });
  }
}
