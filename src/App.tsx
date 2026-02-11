import { useState, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import './App.css';

const PEXELS_API_KEY = import.meta.env.VITE_PEXELS_API_KEY;
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

function App() {
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [manualSearch, setManualSearch] = useState('');
  const [manualCopy, setManualCopy] = useState('');
  const [aiPolish, setAiPolish] = useState(true);
  const [instaMode, setInstaMode] = useState(true);
  const [format, setFormat] = useState('square');
  const [fontSize, setFontSize] = useState('md');
  const [fontFamily, setFontFamily] = useState('sans');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ image: string; copy: string } | null>(null);
  
  // Thumbnail Logic
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [currentSearchTerm, setCurrentSearchTerm] = useState('');
  const [searchPage, setSearchPage] = useState(1);
  const [refreshingThumbs, setRefreshingThumbs] = useState(false);

  const [error, setError] = useState('');

  // Handle URL params on mount
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const urlPrompt = searchParams.get('prompt');
    if (urlPrompt) {
      setPrompt(urlPrompt);
      generateAd(urlPrompt);
    }
  }, []);

  const refreshThumbnails = async () => {
    if (!currentSearchTerm) return;
    setRefreshingThumbs(true);
    try {
      const nextPage = searchPage + 1;
      const pexelsRes = await axios.get(`https://api.pexels.com/v1/search?query=${encodeURIComponent(currentSearchTerm)}&per_page=3&page=${nextPage}`, {
        headers: { Authorization: PEXELS_API_KEY }
      });
      
      if (pexelsRes.data.photos.length > 0) {
        setThumbnails(pexelsRes.data.photos.map((p: any) => p.src.large2x));
        setSearchPage(nextPage);
      }
    } catch (err) {
      console.error("Failed to refresh thumbs", err);
    } finally {
      setRefreshingThumbs(false);
    }
  };

  const generateAd = async (promptOverride?: string) => {
    const query = promptOverride || prompt;
    
    setLoading(true);
    setError('');
    setResult(null);
    setThumbnails([]);

    try {
      let searchTerm = '';
      let adCopy = '';

      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      if (mode === 'AUTO') {
        if (!query) {
          setError('Please enter a prompt');
          setLoading(false);
          return;
        }
        
        const aiPrompt = `Analyze this business/idea prompt: "${query}". 
        Return a JSON object with:
        1. "searchTerm": A single effective image search term for Pexels.
        2. "adCopy": A short, punchy ad headline (max 10 words).
        Return ONLY the JSON.`;

        const aiResult = await model.generateContent(aiPrompt);
        const aiResponse = aiResult.response.text();
        const cleanJson = aiResponse.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        searchTerm = parsed.searchTerm;
        adCopy = parsed.adCopy;
      } else {
        // MANUAL mode
        if (!manualSearch || !manualCopy) {
          setError('Please fill in both fields');
          setLoading(false);
          return;
        }
        searchTerm = manualSearch;
        
        if (aiPolish) {
          const aiPrompt = `Refine this ad copy idea: "${manualCopy}".
          Return a JSON object with:
          1. "adCopy": A single short, punchy ad headline (max 10 words).
          Return ONLY the JSON.`;

          const aiResult = await model.generateContent(aiPrompt);
          const aiResponse = aiResult.response.text();
          const cleanJson = aiResponse.replace(/```json|```/g, '').trim();
          const parsed = JSON.parse(cleanJson);
          adCopy = parsed.adCopy;
        } else {
          adCopy = manualCopy;
        }
      }

      // Update search state
      setCurrentSearchTerm(searchTerm);
      setSearchPage(1);

      // 2. Search Pexels (Fetch 4: 1 for main, 3 for thumbnails)
      const pexelsRes = await axios.get(`https://api.pexels.com/v1/search?query=${encodeURIComponent(searchTerm)}&per_page=4&page=1`, {
        headers: { Authorization: PEXELS_API_KEY }
      });

      if (pexelsRes.data.photos.length > 0) {
        setResult({
          image: pexelsRes.data.photos[0].src.large2x,
          copy: adCopy
        });
        // Set thumbnails (items 1-3)
        if (pexelsRes.data.photos.length > 1) {
          setThumbnails(pexelsRes.data.photos.slice(1).map((p: any) => p.src.large2x));
        }
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

      <div className="mode-toggle">
        <button 
          className={mode === 'AUTO' ? 'active' : ''} 
          onClick={() => setMode('AUTO')}
        >
          AUTO
        </button>
        <button 
          className={mode === 'MANUAL' ? 'active' : ''} 
          onClick={() => setMode('MANUAL')}
        >
          MANUAL
        </button>
      </div>
      
      <div className="input-group">
        {mode === 'AUTO' ? (
          <input 
            type="text" 
            value={prompt} 
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="What are we selling today?"
            onKeyDown={(e) => e.key === 'Enter' && generateAd()}
          />
        ) : (
          <div className="manual-container">
            <div className="manual-fields">
              <input 
                type="text" 
                value={manualSearch} 
                onChange={(e) => setManualSearch(e.target.value)}
                placeholder="Image Search (e.g. Mars)"
              />
              <input 
                type="text" 
                value={manualCopy} 
                onChange={(e) => setManualCopy(e.target.value)}
                placeholder="Ad Copy Hook (e.g. Ice Cream on Mars)"
              />
            </div>
            <label className="checkbox-label">
              <input 
                type="checkbox" 
                checked={aiPolish} 
                onChange={(e) => setAiPolish(e.target.checked)} 
              />
              AI Polish Copy
            </label>
          </div>
        )}
        <button className="primary-btn" onClick={() => generateAd()} disabled={loading}>
          {loading ? 'Simping...' : 'Generate'}
        </button>
      </div>

      {thumbnails.length > 0 && (
        <div className="thumbnails-container">
          <div className="thumbnails-row">
            {thumbnails.map((thumb, idx) => (
              <img 
                key={idx} 
                src={thumb} 
                alt="Option" 
                className="thumbnail" 
                onClick={() => setResult(prev => prev ? { ...prev, image: thumb } : null)}
              />
            ))}
          </div>
          <button 
            className="refresh-thumbs-btn" 
            onClick={refreshThumbnails} 
            disabled={refreshingThumbs}
            title="Load new images"
          >
            {refreshingThumbs ? '...' : '↻'}
          </button>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {result && (
        <div className="ad-preview">
          <div className="insta-controls">
             <button 
               className={`insta-toggle ${instaMode ? 'active' : ''}`}
               onClick={() => setInstaMode(!instaMode)}
             >
               📸 Insta Mode {instaMode ? 'ON' : 'OFF'}
             </button>
             
             {instaMode && (
               <div className="format-pills">
                 {['square', 'portrait', 'story', 'landscape'].map(f => (
                   <button 
                     key={f}
                     className={format === f ? 'active' : ''}
                     onClick={() => setFormat(f)}
                   >
                     {f.charAt(0).toUpperCase() + f.slice(1)}
                   </button>
                 ))}
               </div>
             )}
          </div>

          <div className="style-controls">
            <div className="control-group">
              <span className="control-label">Size</span>
              <div className="pill-group">
                {['sm', 'md', 'lg'].map(sz => (
                  <button 
                    key={sz} 
                    className={fontSize === sz ? 'active' : ''} 
                    onClick={() => setFontSize(sz)}
                  >
                    {sz.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div className="control-group">
              <span className="control-label">Font</span>
              <div className="pill-group">
                <button className={fontFamily === 'sans' ? 'active' : ''} onClick={() => setFontFamily('sans')}>Sans</button>
                <button className={fontFamily === 'serif' ? 'active' : ''} onClick={() => setFontFamily('serif')}>Serif</button>
                <button className={fontFamily === 'display' ? 'active' : ''} onClick={() => setFontFamily('display')}>Bold</button>
              </div>
            </div>
          </div>

          <div className={`ad-container ratio-${instaMode ? format : 'landscape'}`}>
            <img src={result.image} alt="Ad background" />
            <div className="overlay">
              <h2 className={`font-${fontFamily} size-${fontSize}`}>{result.copy}</h2>
            </div>
          </div>
          <button className="download-hint" onClick={() => window.print()}>Save Ad (Print/PDF)</button>
        </div>
      )}
    </div>
  );
}

export default App;
