# Lighting Distinctions — Image Pipeline Demo

Field tool for outdoor lighting installers. Photograph a yard on iPad, mark where lights go with labeled annotation tools, and get back an AI-generated render of the space with realistic lighting installed.

**Demo only.** No auth, no quoting, no CRM. Built by Torrey Labs (Shivaan Sood, Aaryan Agrawal) for Kevin at Lighting Distinctions.

---

## Quick links

- `ARCHITECTURE.md` — full technical architecture, pipeline details, file map
- `AGENTS.md` — project guide for AI coding agents (Claude Code, Cursor, etc.)
- `PRD.md` — original product requirements document
- `.env.example` — all required environment variables with source links

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript, React 19 |
| Styling | Tailwind v4 (CSS-first config via `@theme inline`) |
| Database + Storage | Supabase (Postgres + S3-compatible Storage) |
| Prompt Fusion | Anthropic Claude Haiku 4.5 |
| Image Generation | Google Gemini 2.5 Flash Image ("Nano Banana") |
| Deploy | Vercel |

---

## Setup

### Prerequisites

- Node.js 20+ (tested on 25.4)
- npm 10+
- Accounts: Supabase, Anthropic, Google AI Studio

### 1. Clone and install

```bash
git clone https://github.com/shivaan11/rapidQuote.git
cd rapidQuote
npm install
```

### 2. Supabase project

1. Create a project at https://supabase.com/dashboard (free tier works)
2. **Project Settings → API** — copy Project URL, anon key, service role key
3. **SQL Editor → New query** — paste and run `supabase/migrations/0001_init.sql`
4. **Storage** — confirm three public buckets exist: `originals`, `annotated`, `results`. Create manually if the migration didn't create them.

### 3. Anthropic API key

1. https://console.anthropic.com → Settings → API Keys → Create Key
2. Copy the `sk-ant-...` key
3. Add a few dollars credit (Haiku is ~$0.001/call)

### 4. Google Gemini API key

1. https://aistudio.google.com/apikey → Create API key
2. Ensure billing is enabled on the underlying GCP project (image generation is a paid feature, ~$0.039/image)

### 5. Environment variables

```bash
cp .env.example .env.local
```

Fill in all 6 values:

| Variable | Source |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_KEY` | Supabase → Project Settings → API (service role) |
| `ANTHROPIC_API_KEY` | Anthropic Console |
| `GEMINI_API_KEY` | Google AI Studio |
| `GEMINI_IMAGE_MODEL` | `gemini-3-pro-image-preview` (pinned — Nano Banana Pro) |
| `FAL_KEY` | fal.ai dashboard (optional — enables FLUX Kontext Pro backup if Gemini 5xxs) |
| `FAL_IMAGE_MODEL` | Defaults to `fal-ai/flux-pro/kontext` |

### 6. Run locally

```bash
npm run dev          # http://localhost:3000
```

Verify: http://localhost:3000/api/health should return `{ "ok": true, ... }`.

### 7. Deploy to Vercel

1. Push to GitHub
2. https://vercel.com/new → import the repo
3. Add all 6 env vars from `.env.local` (both Production and Preview)
4. Deploy — takes ~60s
5. **Important:** Vercel Hobby has a 10s function timeout. The pipeline takes ~15s. You need **Vercel Pro** ($20/month) for the 60s limit.

---

## How to use the app

### Screen 1: Home (`/`)

The landing page. Shows the "Lighting Distinctions x Torrey Labs" brand header, tagline, and a large **New capture** button. Below that, a grid of recent captures with result thumbnails — tap any to view the before/after result. A **View all** link goes to the full history page.

### Screen 2: Capture (`/capture`)

Dark full-screen page with a single **Open camera** button. On iPad Safari, this opens the native camera (rear-facing via `capture="environment"`). On desktop, it opens a file picker. The selected photo is resized client-side (max 2048px long edge, JPEG q=0.85) to reduce upload size from ~10MB to ~200KB, then uploaded to Supabase Storage via `POST /api/upload`. On success, redirects to the annotation screen.

**← back button** top-left returns to home.

### Screen 3: Annotate (`/annotate/[sessionId]`)

The core screen. The photo displays full-bleed on a dark background with an SVG overlay for drawing.

**Toolbar** (bottom, collapsible):
- **Pathway** (blue 〰️) — draw lines along walkways/edges for path lights
- **Roofline** (amber ⌇) — draw lines along roof edges for architectural lighting
- **Accent** (red ✕) — tap to place X marks for spot/uplights on trees, pillars, features
- **Eraser** (eraser icon) — drag over strokes to remove them
- **Undo / Redo / Clear** — full undo stack
- **✎ Notes** — toggles a text field for describing the scene (e.g. "backyard with pool and fountain")
- **? Legend** — shows what each tool means (open by default)
- **↓ Collapse** — hides the toolbar to see more of the image

**Thickness slider** appears above the toolbar for drawing tools — controls line width (2–20) or accent mark stroke weight (8–30).

**Hint banner** at the top prompts the user to describe the scene in the notes panel.

**Generate button** (bottom-right, amber) — disabled until at least one stroke exists. On tap: flattens the image + SVG strokes into a single PNG, uploads to Supabase, saves strokes as JSON on the session, creates a generation row, and kicks off the AI pipeline via `after()`. Redirects to the processing screen.

**← back button** top-left returns to capture to pick a new photo.

### Screen 4: Processing (`/processing/[sessionId]/[genId]`)

Full-screen dark loading state. Polls `GET /api/job/[genId]` every 2 seconds. Shows stage labels:
- "Preparing your image…" (pending)
- "Adding lights to your yard…" (processing)
- "Done! Redirecting…" (complete)

On **complete**: auto-redirects to the result page.
On **failed**: shows the error message with an **Edit annotations** button to go back and try again.

### Screen 5: Result (`/result/[sessionId]/[genId]`)

Before/after comparison using a drag slider (`react-compare-slider`). Drag left/right to reveal the original vs. the AI-rendered version.

**Actions:**
- **Label** — add a label to the session (e.g. "123 Oak St") for later reference
- **Edit annotations** — returns to the canvas with all strokes restored from the database
- **Regenerate** — creates a new generation with the same annotations, re-runs the full pipeline
- **Download** — saves the rendered image as a PNG

**← back button** returns to home.

### Screen 6: History (`/history`)

Grid of all past sessions. Each card shows the original photo alongside the result (or "No result" placeholder). Displays the label and date. Actions per card:
- **View** — opens the result page
- **Delete** — removes the session, all generations, and all storage objects (with confirmation dialog)

---

## Scripts

```bash
npm run dev        # Turbopack dev server, http://localhost:3000
npm run build      # Production build (TypeScript + route typegen)
npm run start      # Serve production build
npm run lint       # ESLint
```

---

## Environment variables

| Variable | Public? | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes (browser) | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes (browser) | Supabase anon key for client reads |
| `SUPABASE_SERVICE_KEY` | **No** (server only) | Supabase service role key — bypasses RLS |
| `ANTHROPIC_API_KEY` | No | Claude Haiku 4.5 for prompt fusion |
| `GEMINI_API_KEY` | No | Google Gemini for image generation (primary) |
| `GEMINI_IMAGE_MODEL` | No | Pinned model ID (e.g. `gemini-3-pro-image-preview`) |
| `FAL_KEY` | No | fal.ai key for backup FLUX Kontext Pro (used only if Gemini fails) |
| `FAL_IMAGE_MODEL` | No | fal.ai endpoint id, defaults to `fal-ai/flux-pro/kontext` |

**Never commit `.env.local` or expose `SUPABASE_SERVICE_KEY` to the browser.**

---

## Costs

| Service | Cost | Notes |
|---|---|---|
| Supabase | Free tier | 500MB DB, 1GB storage (~160 sessions) |
| Anthropic (Haiku) | ~$0.001/call | Prompt fusion, one call per generation |
| Gemini (Flash Image) | ~$0.039/image | One call per generation |
| Vercel | Free (Hobby) or $20/mo (Pro) | Pro needed for 60s function timeout |

At ~$0.04/generation, 100 demo generations cost ~$4.

---

## Known limitations

- **No authentication** — anyone with the URL can generate images and incur costs
- **No rate limiting** — add before sharing publicly
- **No pan/zoom on canvas** — v1 ships with direct drawing only
- **Vercel Hobby timeout** — 10s limit kills the ~15s pipeline; need Pro
- **Supabase free tier storage** — 1GB, ~160 sessions before full
- **Gemini can refuse** — safety filters may reject some images
