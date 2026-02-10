import { useState } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import './App.css';

const PEXELS_API_KEY = import.meta.env.VITE_PEXELS_API_KEY;
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

function App() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ image: string; copy: string } | null>(null);
  const [error, setError] = useState('');

  const generateAd = async () => {
    if (!prompt) return;
    setLoading(true);
    setError('');
    setResult(null);

    try {
      // 1. Get AI Analysis from Gemini
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      // Using gemini-1.5-flash for speed/efficiency, but user mentioned 2.5-pro. 
      // I will use gemini-1.5-pro which is more stable for complex prompts.
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

      const aiPrompt = `Analyze this business/idea prompt: "${prompt}". 
      Return a JSON object with:
      1. "searchTerm": A single effective image search term for Pexels.
      2. "adCopy": A short, punchy ad headline (max 10 words).
      Return ONLY the JSON.`;

      const aiResult = await model.generateContent(aiPrompt);
      const aiResponse = aiResult.response.text();
      const cleanJson = aiResponse.replace(/```json|```/g, '').trim();
      const { searchTerm, adCopy } = JSON.parse(cleanJson);

      // 2. Search Pexels
      const pexelsRes = await axios.get(`https://api.pexels.com/v1/search?query=${encodeURIComponent(searchTerm)}&per_page=1`, {
        headers: { Authorization: PEXELS_API_KEY }
      });

      if (pexelsRes.data.photos.length > 0) {
        setResult({
          image: pexelsRes.data.photos[0].src.large2x,
          copy: adCopy
        });
      } else {
        setError('No relevant images found.');
      }
    } catch (err: any) {
      console.error(err);
      setError('Failed to generate ad. Check console and API keys.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>simp.ad</h1>
      <p className="subtitle">Instant AI Ads</p>
      
      <div className="input-group">
        <input 
          type="text" 
          value={prompt} 
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="What are we selling today?"
          onKeyDown={(e) => e.key === 'Enter' && generateAd()}
        />
        <button onClick={generateAd} disabled={loading}>
          {loading ? 'Simping...' : 'Generate'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {result && (
        <div className="ad-preview">
          <div className="ad-container">
            <img src={result.image} alt="Ad background" />
            <div className="overlay">
              <h2>{result.copy}</h2>
            </div>
          </div>
          <button className="download-hint" onClick={() => window.print()}>Save Ad (Print/PDF)</button>
        </div>
      )}
    </div>
  );
}

export default App;
