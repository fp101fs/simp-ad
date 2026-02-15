/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PEXELS_API_KEY: string
  readonly VITE_GEMINI_API_KEY: string
  readonly VITE_UNSPLASH_ACCESS_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}