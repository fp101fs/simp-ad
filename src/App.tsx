import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import html2canvas from 'html2canvas';
import './App.css';

// Declare global gtag function for Google Analytics
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
  }
}

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
  color: string;
  color2?: string;
  isGradient: boolean;
  outline: boolean;
  outlineColor: string;
  shadow: boolean;
  shadowColor: string;
}

interface ImageBox {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
}

const fetchImages = async (query: string, page: number, perPage: number): Promise<string[]> => {
  let images: string[] = [];
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
  const [activePlatform, setActivePlatform] = useState<keyof typeof PLATFORMS>('IG');
  const [format, setFormat] = useState('square');
  const [llmModel, setLlmModel] = useState('openrouter/free');
  const [aiProvider, setAiProvider] = useState<'google' | 'openrouter'>('openrouter');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPlatformSelectorOpen, setIsPlatformSelectorOpen] = useState(false);
  const [isBgSelectorOpen, setIsBgSelectorOpen] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [bgSearchQuery, setBgSearchQuery] = useState('');
  const adContainerRef = useRef<HTMLDivElement>(null);
  const platformRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetIdRef = useRef<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ image: string; boxes: TextBox[]; imageBoxes: ImageBox[]; postBody: string } | null>(null);

  const [selectedImageBoxId, setSelectedImageBoxId] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (platformRef.current && !platformRef.current.contains(event.target as Node)) setIsPlatformSelectorOpen(false);
      if (bgRef.current && !bgRef.current.contains(event.target as Node)) setIsBgSelectorOpen(false);
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) setIsAddMenuOpen(false);

      // Close editor if clicking outside everything related to it
      if (editorRef.current && !editorRef.current.contains(event.target as Node)) {
        const isClickingBox = result?.boxes.some(b => document.getElementById(`box-${b.id}`)?.contains(event.target as Node));
        if (!isClickingBox) {
          setEditingBoxId(null);
        }
      }

      // Deselect image box if clicking outside image boxes
      const isClickingImageBox = result?.imageBoxes.some(b => document.getElementById(`imgbox-${b.id}`)?.contains(event.target as Node));
      if (!isClickingImageBox) setSelectedImageBoxId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [result]);

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

  // Helper for Google Analytics events
  const trackEvent = (action: string, category: string, label?: string) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', action, {
        event_category: category,
        event_label: label,
      });
    }
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const urlPrompt = searchParams.get('prompt');
    const urlPlatform = searchParams.get('platform');
    const urlBg = searchParams.get('bg');

    if (urlPlatform && PLATFORMS[urlPlatform as keyof typeof PLATFORMS]) {
      setActivePlatform(urlPlatform as keyof typeof PLATFORMS);
      setFormat(PLATFORMS[urlPlatform as keyof typeof PLATFORMS].ratios[0]);
    }

    if (urlPrompt) {
      setPrompt(urlPrompt);
      generateAd(urlPrompt, urlBg || undefined);
    } else {
      const isMobile = window.innerWidth < 600;
      const cornerX = isMobile ? 130 : 250;
      const cornerY = isMobile ? 130 : 250;

      setResult({
        image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=2070&auto=format&fit=crop',
        boxes: [
          { id: 'main', text: 'Healthy living made simple.', x: 0, y: 0, width: 550, fontSize: 'md', fontFamily: 'sans', color: '#ffffff', isGradient: false, outline: false, outlineColor: '#000000', shadow: true, shadowColor: '#000000' },
          { id: 'watermark', text: 'simp.ad', x: -cornerX + 30, y: cornerY + 20, width: 200, fontSize: 'sm', fontFamily: 'sans', color: '#ffffff', isGradient: false, outline: false, outlineColor: '#000000', shadow: true, shadowColor: '#000000' }
        ],
        imageBoxes: [{ id: 'logo', src: '/assets/logo.png', x: cornerX, y: -cornerY, width: 80 }],
        postBody: "Experience the ease of healthy choices with our intuitive wellness guide. 🌿 #healthylifestyle #wellness #simpleliving"
      });
    }
  }, []);

  const handleDragStart = (id: string, clientX: number, clientY: number) => {
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
    if (document.activeElement instanceof HTMLElement && document.activeElement.contentEditable === 'true') {
      updateBoxText(id, (document.activeElement as HTMLElement).innerText || '');
    }
    const box = result?.boxes.find(b => b.id === id) || result?.imageBoxes.find(b => b.id === id);
    if (!box) return;
    setActiveResizeId(id);
    setResizeStart({ x: clientX, y: clientY, width: box.width });
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (activeBoxId) {
      setResult(prev => {
        if (!prev) return null;
        return {
          ...prev,
          boxes: prev.boxes.map(b => b.id === activeBoxId ? { ...b, x: clientX - dragStart.x, y: clientY - dragStart.y } : b),
          imageBoxes: prev.imageBoxes.map(b => b.id === activeBoxId ? { ...b, x: clientX - dragStart.x, y: clientY - dragStart.y } : b)
        };
      });
    } else if (activeResizeId) {
      const deltaX = (clientX - resizeStart.x) * 2;
      setResult(prev => {
        if (!prev) return null;
        return {
          ...prev,
          boxes: prev.boxes.map(b => b.id === activeResizeId ? { ...b, width: Math.max(50, resizeStart.width + deltaX) } : b),
          imageBoxes: prev.imageBoxes.map(b => b.id === activeResizeId ? { ...b, width: Math.max(20, resizeStart.width + deltaX) } : b)
        };
      });
    }
  };

  const handleDragEnd = () => {
    setActiveBoxId(null);
    setActiveResizeId(null);
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => { if (activeBoxId || activeResizeId) { e.preventDefault(); handleDragMove(e.clientX, e.clientY); } };
    const onTouchMove = (e: TouchEvent) => { if (activeBoxId || activeResizeId) { e.preventDefault(); handleDragMove(e.touches[0].clientX, e.touches[0].clientY); } };
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
  }, [activeBoxId, activeResizeId, dragStart, resizeStart]);

  useEffect(() => {
    if (!adContainerRef.current) return;
    const rafId = requestAnimationFrame(() => {
      if (!adContainerRef.current) return;
      const { width, height } = adContainerRef.current.getBoundingClientRect();
      setResult(prev => {
        if (!prev) return null;
        return {
          ...prev,
          boxes: prev.boxes.map(b =>
            b.id === 'watermark'
              ? { ...b, x: 125 - width / 2, y: height / 2 - 40 }
              : b
          ),
          imageBoxes: prev.imageBoxes.map(b =>
            b.id === 'logo'
              ? { ...b, x: width / 2 - 55, y: -(height / 2 - 55) }
              : b
          ),
        };
      });
    });
    return () => cancelAnimationFrame(rafId);
  }, [format]);

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

  const handlePopupSearch = async () => {
    if (!bgSearchQuery) return;
    setRefreshingThumbs(true);
    try {
      const images = await fetchImages(bgSearchQuery, 1, 3);
      if (images.length > 0) {
        setThumbnails(images);
        setCurrentSearchTerm(bgSearchQuery);
        setSearchPage(1);
      }
    } catch (err) {
      console.error("Popup search failed", err);
    } finally {
      setRefreshingThumbs(false);
    }
  };

  // Use functional updates to avoid stale closure issues (fixes mobile outline bug)
  const updateBoxText = (id: string, text: string) => {
    setResult(prev => {
      if (!prev) return null;
      return { ...prev, boxes: prev.boxes.map(b => b.id === id ? { ...b, text } : b) };
    });
  };

  const updateBoxFontSize = (id: string, fontSize: 'sm' | 'md' | 'lg') => {
    setResult(prev => {
      if (!prev) return null;
      return { ...prev, boxes: prev.boxes.map(b => b.id === id ? { ...b, fontSize } : b) };
    });
  };

  const updateBoxFontFamily = (id: string, fontFamily: 'sans' | 'serif' | 'display') => {
    setResult(prev => {
      if (!prev) return null;
      return { ...prev, boxes: prev.boxes.map(b => b.id === id ? { ...b, fontFamily } : b) };
    });
  };

  const updateBoxColor = (id: string, color: string, color2?: string, isGradient?: boolean) => {
    setResult(prev => {
      if (!prev) return null;
      return {
        ...prev,
        boxes: prev.boxes.map(b => b.id === id ? {
          ...b,
          color,
          color2: color2 || b.color2 || '#7928ca',
          isGradient: isGradient !== undefined ? isGradient : b.isGradient
        } : b)
      };
    });
  };

  const updateBoxOutline = (id: string, outline: boolean, color?: string) => {
    setResult(prev => {
      if (!prev) return null;
      return {
        ...prev,
        boxes: prev.boxes.map(b => b.id === id ? {
          ...b,
          outline,
          outlineColor: color || b.outlineColor || '#000000'
        } : b)
      };
    });
  };

  const updateBoxShadow = (id: string, shadow: boolean, color?: string) => {
    setResult(prev => {
      if (!prev) return null;
      return {
        ...prev,
        boxes: prev.boxes.map(b => b.id === id ? {
          ...b,
          shadow,
          shadowColor: color || b.shadowColor || '#000000'
        } : b)
      };
    });
  };

  const addTextBox = () => {
    const newBox: TextBox = { id: Math.random().toString(36).substr(2, 9), text: 'New Text', x: 0, y: 50, width: 250, fontSize: 'md', fontFamily: 'sans', color: '#ffffff', isGradient: false, outline: false, outlineColor: '#000000', shadow: true, shadowColor: '#000000' };
    setResult(prev => prev ? { ...prev, boxes: [...prev.boxes, newBox] } : null);
  };

  const addImageBox = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      if (!event.target?.result) return;
      const newImageBox: ImageBox = { id: Math.random().toString(36).substr(2, 9), src: event.target.result as string, x: 0, y: 0, width: 150 };
      setResult(prev => prev ? { ...prev, imageBoxes: [...prev.imageBoxes, newImageBox] } : null);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const triggerReplaceImage = (id: string) => {
    replaceTargetIdRef.current = id;
    replaceFileInputRef.current?.click();
  };

  const replaceImageBox = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !replaceTargetIdRef.current) return;
    const file = e.target.files[0];
    const targetId = replaceTargetIdRef.current;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (!event.target?.result) return;
      setResult(prev => prev ? {
        ...prev,
        imageBoxes: prev.imageBoxes.map(b => b.id === targetId ? { ...b, src: event.target!.result as string } : b)
      } : null);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
    replaceTargetIdRef.current = null;
  };

  const handleMainImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      if (!event.target?.result) return;
      setResult(prev => prev ? { ...prev, image: event.target!.result as string } : null);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeBox = (id: string) => {
    setResult(prev => {
      if (!prev) return null;
      if (prev.boxes.some(b => b.id === id) && prev.boxes.length > 1) {
        return { ...prev, boxes: prev.boxes.filter(b => b.id !== id) };
      } else if (prev.imageBoxes.some(b => b.id === id)) {
        return { ...prev, imageBoxes: prev.imageBoxes.filter(b => b.id !== id) };
      }
      return prev;
    });
  };

  const handleDownloadPNG = async () => {
    if (!adContainerRef.current) return;
    try {
      trackEvent('download_image', 'Ad', 'PNG Download');
      const canvas = await html2canvas(adContainerRef.current, { useCORS: true, scale: 2, backgroundColor: null });
      const link = document.createElement('a');
      link.download = 'simp-ad.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      setToast('Ad saved to downloads!');
    } catch (err) { console.error(err); setToast('Failed to save image.'); }
  };

  const handleShare = () => {
    trackEvent('share_link', 'Engagement', 'Share Setup');
    const url = new URL(window.location.href);
    url.searchParams.set('prompt', prompt);
    url.searchParams.set('platform', activePlatform);
    if (currentSearchTerm) url.searchParams.set('bg', currentSearchTerm);
    navigator.clipboard.writeText(url.toString());
    setToast('Link copied to clipboard!');
  };

  const generateAd = async (promptOverride?: string, bgTerm?: string) => {
    const query = promptOverride || prompt;
    if (!query) { setError('Please enter a prompt'); return; }
    trackEvent('generate_ad_start', 'AI', 'Start Generation');
    setLoading(true);
    setError('');
    setResult(null);
    setThumbnails([]);

    const searchParams = new URLSearchParams(window.location.search);
    const textColor = searchParams.get('textColor') || '#ffffff';
    const textGradient = searchParams.get('textGradient') === 'true';
    const textOutline = searchParams.get('textOutline') === 'true';
    const textShadow = searchParams.get('textShadow') !== 'false';

    try {
      const aiRes = await axios.get(`/api/ad?prompt=${encodeURIComponent(query)}&model=${llmModel}&provider=${aiProvider}`);
      const searchTerm = bgTerm || aiRes.data.searchTerm;
      const adCopy = aiRes.data.adCopy;
      const generatedPostBody = aiRes.data.postBody;

      trackEvent('generate_ad_success', 'AI', 'Success');

      setCurrentSearchTerm(searchTerm);
      setSearchPage(1);
      const images = await fetchImages(searchTerm, 1, 4);
      if (images.length > 0) {
        const isMobile = window.innerWidth < 600;
        const cornerX = isMobile ? 130 : 250;
        const cornerY = isMobile ? 130 : 250;

        setResult({
          image: images[0],
          boxes: [
            { id: 'main', text: adCopy, x: 0, y: 0, width: 550, fontSize: 'md', fontFamily: 'sans', color: textColor, isGradient: textGradient, outline: textOutline, outlineColor: '#000000', shadow: textShadow, shadowColor: '#000000' },
            { id: 'watermark', text: 'simp.ad', x: -cornerX + 30, y: cornerY + 20, width: 200, fontSize: 'sm', fontFamily: 'sans', color: '#ffffff', isGradient: false, outline: false, outlineColor: '#000000', shadow: true, shadowColor: '#000000' }
          ],
          imageBoxes: [{ id: 'logo', src: '/assets/logo.png', x: cornerX, y: -cornerY, width: 80 }],
          postBody: generatedPostBody
        });
        if (images.length > 1) setThumbnails(images.slice(1));
      } else { setError('No relevant images found.'); }
    } catch (err: any) { console.error(err); setError('Failed to generate ad.'); } finally { setLoading(false); }
  };

  const FONT_SIZE_LABELS: Record<string, string> = { sm: 'Sm', md: 'Md', lg: 'Lg' };
  const FONT_FAMILY_LABELS: Record<string, string> = { sans: 'Sans', serif: 'Serif', display: 'Bold' };
  const FONT_SIZES = ['sm', 'md', 'lg'] as const;
  const FONT_FAMILIES = ['sans', 'serif', 'display'] as const;

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-left"></div>
        <h1 className="logo-text">
          <span className="sr-only">AI Ad Maker - </span>
          simp.<img src="/simp-ad-favicon/apple-touch-icon.png" alt="AI Ad Maker" className="title-logo" />
        </h1>
        <div className="header-right">
          <button className="settings-btn" onClick={handleShare} title="Share Setup">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </button>
          <button className="settings-btn" onClick={() => setIsSettingsOpen(true)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
        </div>
        <p className="subtitle">✨AI Ad Maker</p>
      </header>

      {isSettingsOpen && (
        <div className="modal-overlay" onClick={() => setIsSettingsOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Settings</h3>

            <div className="control-group">
              <span className="control-label">AI Provider</span>
              <div className="vertical-pill-group">
                {([
                  { id: 'openrouter', name: 'OpenRouter', desc: 'Default · Free tier via OPENROUTER_API_KEY' },
                  { id: 'google', name: 'Google Gemini', desc: 'Alternative · Requires VITE_GEMINI_API_KEY' }
                ] as const).map(p => (
                  <button key={p.id} className={aiProvider === p.id ? 'active' : ''} onClick={() => {
                    setAiProvider(p.id);
                    if (p.id === 'openrouter') setLlmModel('openrouter/free');
                    else setLlmModel('google/gemini-2.5-flash-lite');
                  }}>
                    <span className="model-name">{p.name}</span>
                    <span className="model-id">{p.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {aiProvider === 'google' && (
              <div className="control-group">
                <span className="control-label">Gemini Model</span>
                <div className="vertical-pill-group">
                  {[
                    { id: 'google/gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite (Default)' },
                    { id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash (Preview)' },
                    { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash' }
                  ].map(m => (
                    <button key={m.id} className={llmModel === m.id ? 'active' : ''} onClick={() => setLlmModel(m.id)}>
                      <span className="model-name">{m.name}</span>
                      <span className="model-id">{m.id}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {aiProvider === 'openrouter' && (
              <div className="control-group">
                <span className="control-label">OpenRouter Model</span>
                <div className="vertical-pill-group">
                  <button className="active">
                    <span className="model-name">Free Model</span>
                    <span className="model-id">Best available free model on OpenRouter</span>
                  </button>
                </div>
              </div>
            )}

            <button className="primary-btn" onClick={() => setIsSettingsOpen(false)}>Close</button>
          </div>
        </div>
      )}

      <div className="container">
        <div className="input-group">
          <input type="text" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="What are we selling today?" onKeyDown={(e) => e.key === 'Enter' && generateAd()} />
          <button className="go-btn" onClick={() => generateAd()} disabled={loading}>
            {loading ? <svg className="spinning" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> : 'GO'}
          </button>
        </div>

        {error && <p className="error">{error}</p>}

        {result && (
          <div className="ad-preview">
            <div className="style-controls">
              <div className="platform-dropdown" ref={platformRef}>
                <button className="platform-trigger" onClick={() => setIsPlatformSelectorOpen(!isPlatformSelectorOpen)}>
                  <div className="platform-btn active small-btn">{PLATFORM_ICONS[activePlatform]}</div>
                  <span className={`dropdown-arrow ${isPlatformSelectorOpen ? 'open' : ''}`}>▼</span>
                </button>
                {isPlatformSelectorOpen && (
                  <div className="platform-icons popup">
                    <div className="platform-row">
                      {(Object.keys(PLATFORMS) as Array<keyof typeof PLATFORMS>).map(p => (
                        <button key={p} className={`platform-btn ${activePlatform === p ? 'active' : ''}`} onClick={() => { setActivePlatform(p); setFormat(PLATFORMS[p].ratios[0]); }}>{PLATFORM_ICONS[p]}</button>
                      ))}
                    </div>
                    <div className="format-pills dropdown-pills">
                      {PLATFORMS[activePlatform].ratios.map(f => <button key={f} className={format === f ? 'active' : ''} onClick={() => { setFormat(f); setIsPlatformSelectorOpen(false); }}>{f.toUpperCase()}</button>)}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-selector-wrapper" ref={bgRef}>
                <button className={`add-text-btn ${isBgSelectorOpen ? 'active' : ''}`} onClick={() => setIsBgSelectorOpen(!isBgSelectorOpen)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <span>BG</span> {isBgSelectorOpen ? '▲' : '▼'}
                </button>
                {isBgSelectorOpen && (
                  <div className="platform-icons popup bg-popup">
                    <div className="popup-search-bar">
                      <input type="text" value={bgSearchQuery} onChange={(e) => setBgSearchQuery(e.target.value)} placeholder="Search images.. ex: yoga, dogs" onKeyDown={(e) => e.key === 'Enter' && handlePopupSearch()} />
                      <button className="popup-search-btn" onClick={handlePopupSearch}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></button>
                    </div>
                    <div className="thumbnails-row">
                      <label className="upload-thumb"><input type="file" hidden accept="image/*" onChange={handleMainImageUpload} /><span>+</span></label>
                      {thumbnails.map((thumb, idx) => <img key={idx} src={thumb} alt="Option" className="thumbnail" onClick={() => { setResult(prev => prev ? { ...prev, image: thumb } : null); setIsBgSelectorOpen(false); }} />)}
                      <button className="refresh-thumbs-btn" onClick={refreshThumbnails} disabled={refreshingThumbs}><svg className={refreshingThumbs ? 'spinning' : ''} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></button>
                    </div>
                  </div>
                )}
              </div>

              {/* Combined + button for Add Text / Add Image */}
              <div className="add-menu-wrapper" ref={addMenuRef}>
                <button className="add-menu-btn" onClick={() => setIsAddMenuOpen(!isAddMenuOpen)} title="Add element">+</button>
                {isAddMenuOpen && (
                  <div className="add-menu-popup">
                    <button className="add-menu-option" onClick={() => { addTextBox(); setIsAddMenuOpen(false); }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
                      Add Text
                    </button>
                    <label className="add-menu-option" style={{ cursor: 'pointer' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      Add Image
                      <input type="file" hidden accept="image/*" onChange={(e) => { addImageBox(e); setIsAddMenuOpen(false); }} />
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Hidden file input for replacing images */}
            <input ref={replaceFileInputRef} type="file" hidden accept="image/*" onChange={replaceImageBox} />

            <div ref={adContainerRef} className={`ad-container ratio-${format}`}>
              <img src={result.image} alt="Ad background" />
              <div className="overlay">
                {result.boxes.map((box) => (
                  <div key={box.id} id={`box-${box.id}`} className={`text-box-wrapper font-${box.fontFamily} size-${box.fontSize}`} style={{ transform: `translate(calc(-50% + ${box.x}px), calc(-50% + ${box.y}px))`, width: box.width, zIndex: editingBoxId === box.id ? 100 : 1 }}>
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      className="editable-text"
                      style={{
                        cursor: activeBoxId === box.id ? 'grabbing' : 'grab',
                        color: box.isGradient ? 'transparent' : box.color,
                        backgroundImage: box.isGradient ? `linear-gradient(45deg, ${box.color}, ${box.color2 || '#7928ca'})` : 'none',
                        backgroundClip: box.isGradient ? 'text' : 'border-box',
                        WebkitBackgroundClip: box.isGradient ? 'text' : 'border-box',
                        WebkitTextStroke: box.outline ? `2px ${box.outlineColor}` : '0px transparent',
                        textShadow: box.shadow && !box.isGradient ? `0 4px 15px ${box.shadowColor}` : 'none',
                        filter: box.shadow && box.isGradient ? `drop-shadow(0 4px 15px ${box.shadowColor})` : 'none',
                        paintOrder: 'stroke fill'
                      }}
                      onMouseDown={(e) => { e.stopPropagation(); handleDragStart(box.id, e.clientX, e.clientY); }}
                      onTouchStart={(e) => { e.stopPropagation(); handleDragStart(box.id, e.touches[0].clientX, e.touches[0].clientY); }}
                      onFocus={() => setEditingBoxId(box.id)}
                      onBlur={(e) => {
                        updateBoxText(box.id, e.currentTarget.innerText);
                        setTimeout(() => {
                          if (!editorRef.current?.contains(document.activeElement)) {
                            setEditingBoxId(prev => prev === box.id ? null : prev);
                          }
                        }, 200);
                      }}
                    >
                      {box.text}
                    </div>
                    {editingBoxId === box.id && (
                      <div className={`floating-controls ${box.y > 0 ? 'position-top' : ''}`} ref={editorRef} onMouseDown={e => e.stopPropagation()}>
                        {/* Cycle buttons for font size and font family */}
                        <div className="cycle-controls">
                          <button className="cycle-btn" onClick={() => {
                            const idx = FONT_SIZES.indexOf(box.fontSize);
                            updateBoxFontSize(box.id, FONT_SIZES[(idx + 1) % FONT_SIZES.length]);
                          }} title="Change Font Size">
                            <span className="cycle-value">{FONT_SIZE_LABELS[box.fontSize]}</span>
                            <span className="cycle-label">Size</span>
                          </button>
                          <button className="cycle-btn" onClick={() => {
                            const idx = FONT_FAMILIES.indexOf(box.fontFamily);
                            updateBoxFontFamily(box.id, FONT_FAMILIES[(idx + 1) % FONT_FAMILIES.length]);
                          }} title="Change Font Family">
                            <span className="cycle-value">{FONT_FAMILY_LABELS[box.fontFamily]}</span>
                            <span className="cycle-label">Font</span>
                          </button>
                        </div>

                        {/* Color / outline / shadow controls — unchanged */}
                        <div className="mini-pill-group color-controls">
                          <div className="color-btn-wrapper">
                            <button className={!box.isGradient ? 'active' : ''} onClick={() => updateBoxColor(box.id, box.color, box.color2, false)} title="Solid Color">
                              <div className="color-swatch" style={{ background: box.color, borderColor: box.color === '#ffffff' ? '#000000' : 'rgba(255,255,255,0.2)' }} />
                            </button>
                            <input type="color" value={box.color} onClick={() => updateBoxColor(box.id, box.color, box.color2, false)} onChange={(e) => updateBoxColor(box.id, e.target.value, box.color2, false)} title="Choose Solid Color" />
                          </div>

                          <div className="color-btn-wrapper">
                            <button className={box.isGradient ? 'active' : ''} onClick={() => updateBoxColor(box.id, box.color, box.color2, !box.isGradient)} title="Gradient">🌈</button>
                            {box.isGradient && (
                              <div className="dual-picker">
                                <input type="color" value={box.color} onChange={(e) => updateBoxColor(box.id, e.target.value, box.color2, true)} title="Gradient Start Color" />
                                <input type="color" value={box.color2 || '#7928ca'} onChange={(e) => updateBoxColor(box.id, box.color, e.target.value, true)} title="Gradient End Color" />
                              </div>
                            )}
                          </div>

                          <div className="color-btn-wrapper">
                            <button className={box.outline ? 'active' : ''} onClick={() => updateBoxOutline(box.id, !box.outline)} title="Toggle Outline">🔲</button>
                            {box.outline && (
                              <div className="floating-picker">
                                <div className="color-swatch-sm" style={{ backgroundColor: box.outlineColor }} />
                                <input type="color" value={box.outlineColor} onChange={(e) => updateBoxOutline(box.id, true, e.target.value)} title="Outline Color" />
                              </div>
                            )}
                          </div>

                          <div className="color-btn-wrapper">
                            <button className={box.shadow ? 'active' : ''} onClick={() => updateBoxShadow(box.id, !box.shadow)} title="Toggle Shadow">🌑</button>
                            {box.shadow && (
                              <div className="floating-picker">
                                <div className="color-swatch-sm" style={{ backgroundColor: box.shadowColor }} />
                                <input type="color" value={box.shadowColor} onChange={(e) => updateBoxShadow(box.id, true, e.target.value)} title="Shadow Color" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="resize-handle" onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(box.id, e.clientX, e.clientY); }} onTouchStart={(e) => { e.stopPropagation(); handleResizeStart(box.id, e.touches[0].clientX, e.touches[0].clientY); }} />
                    {result.boxes.length > 1 && <button className="delete-box" onClick={() => removeBox(box.id)}>×</button>}
                  </div>
                ))}
                {result.imageBoxes.map((box) => (
                  <div key={box.id} id={`imgbox-${box.id}`} className="text-box-wrapper" style={{ transform: `translate(calc(-50% + ${box.x}px), calc(-50% + ${box.y}px))`, width: box.width, zIndex: activeBoxId === box.id ? 100 : 1 }}>
                    <img
                      src={box.src}
                      alt="Overlay"
                      className="editable-image"
                      style={{ cursor: activeBoxId === box.id ? 'grabbing' : 'grab' }}
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleDragStart(box.id, e.clientX, e.clientY); }}
                      onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); handleDragStart(box.id, e.touches[0].clientX, e.touches[0].clientY); }}
                      onClick={() => setSelectedImageBoxId(prev => prev === box.id ? null : box.id)}
                      onDoubleClick={() => triggerReplaceImage(box.id)}
                    />
                    <div className="resize-handle" onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(box.id, e.clientX, e.clientY); }} onTouchStart={(e) => { e.stopPropagation(); handleResizeStart(box.id, e.touches[0].clientX, e.touches[0].clientY); }} />
                    <button className="delete-box" onClick={() => removeBox(box.id)}>×</button>
                    {/* Replace image button — bottom-left corner */}
                    <button
                      className={`replace-image-btn${selectedImageBoxId === box.id ? ' selected' : ''}`}
                      onClick={() => triggerReplaceImage(box.id)}
                      title="Replace image"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                        <circle cx="12" cy="13" r="4"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {result.postBody && (
              <div className="post-body-container">
                <div className="post-body-header"><span className="control-label">Post Caption</span><button className="copy-btn" onClick={() => { navigator.clipboard.writeText(result.postBody || ''); setToast('Copied to clipboard!'); }}>Copy</button></div>
                <p className="post-body-text" contentEditable suppressContentEditableWarning onBlur={(e) => setResult(prev => prev ? { ...prev, postBody: e.currentTarget.innerText } : null)}>
                  {(result.postBody || "Write your caption here...").split(' ').map((word, i) => word.startsWith('#') ? <span key={i} className="hashtag" contentEditable={false}>{word} </span> : word + ' ')}
                </p>
              </div>
            )}
            <button className="download-hint" onClick={handleDownloadPNG}>Download PNG</button>
          </div>
        )}
      </div>
      
      <section className="features-section">
        <h2>Why use simp.ad?</h2>
        <div className="features-grid">
          <div className="feature-card">
            <h3>🚀 Instant AI Ad Maker</h3>
            <p>Generate professional ad copy and visuals in seconds. Our <strong>AI Ad Maker</strong> does the heavy lifting so you can focus on your business.</p>
          </div>
          <div className="feature-card">
            <h3>💸 100% Free Online</h3>
            <p>No credit card required. simp.ad is a completely <strong>free AI ad generator</strong> that lets you create unlimited ads without watermarks.</p>
          </div>
          <div className="feature-card">
            <h3>📱 Multi-Platform Ready</h3>
            <p>Resize instantly for Instagram, Facebook, TikTok, and more. The perfect <strong>social media ad maker</strong> for modern creators.</p>
          </div>
        </div>
      </section>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

export default App;
