import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import html2canvas from 'html2canvas';
import './App.css';

const PEXELS_API_KEY = import.meta.env.VITE_PEXELS_API_KEY;
const UNSPLASH_ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;

const PLATFORMS = {
  IG: { label: 'Instagram', ratios: ['square', 'portrait', 'story', 'landscape'] },
  FB: { label: 'Facebook', ratios: ['square', 'landscape', 'portrait'] },
  PIN: { label: 'Pinterest', ratios: ['portrait', 'square'] },
  TK: { label: 'TikTok', ratios: ['story'] },
  YT: { label: 'YouTube', ratios: ['landscape', 'story'] },
  X: { label: 'X', ratios: ['landscape', 'square', 'portrait'] },
};

const PLATFORM_ICONS = {
  IG: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" fill="url(#ig-grad)"/><defs><linearGradient id="ig-grad" x1="12" y1="0" x2="12" y2="24" gradientUnits="userSpaceOnUse"><stop stop-color="#405DE6"/><stop offset="0.25" stop-color="#5851DB"/><stop offset="0.5" stop-color="#833AB4"/><stop offset="0.75" stop-color="#C13584"/><stop offset="1" stop-color="#FD1D1D"/></linearGradient></defs></svg>,
  FB: <svg width="40" height="40" viewBox="0 0 24 24" fill="#1877F2" xmlns="http://www.w3.org/2000/svg"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
  PIN: <svg width="40" height="40" viewBox="0 0 24 24" fill="#E60023" xmlns="http://www.w3.org/2000/svg"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.965 1.406-5.965s-.359-.719-.359-1.782c0-1.668 1.002-2.913 2.111-2.913.995 0 1.477.747 1.477 1.642 0 1.001-.637 2.5-.967 3.888-.275 1.155.573 2.097 1.712 2.097 2.054 0 3.633-2.167 3.633-5.297 0-2.769-1.989-4.707-4.833-4.707-3.293 0-5.225 2.47-5.225 5.022 0 1 .384 2.072.862 2.674a.333.333 0 01.077.319l-.319 1.299c-.051.209-.169.253-.391.157-1.46-.679-2.371-2.811-2.371-4.524 0-3.682 2.675-7.065 7.716-7.065 4.051 0 7.199 2.886 7.199 6.745 0 4.024-2.537 7.262-6.058 7.262-1.183 0-2.296-.614-2.677-1.342l-.728 2.772c-.263 1.003-1.003 2.257-1.494 3.056 1.125.347 2.314.535 3.547.535 6.622 0 12-5.378 12-12C24.017 5.367 18.639 0 12.017 0z"/></svg>,
  TK: <svg width="40" height="40" viewBox="0 0 24 24" fill="#FFFFFF" xmlns="http://www.w3.org/2000/svg"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.06-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-.99 0-1.49.18-3.4 2.36-6.52 5.56-7.75 1.22-.48 2.58-.61 3.87-.43v4.02c-.02 0-.03 0-.05-.01-.66-.13-1.37-.11-2.02.1-.49.15-.95.39-1.3.76-.45.48-.69 1.13-.7 1.78.01 1.1.8 2.14 1.88 2.38.48.12.98.12 1.47.01.95-.22 1.71-.93 1.93-1.87.01-2.11.01-4.21.01-6.33V0l.5-.02z"/></svg>,
  YT: <svg width="40" height="40" viewBox="0 0 24 24" fill="#FF0000" xmlns="http://www.w3.org/2000/svg"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.016 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>,
  X: <svg width="40" height="40" viewBox="0 0 24 24" fill="#FFFFFF" xmlns="http://www.w3.org/2000/svg"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932 6.064-6.932zm-1.292 19.494h2.039L6.486 3.24H4.298l13.311 17.407z"/></svg>
};

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

// Helper to fetch images from Unsplash with fallback to Pexels
const fetchImages = async (query: string, page: number, perPage: number): Promise<string[]> => {
  let images: string[] = [];

  // Try Unsplash first
  if (UNSPLASH_ACCESS_KEY) {
    try {
      const unsplashRes = await axios.get(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}&client_id=${UNSPLASH_ACCESS_KEY}`);
      if (unsplashRes.data.results && unsplashRes.data.results.length > 0) {
        images = unsplashRes.data.results.map((img: any) => img.urls.regular);
      }
    } catch (err) {
      console.warn('Unsplash fetch failed, falling back to Pexels', err);
    }
  }

  // Fallback to Pexels if Unsplash failed or returned no results
  if (images.length === 0) {
    try {
      const pexelsRes = await axios.get(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}`, {
        headers: { Authorization: PEXELS_API_KEY || '' }
      });
      if (pexelsRes.data.photos && pexelsRes.data.photos.length > 0) {
        images = pexelsRes.data.photos.map((p: any) => p.src.large2x);
      }
    } catch (err) {
      console.error('Pexels fetch failed', err);
    }
  }

  return images;
};

function App() {
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<'AUTO' | 'MANUAL' | 'BUILDER'>('AUTO');
  const [manualSearch, setManualSearch] = useState('');
  const [manualCopy, setManualCopy] = useState('');
  const [builderSearch, setBuilderSearch] = useState('');
  const [aiPolish, setAiPolish] = useState(true);
  const [activePlatform, setActivePlatform] = useState<keyof typeof PLATFORMS>('IG');
  const [format, setFormat] = useState('square');
  const [llmModel, setLlmModel] = useState('google/gemini-2.5-flash');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const adContainerRef = useRef<HTMLDivElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ image: string; boxes: TextBox[]; imageBoxes: ImageBox[]; postBody: string } | null>(null);
  
  // Thumbnail Logic
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [currentSearchTerm, setCurrentSearchTerm] = useState('');
  const [searchPage, setSearchPage] = useState(1);
  const [refreshingThumbs, setRefreshingThumbs] = useState(false);

  const [activeBoxId, setActiveBoxId] = useState<string | null>(null);
  const [activeResizeId, setActiveResizeId] = useState<string | null>(null);
  const [editingBoxId, setEditingBoxId] = useState<string | null>(null);
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
    // Sync current editing text before starting drag
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
      const imageDelta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;

      setResult({
        ...result,
        boxes: result.boxes.map(b => 
          b.id === activeResizeId ? { ...b, width: Math.max(50, resizeStart.width + deltaX) } : b
        ),
        imageBoxes: result.imageBoxes.map(b => 
          b.id === activeResizeId ? { ...b, width: Math.max(20, resizeStart.width + imageDelta) } : b
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
      const images = await fetchImages(currentSearchTerm, nextPage, 3);
      if (images.length > 0) {
        setThumbnails(images);
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

  const updateBoxFontSize = (id: string, fontSize: 'sm' | 'md' | 'lg') => {
    if (!result) return;
    setResult({
      ...result,
      boxes: result.boxes.map(b => b.id === id ? { ...b, fontSize } : b)
    });
  };

  const updateBoxFontFamily = (id: string, fontFamily: 'sans' | 'serif' | 'display') => {
    if (!result) return;
    setResult({
      ...result,
      boxes: result.boxes.map(b => b.id === id ? { ...b, fontFamily } : b)
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
      fontSize: 'md',
      fontFamily: 'sans'
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

  const handleDownloadPNG = async () => {
    if (!adContainerRef.current) return;
    try {
      const canvas = await html2canvas(adContainerRef.current, {
        useCORS: true,
        scale: 2,
        backgroundColor: null
      });
      const link = document.createElement('a');
      link.download = 'simp-ad.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      setToast('Ad saved to downloads!');
    } catch (err) {
      console.error(err);
      setToast('Failed to save image.');
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

      if (mode === 'AUTO') {
        if (!query) {
          setError('Please enter a prompt');
          setLoading(false);
          return;
        }
        const aiRes = await axios.get(`/api/ad?prompt=${encodeURIComponent(query)}&model=${llmModel}`);
        searchTerm = aiRes.data.searchTerm;
        adCopy = aiRes.data.adCopy;
        generatedPostBody = aiRes.data.postBody;
      } else if (mode === 'MANUAL') {
        if (!manualSearch || !manualCopy) {
          setError('Please fill in both fields');
          setLoading(false);
          return;
        }
        searchTerm = manualSearch;
        if (aiPolish) {
          const aiRes = await axios.get(`/api/ad?prompt=${encodeURIComponent(manualCopy)}&model=${llmModel}&manualSearch=${encodeURIComponent(manualSearch)}`);
          adCopy = aiRes.data.adCopy;
          generatedPostBody = aiRes.data.postBody;
        } else {
          adCopy = manualCopy;
        }
      } else {
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
      const images = await fetchImages(searchTerm, 1, 4);

      if (images.length > 0) {
        setResult({
          image: images[0],
          boxes: [
            { id: 'main', text: adCopy, x: 0, y: 0, width: 550, fontSize: 'md', fontFamily: 'sans' },
            { id: 'watermark', text: 'simp.ad', x: -220, y: 270, width: 200, fontSize: 'sm', fontFamily: 'sans' }
          ],
          imageBoxes: [
            { id: 'logo', src: '/assets/logo.png', x: 250, y: -250, width: 80 }
          ],
          postBody: generatedPostBody
        });
        if (images.length > 1) setThumbnails(images.slice(1));
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
    <div className="app-container">
      <header className="app-header">
        <div className="header-left"></div>
        <h1 className="logo-text">
          simp.<img src="/simp-ad-favicon/apple-touch-icon.png" alt="ad" className="title-logo" />
        </h1>
        <div className="header-right">
          <button className="settings-btn" onClick={() => setIsSettingsOpen(true)}>⚙️</button>
        </div>
        <p className="subtitle">Instant AI Ads</p>
      </header>

      {isSettingsOpen && (
        <div className="modal-overlay" onClick={() => setIsSettingsOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Settings</h3>
            <div className="control-group">
              <span className="control-label">AI Model</span>
              <div className="vertical-pill-group">
                {[
                  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash (Default)' },
                  { id: 'google/gemini-3-flash', name: 'Gemini 3 Flash (Stable)' },
                  { id: 'google/gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite' }
                ].map(m => (
                  <button key={m.id} className={llmModel === m.id ? 'active' : ''} onClick={() => setLlmModel(m.id)}>
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
            <button className="primary-btn" onClick={() => setIsSettingsOpen(false)}>Close</button>
          </div>
        </div>
      )}

      <div className="container">
        <div className="mode-toggle">
          {['AUTO', 'MANUAL', 'BUILDER'].map(m => (
            <button key={m} className={mode === m ? 'active' : ''} onClick={() => setMode(m as any)}>{m}</button>
          ))}
        </div>
        
        <div className="input-group">
          {mode === 'AUTO' && <input type="text" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="What are we selling today?" onKeyDown={(e) => e.key === 'Enter' && generateAd()} />}
          {mode === 'MANUAL' && (
            <div className="manual-container">
              <div className="manual-fields">
                <input type="text" value={manualSearch} onChange={(e) => setManualSearch(e.target.value)} placeholder="Image Search" />
                <input type="text" value={manualCopy} onChange={(e) => setManualCopy(e.target.value)} placeholder="Ad Copy Hook" />
              </div>
              <label className="checkbox-label"><input type="checkbox" checked={aiPolish} onChange={(e) => setAiPolish(e.target.checked)} /> AI Polish Copy</label>
            </div>
          )}
          {mode === 'BUILDER' && <input type="text" value={builderSearch} onChange={(e) => setBuilderSearch(e.target.value)} placeholder="Image Search" onKeyDown={(e) => e.key === 'Enter' && generateAd()} />}
          <button className="primary-btn" onClick={() => generateAd()} disabled={loading}>{loading ? 'Simping...' : 'Generate'}</button>
        </div>

        {thumbnails.length > 0 && (
          <div className="thumbnails-container">
            <div className="thumbnails-row">
              <label className="upload-thumb"><input type="file" hidden accept="image/*" onChange={handleMainImageUpload} /><span>+</span></label>
              {thumbnails.map((thumb, idx) => <img key={idx} src={thumb} alt="Option" className="thumbnail" onClick={() => setResult(prev => prev ? { ...prev, image: thumb } : null)} />)}
            </div>
            <button className="refresh-thumbs-btn" onClick={refreshThumbnails} disabled={refreshingThumbs}>↻</button>
          </div>
        )}

        {error && <p className="error">{error}</p>}

        {result && (
          <div className="ad-preview">
            <div className="platform-controls">
              <div className="platform-icons">
                {(Object.keys(PLATFORMS) as Array<keyof typeof PLATFORMS>).map(p => (
                  <button key={p} className={`platform-btn ${activePlatform === p ? 'active' : ''}`} onClick={() => { setActivePlatform(p); setFormat(PLATFORMS[p].ratios[0]); }}>
                    {PLATFORM_ICONS[p]}
                  </button>
                ))}
              </div>
              <div className="format-pills">
                {PLATFORMS[activePlatform].ratios.map(f => (
                  <button key={f} className={format === f ? 'active' : ''} onClick={() => setFormat(f)}>{f.toUpperCase()}</button>
                ))}
              </div>
            </div>

            <div className="style-controls">
              <button className="add-text-btn" onClick={addTextBox}>+ Add Text</button>
              <label className="add-text-btn" style={{ cursor: 'pointer' }}>+ Add Image<input type="file" hidden accept="image/*" onChange={addImageBox} /></label>
            </div>

            <div ref={adContainerRef} className={`ad-container ratio-${format}`}>
              <img src={result.image} alt="Ad background" />
              <div className="overlay">
                {result.boxes.map((box) => (
                  <div key={box.id} className={`text-box-wrapper font-${box.fontFamily} size-${box.fontSize}`} style={{ transform: `translate(calc(-50% + ${box.x}px), calc(-50% + ${box.y}px))`, width: box.width, zIndex: editingBoxId === box.id ? 100 : 1 }}>
                    <div contentEditable suppressContentEditableWarning className="editable-text" style={{ cursor: activeBoxId === box.id ? 'grabbing' : 'grab' }} onMouseDown={(e) => { e.stopPropagation(); handleDragStart(box.id, e.clientX, e.clientY); }} onTouchStart={(e) => { e.stopPropagation(); handleDragStart(box.id, e.touches[0].clientX, e.touches[0].clientY); }} onFocus={() => setEditingBoxId(box.id)} onBlur={(e) => { updateBoxText(box.id, e.currentTarget.innerText); setTimeout(() => setEditingBoxId(prev => prev === box.id ? null : prev), 200); }}>
                      {box.text}
                    </div>
                    {editingBoxId === box.id && (
                      <div className="floating-controls" onMouseDown={e => e.stopPropagation()}>
                        <div className="mini-pill-group">{['sm', 'md', 'lg'].map(sz => <button key={sz} className={box.fontSize === sz ? 'active' : ''} onClick={() => updateBoxFontSize(box.id, sz as any)}>{sz.toUpperCase()}</button>)}</div>
                        <div className="mini-pill-group">{['sans', 'serif', 'display'].map(f => <button key={f} className={box.fontFamily === f ? 'active' : ''} onClick={() => updateBoxFontFamily(box.id, f as any)}>{f === 'display' ? 'Bold' : f.charAt(0).toUpperCase() + f.slice(1)}</button>)}</div>
                      </div>
                    )}
                    <div className="resize-handle" onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(box.id, e.clientX, e.clientY); }} onTouchStart={(e) => { e.stopPropagation(); handleResizeStart(box.id, e.touches[0].clientX, e.touches[0].clientY); }} />
                    {result.boxes.length > 1 && <button className="delete-box" onClick={() => removeBox(box.id)}>×</button>}
                  </div>
                ))}
                {result.imageBoxes.map((box) => (
                  <div key={box.id} className="text-box-wrapper" style={{ transform: `translate(calc(-50% + ${box.x}px), calc(-50% + ${box.y}px))`, width: box.width, zIndex: activeBoxId === box.id ? 100 : 1 }}>
                    <img src={box.src} alt="Overlay" className="editable-image" style={{ cursor: activeBoxId === box.id ? 'grabbing' : 'grab' }} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleDragStart(box.id, e.clientX, e.clientY); }} onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); handleDragStart(box.id, e.touches[0].clientX, e.touches[0].clientY); }} />
                    <div className="resize-handle" onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(box.id, e.clientX, e.clientY); }} onTouchStart={(e) => { e.stopPropagation(); handleResizeStart(box.id, e.touches[0].clientX, e.touches[0].clientY); }} />
                    <button className="delete-box" onClick={() => removeBox(box.id)}>×</button>
                  </div>
                ))}
              </div>
            </div>

            {(result.postBody || mode === 'BUILDER') && (
              <div className="post-body-container">
                <div className="post-body-header"><span className="control-label">Post Caption</span><button className="copy-btn" onClick={() => { navigator.clipboard.writeText(result.postBody || ''); setToast('Copied to clipboard!'); }}>Copy</button></div>
                <p className="post-body-text" contentEditable suppressContentEditableWarning onBlur={(e) => setResult({ ...result, postBody: e.currentTarget.innerText })}>
                  {(result.postBody || "Write your caption here...").split(' ').map((word, i) => word.startsWith('#') ? <span key={i} className="hashtag" contentEditable={false}>{word} </span> : word + ' ')}
                </p>
              </div>
            )}
            <button className="download-hint" onClick={handleDownloadPNG}>Download PNG</button>
          </div>
        )}
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

export default App;