import { useState, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import './App.css';

const PEXELS_API_KEY = import.meta.env.VITE_PEXELS_API_KEY;
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

interface TextBox {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: 'sm' | 'md' | 'lg';
  fontFamily: 'sans' | 'serif' | 'display';
}

function App() {
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [manualSearch, setManualSearch] = useState('');
  const [manualCopy, setManualCopy] = useState('');
  const [aiPolish, setAiPolish] = useState(true);
  const [instaMode, setInstaMode] = useState(true);
  const [format, setFormat] = useState('square');
  
  // Per-box styles are now in the TextBox interface
  const [globalFontSize, setGlobalFontSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [globalFontFamily, setGlobalFontFamily] = useState<'sans' | 'serif' | 'display'>('sans');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ image: string; boxes: TextBox[] } | null>(null);
  
  // Thumbnail Logic
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [currentSearchTerm, setCurrentSearchTerm] = useState('');
  const [searchPage, setSearchPage] = useState(1);
  const [refreshingThumbs, setRefreshingThumbs] = useState(false);

  const [activeBoxId, setActiveBoxId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

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

  // Drag Logic
  const handleDragStart = (id: string, clientX: number, clientY: number) => {
    const box = result?.boxes.find(b => b.id === id);
    if (!box) return;
    setActiveBoxId(id);
    setDragStart({ x: clientX - box.x, y: clientY - box.y });
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!activeBoxId || !result) return;
    setResult({
      ...result,
      boxes: result.boxes.map(b => 
        b.id === activeBoxId 
          ? { ...b, x: clientX - dragStart.x, y: clientY - dragStart.y }
          : b
      )
    });
  };

  const handleDragEnd = () => setActiveBoxId(null);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => handleDragMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
    const onUp = () => handleDragEnd();

    if (activeBoxId) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onUp);
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('touchend', onUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [activeBoxId, dragStart]);

  const updateBoxText = (id: string, text: string) => {
    if (!result) return;
    setResult({
      ...result,
      boxes: result.boxes.map(b => b.id === id ? { ...b, text } : b)
    });
  };

  const addTextBox = () => {
    if (!result) return;
    const newBox: TextBox = {
      id: Math.random().toString(36).substr(2, 9),
      text: 'New Text',
      x: 0,
      y: 50,
      fontSize: globalFontSize,
      fontFamily: globalFontFamily
    };
    setResult({ ...result, boxes: [...result.boxes, newBox] });
  };

  const removeBox = (id: string) => {
    if (!result || result.boxes.length <= 1) return;
    setResult({ ...result, boxes: result.boxes.filter(b => b.id !== id) });
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
        Generate a cohesive ad concept by providing:
        1. "searchTerm": A single effective image search term for Pexels that sets the right mood/context.
        2. "adCopy": A short, punchy ad headline (max 10 words) that cleverly connects with that image.
        Return a JSON object with these two fields.
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
          The background image for this ad is based on the search term: "${manualSearch}".
          Create a single short, punchy ad headline (max 10 words) that cleverly connects the image concept with the copy idea.
          Return a JSON object with:
          1. "adCopy": The refined headline.
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

      setCurrentSearchTerm(searchTerm);
      setSearchPage(1);

      const pexelsRes = await axios.get(`https://api.pexels.com/v1/search?query=${encodeURIComponent(searchTerm)}&per_page=4&page=1`, {
        headers: { Authorization: PEXELS_API_KEY }
      });

      if (pexelsRes.data.photos.length > 0) {
        setResult({
          image: pexelsRes.data.photos[0].src.large2x,
          boxes: [{
            id: 'main',
            text: adCopy,
            x: 0,
            y: 0,
            fontSize: globalFontSize,
            fontFamily: globalFontFamily
          }]
        });
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
                    className={globalFontSize === sz ? 'active' : ''} 
                    onClick={() => {
                      setGlobalFontSize(sz as any);
                      setResult({ ...result, boxes: result.boxes.map(b => ({ ...b, fontSize: sz as any })) });
                    }}
                  >
                    {sz.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div className="control-group">
              <span className="control-label">Font</span>
              <div className="pill-group">
                {['sans', 'serif', 'display'].map(f => (
                  <button 
                    key={f}
                    className={globalFontFamily === f ? 'active' : ''} 
                    onClick={() => {
                      setGlobalFontFamily(f as any);
                      setResult({ ...result, boxes: result.boxes.map(b => ({ ...b, fontFamily: f as any })) });
                    }}
                  >
                    {f === 'display' ? 'Bold' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <button className="add-text-btn" onClick={addTextBox}>+ Add Text</button>
          </div>

          <div className={`ad-container ratio-${instaMode ? format : 'landscape'}`}>
            <img src={result.image} alt="Ad background" />
            <div className="overlay">
              {result.boxes.map((box) => (
                <div 
                  key={box.id}
                  className={`text-box-wrapper font-${box.fontFamily} size-${box.fontSize}`}
                  style={{ 
                    transform: `translate(${box.x}px, ${box.y}px)`,
                  }}
                >
                  <div 
                    contentEditable
                    suppressContentEditableWarning
                    className="editable-text"
                    style={{ cursor: activeBoxId === box.id ? 'grabbing' : 'grab' }}
                    onMouseDown={(e) => handleDragStart(box.id, e.clientX, e.clientY)}
                    onTouchStart={(e) => handleDragStart(box.id, e.touches[0].clientX, e.touches[0].clientY)}
                    onBlur={(e) => updateBoxText(box.id, e.currentTarget.textContent || '')}
                  >
                    {box.text}
                  </div>
                  {result.boxes.length > 1 && (
                    <button className="delete-box" onClick={() => removeBox(box.id)}>×</button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <button className="download-hint" onClick={() => window.print()}>Save Ad (Print/PDF)</button>
        </div>
      )}
    </div>
  );
}

export default App;
