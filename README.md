# simp.ad — AI Ad Maker

Generate Instagram-style ads from a text prompt in seconds.

Live at: [simp.ad](https://simp.ad)

---

## What It Does

Enter a text prompt, and simp.ad uses AI to generate an ad headline, caption, and matching stock photo. The result opens in a canvas editor where you can drag, resize, and edit text boxes and image overlays, then download as a PNG or share via a short link.

---

## Features

- **AI ad generation** — prompt → headline, caption, and stock photo via OpenRouter
- **Canvas editor** — drag/resize/edit text boxes and image overlays
- **One-level undo** for canvas edits
- **Platform selector** — Instagram, Facebook, Pinterest, TikTok, YouTube, X
- **Format selector** — square, portrait, landscape, story (per platform)
- **Background image search** — Unsplash (primary) / Pexels (fallback), plus local upload
- **Add text boxes and image overlays** to the canvas
- **Download as PNG** via html2canvas
- **Share links** — short `?ad=<id>` URL that restores ad state without re-generating
- **Google Sign-in** — unlocks higher rate limits
- **Rate limiting** — 1 ad/day (guest by IP), 100/day (signed-in user)
- **Image search rate limiting** — 10/day (guest), 100/day (signed-in)
- **Admin panel** — view last 100 generated ads (restricted by email)
- **Vercel Analytics** — built-in usage tracking

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript, Vite |
| Hosting | Vercel (serverless functions in `api/`) |
| AI | OpenRouter API (primary + fallback key), Google Gemini SDK |
| Images | Unsplash (primary), Pexels (fallback) |
| Auth | Google OAuth (`@react-oauth/google`) |
| Storage / Rate limiting | Redis (`node-redis`) |
| Export | `html2canvas` |

---

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/ad` | GET | Generate ad (AI headline/caption + stock image) |
| `/api/images` | GET | Paginated image search |
| `/api/share` | POST / GET | Store / retrieve shared ad state |
| `/api/admin-ads` | GET | List recent ads (admin auth required) |

---

## Environment Variables

Copy `.env.example` and fill in the following:

```env
OPENROUTER_API_KEY=           # Primary OpenRouter key
OPENROUTER_FALLBACK_API_KEY=  # Fallback key (paid model)
VITE_PEXELS_API_KEY=          # Pexels image search
VITE_GEMINI_API_KEY=          # Google Gemini (optional)
VITE_UNSPLASH_ACCESS_KEY=     # Unsplash (optional; Pexels used if absent)
REDIS_URL=                    # Redis connection string
VITE_ADMIN_EMAIL=             # Email address granted admin access
VITE_GOOGLE_CLIENT_ID=        # Google OAuth client ID
```

---

## Local Development

```bash
npm install
npm run dev
```

The app runs at `http://localhost:5173`. Serverless functions in `api/` are served by the Vite dev server via the Vercel CLI or a local proxy.
