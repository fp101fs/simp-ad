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
  width: number;
  fontSize: 'sm' | 'md' | 'lg';
  fontFamily: 'sans' | 'serif' | 'display';
}

interface ImageBox {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
}

function App() {
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<'AUTO' | 'MANUAL' | 'BUILDER'>('AUTO');
  const [manualSearch, setManualSearch] = useState('');
  const [manualCopy, setManualCopy] = useState('');
  const [builderSearch, setBuilderSearch] = useState('');
  const [aiPolish, setAiPolish] = useState(true);
  const [instaMode, setInstaMode] = useState(true);
  const [format, setFormat] = useState('square');
  
  // Per-box styles are now in the TextBox interface
  const [globalFontSize, setGlobalFontSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [globalFontFamily, setGlobalFontFamily] = useState<'sans' | 'serif' | 'display'>('sans');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ image: string; boxes: TextBox[]; imageBoxes: ImageBox[]; postBody: string } | null>(null);
  
  // Thumbnail Logic
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [currentSearchTerm, setCurrentSearchTerm] = useState('');
  const [searchPage, setSearchPage] = useState(1);
  const [refreshingThumbs, setRefreshingThumbs] = useState(false);

  const [activeBoxId, setActiveBoxId] = useState<string | null>(null);
  const [activeResizeId, setActiveResizeId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0 });

  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Auto-clear toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

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
    // Sync current editing text before starting drag to prevent data loss
    if (document.activeElement instanceof HTMLElement && document.activeElement.contentEditable === 'true') {
      const activeId = result?.boxes.find(b => b.text === (document.activeElement as HTMLElement).innerText)?.id;
      if (activeId) updateBoxText(activeId, (document.activeElement as HTMLElement).innerText || '');
    }

    const box = result?.boxes.find(b => b.id === id) || result?.imageBoxes.find(b => b.id === id);
    if (!box) return;
    setActiveBoxId(id);
    setDragStart({ x: clientX - box.x, y: clientY - box.y });
  };

  const handleResizeStart = (id: string, clientX: number, clientY: number) => {
    // Sync current editing text before starting resize
    if (document.activeElement instanceof HTMLElement && document.activeElement.contentEditable === 'true') {
      updateBoxText(id, (document.activeElement as HTMLElement).innerText || '');
    }

    const box = result?.boxes.find(b => b.id === id) || result?.imageBoxes.find(b => b.id === id);
    if (!box) return;
    setActiveResizeId(id);
    setResizeStart({ x: clientX, y: clientY, width: box.width });
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!result) return;
    
    if (activeBoxId) {
      setResult({
        ...result,
        boxes: result.boxes.map(b => 
          b.id === activeBoxId ? { ...b, x: clientX - dragStart.x, y: clientY - dragStart.y } : b
        ),
        imageBoxes: result.imageBoxes.map(b => 
          b.id === activeBoxId ? { ...b, x: clientX - dragStart.x, y: clientY - dragStart.y } : b
        )
      });
    } else if (activeResizeId) {
      const deltaX = (clientX - resizeStart.x) * 2;
      const deltaY = (clientY - resizeStart.y) * 2;
      
      setResult({
        ...result,
        boxes: result.boxes.map(b => 
          b.id === activeResizeId ? { ...b, width: Math.max(100, resizeStart.width + deltaX) } : b
        ),
        imageBoxes: result.imageBoxes.map(b => 
          b.id === activeResizeId ? { ...b, width: Math.max(50, resizeStart.width + (deltaX + deltaY)) } : b
        )
      });
    }
  };

  const handleDragEnd = () => {
    setActiveBoxId(null);
    setActiveResizeId(null);
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (activeBoxId || activeResizeId) {
        e.preventDefault();
        handleDragMove(e.clientX, e.clientY);
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (activeBoxId || activeResizeId) {
        e.preventDefault();
        handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onUp = () => handleDragEnd();

    if (activeBoxId || activeResizeId) {
      window.addEventListener('mousemove', onMouseMove, { passive: false });
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
  }, [activeBoxId, activeResizeId, dragStart, resizeStart, result]);

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
      width: 250,
      fontSize: globalFontSize,
      fontFamily: globalFontFamily
    };
    setResult({ ...result, boxes: [...result.boxes, newBox] });
  };

  const addImageBox = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!result || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      if (!event.target?.result) return;
      const newImageBox: ImageBox = {
        id: Math.random().toString(36).substr(2, 9),
        src: event.target.result as string,
        x: 0,
        y: 0,
        width: 150
      };
      setResult({ ...result, imageBoxes: [...result.imageBoxes, newImageBox] });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleMainImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!result || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      if (!event.target?.result) return;
      setResult({ ...result, image: event.target.result as string });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeBox = (id: string) => {
    if (!result) return;
    if (result.boxes.some(b => b.id === id) && result.boxes.length > 1) {
      setResult({ ...result, boxes: result.boxes.filter(b => b.id !== id) });
    } else if (result.imageBoxes.some(b => b.id === id)) {
      setResult({ ...result, imageBoxes: result.imageBoxes.filter(b => b.id !== id) });
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
      let generatedPostBody = '';

      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      if (mode === 'AUTO') {
        if (!query) {
          setError('Please enter a prompt');
          setLoading(false);
          return;
        }
        
        const aiPrompt = `Analyze this business/idea prompt: "${query}". 
        Generate a cohesive, professional, and family-friendly ad concept by providing:
        1. "searchTerm": A literal, descriptive image search term (e.g., "scoop of vanilla ice cream on a cone").
        2. "adCopy": A short, punchy ad headline (max 10 words).
        3. "postBody": An engaging social media caption (1-3 sentences) with relevant hashtags.
        Return a JSON object with these three fields.
        Return ONLY the JSON.`;

        const aiResult = await model.generateContent(aiPrompt);
        const aiResponse = aiResult.response.text();
        const cleanJson = aiResponse.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        searchTerm = parsed.searchTerm;
        adCopy = parsed.adCopy;
        generatedPostBody = parsed.postBody;
      } else if (mode === 'MANUAL') {
        if (!manualSearch || !manualCopy) {
          setError('Please fill in both fields');
          setLoading(false);
          return;
        }
        searchTerm = manualSearch;
        
        if (aiPolish) {
          const aiPrompt = `Refine this ad copy idea: "${manualCopy}".
          The background image for this ad is based on the search term: "${manualSearch}".
          Create a professional and family-friendly ad concept.
          Return a JSON object with:
          1. "adCopy": A single short, punchy headline (max 10 words).
          2. "postBody": An engaging social media caption (1-3 sentences) with hashtags.
          Return ONLY the JSON.`;

          const aiResult = await model.generateContent(aiPrompt);
          const aiResponse = aiResult.response.text();
          const cleanJson = aiResponse.replace(/```json|```/g, '').trim();
          const parsed = JSON.parse(cleanJson);
          adCopy = parsed.adCopy;
          generatedPostBody = parsed.postBody;
        } else {
          adCopy = manualCopy;
        }
      } else {
        // BUILDER mode
        if (!builderSearch) {
          setError('Enter an image search term');
          setLoading(false);
          return;
        }
        searchTerm = builderSearch;
        adCopy = 'Click me to edit';
      }

      setCurrentSearchTerm(searchTerm);
      setSearchPage(1);

      const pexelsRes = await axios.get(`https://api.pexels.com/v1/search?query=${encodeURIComponent(searchTerm)}&per_page=4&page=1`, {
        headers: { Authorization: PEXELS_API_KEY }
      });

      if (pexelsRes.data.photos.length > 0) {
        setResult({
          image: pexelsRes.data.photos[0].src.large2x,
          boxes: [
            {
              id: 'main',
              text: adCopy,
              x: 0,
              y: 0,
              width: 550, // Wider default
              fontSize: globalFontSize,
              fontFamily: globalFontFamily
            },
            {
              id: 'watermark',
              text: 'simp.ad',
              x: -220, // Smidge left
              y: 270, // Smidge down
              width: 200,
              fontSize: 'sm',
              fontFamily: 'sans'
            }
          ],
          imageBoxes: [
            {
              id: 'logo',
              src: '/assets/logo.png',
              x: 250, 
              y: -250, // Pushed further up
              width: 80
            }
          ],
          postBody: generatedPostBody
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
      <h1 className="logo-text">
        simp.<img src="/simp-ad-favicon/apple-touch-icon.png" alt="ad" className="title-logo" />
      </h1>
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
        <button 
          className={mode === 'BUILDER' ? 'active' : ''} 
          onClick={() => setMode('BUILDER')}
        >
          BUILDER
        </button>
      </div>
      
      <div className="input-group">
        {mode === 'AUTO' && (
          <input 
            type="text" 
            value={prompt} 
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="What are we selling today?"
            onKeyDown={(e) => e.key === 'Enter' && generateAd()}
          />
        )}
        
        {mode === 'MANUAL' && (
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

        {mode === 'BUILDER' && (
          <input 
            type="text" 
            value={builderSearch} 
            onChange={(e) => setBuilderSearch(e.target.value)}
            placeholder="Image Search (e.g. Skyline)"
            onKeyDown={(e) => e.key === 'Enter' && generateAd()}
          />
        )}
        <button className="primary-btn" onClick={() => generateAd()} disabled={loading}>
          {loading ? 'Simping...' : 'Generate'}
        </button>
      </div>

      {thumbnails.length > 0 && (
        <div className="thumbnails-container">
          <div className="thumbnails-row">
            <label className="upload-thumb">
              <input type="file" hidden accept="image/*" onChange={handleMainImageUpload} />
              <span>+</span>
            </label>
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
            <label className="add-text-btn" style={{ cursor: 'pointer' }}>
              + Add Image
              <input 
                type="file" 
                hidden 
                accept="image/*" 
                onChange={addImageBox}
              />
            </label>
          </div>

          <div className={`ad-container ratio-${instaMode ? format : 'landscape'}`}>
            <img src={result.image} alt="Ad background" />
            <div className="overlay">
              {result.boxes.map((box) => (
                <div 
                  key={box.id}
                  className={`text-box-wrapper font-${box.fontFamily} size-${box.fontSize}`}
                  style={{ 
                    transform: `translate(calc(-50% + ${box.x}px), calc(-50% + ${box.y}px))`,
                    width: box.width,
                  }}
                >
                  <div 
                    contentEditable
                    suppressContentEditableWarning
                    className="editable-text"
                    style={{ cursor: activeBoxId === box.id ? 'grabbing' : 'grab' }}
                    onMouseDown={(e) => handleDragStart(box.id, e.clientX, e.clientY)}
                    onTouchStart={(e) => handleDragStart(box.id, e.touches[0].clientX, e.touches[0].clientY)}
                    onBlur={(e) => updateBoxText(box.id, e.currentTarget.innerText || '')}
                  >
                    {box.text}
                  </div>
                  <div 
                    className="resize-handle"
                    onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(box.id, e.clientX, e.clientY); }}
                    onTouchStart={(e) => { e.stopPropagation(); handleResizeStart(box.id, e.touches[0].clientX, e.touches[0].clientY); }}
                  />
                  {result.boxes.length > 1 && (
                    <button className="delete-box" onClick={() => removeBox(box.id)}>×</button>
                  )}
                </div>
              ))}

              {result.imageBoxes.map((box) => (
                <div 
                  key={box.id}
                  className="text-box-wrapper"
                  style={{ 
                    transform: `translate(calc(-50% + ${box.x}px), calc(-50% + ${box.y}px))`,
                    width: box.width,
                  }}
                >
                  <img 
                    src={box.src} 
                    alt="Overlay" 
                    className="editable-image"
                    style={{ cursor: activeBoxId === box.id ? 'grabbing' : 'grab' }}
                    onMouseDown={(e) => { e.preventDefault(); handleDragStart(box.id, e.clientX, e.clientY); }}
                    onTouchStart={(e) => { e.preventDefault(); handleDragStart(box.id, e.touches[0].clientX, e.touches[0].clientY); }}
                  />
                  <div 
                    className="resize-handle"
                    onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(box.id, e.clientX, e.clientY); }}
                    onTouchStart={(e) => { e.stopPropagation(); handleResizeStart(box.id, e.touches[0].clientX, e.touches[0].clientY); }}
                  />
                  <button className="delete-box" onClick={() => removeBox(box.id)}>×</button>
                </div>
              ))}
            </div>
          </div>

          {(result.postBody || mode === 'BUILDER') && (
            <div className="post-body-container">
              <div className="post-body-header">
                <span className="control-label">Post Caption</span>
                <button 
                  className="copy-btn" 
                  onClick={() => {
                    navigator.clipboard.writeText(result.postBody || '');
                    setToast('Copied to clipboard!');
                  }}
                >
                  Copy
                </button>
              </div>
              <p 
                className="post-body-text" 
                contentEditable 
                suppressContentEditableWarning
                onBlur={(e) => setResult({ ...result, postBody: e.currentTarget.innerText })}
              >
                {result.postBody || "Write your caption here..."}
              </p>
            </div>
          )}

          <button className="download-hint" onClick={() => window.print()}>Save Ad (Print/PDF)</button>
        </div>
      )}
      {toast && (
        <div className="toast">
          {toast}
        </div>
      )}
    </div>
  );
}

export default App;
