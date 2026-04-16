# Lighting Distinctions — Image Pipeline Demo

## Overview

A mobile-first web app for **Lighting Distinctions**, an outdoor lighting installation company. Installers open the app on an iPad at a client's property, photograph the backyard, annotate the photos to indicate where lights should go, and an AI image pipeline returns a realistic render of the space *with lighting added*. This is a demo — not a quoting tool, not a CRM integration. Just the image pipeline, end to end.

**Client:** Lighting Distinctions (Kevin)
**Built by:** Torrey Labs (Aaryan Agrawal & Shivaan Sood)

---

## Architecture

```
┌─────────────────────┐       ┌─────────────────────┐
│   Frontend (Vercel)  │       │  Backend (Railway)   │
│   Next.js 14+ App    │◄─────►  Node.js / Express   │
│   App Router         │       │  API routes          │
└─────────┬───────────┘       └──────────┬──────────┘
          │                              │
          │         ┌────────────────────┤
          │         │                    │
          ▼         ▼                    ▼
   ┌─────────────────────┐    ┌──────────────────┐
   │   Supabase           │    │  Image Model API  │
   │   - Storage (images) │    │  (Replicate /     │
   │   - Postgres (jobs)  │    │   OpenAI / etc.)  │
   └─────────────────────┘    └──────────────────┘
```

| Layer | Technology | Hosting |
|-------|-----------|---------|
| Frontend | Next.js 14+ (App Router), TypeScript, Tailwind CSS | Vercel |
| Backend | Node.js + Express, TypeScript | Railway |
| Database | Supabase Postgres | Supabase |
| File Storage | Supabase Storage (S3-compatible) | Supabase |
| Image AI | Replicate API (SDXL inpainting or similar) | Replicate |
| Deployment | GitHub repo → Vercel (frontend), Railway (backend) | — |

---

## Why Supabase

Yes, this project needs Supabase:

1. **Image storage.** Three image states per session: original photo, annotated photo (with the installer's drawn marks), and AI-generated result. These need durable storage with public URLs for display.
2. **Job tracking.** The AI pipeline is asynchronous. A `jobs` table tracks status (`pending → processing → complete → failed`), stores references to all three images, and holds metadata (timestamps, prompt used, retry count).
3. **Session history.** Installers can revisit past sessions to show clients previous renders.

---

## User Flow

```
1. Installer opens app on iPad in Safari
2. Taps "New Capture" → camera opens (via <input capture> or camera API)
3. Photo is taken and displayed full-width on screen
4. Installer uses finger to annotate:
   - Draw lines along pathways, edges, or rooflines where lights should go
   - Tap X marks on specific spots for accent/uplighting (e.g., trees, pillars)
   - Undo / redo / clear controls
5. Installer taps "Generate" → annotated image is uploaded
6. Loading state with progress indication
7. AI-processed image returns — displayed side-by-side or toggle-able with the original
8. Installer can regenerate, adjust, or save
9. Saved results appear in a simple gallery/history view
```

---

## Screens

### 1. Home / Dashboard

- Logo and brand header
- "New Capture" CTA button (large, touch-friendly)
- Recent sessions grid (thumbnail of original → result, date, address label)
- Minimal — this is a field tool, not a back-office dashboard

### 2. Camera Capture

- Full-screen camera viewfinder or native file picker (use `<input type="file" accept="image/*" capture="environment">` for maximum iPad compatibility)
- After capture, transition to annotation screen

### 3. Annotation Canvas

This is the core screen. Requirements:

- **Full-bleed image display** — the photo fills the viewport
- **Touch drawing overlay** — HTML5 Canvas layered on top of the image
- **Drawing tools:**
  - **Freehand line** — default tool, for drawing along pathways/edges. Bright, visible stroke (yellow or green, ~4px) so it stands out against any backdrop.
  - **X marker** — tap to place an X at a point. Used for spot lights on trees, pillars, features. Each X should be a fixed-size icon, not freehand.
  - **Eraser** — removes strokes/markers in a radius
- **Controls (floating toolbar, bottom of screen):**
  - Tool selector (Line / X / Eraser)
  - Undo / Redo
  - Clear all
  - Color picker (optional, low priority — default bright yellow is fine)
  - Stroke width toggle (thin / medium / thick)
- **"Generate" button** — fixed at bottom, prominent. Disabled until at least one annotation exists.
- Canvas must support pinch-to-zoom and pan WITHOUT interfering with drawing. Consider a "move mode" toggle if simultaneous gesture handling is too complex.
- **Export:** When "Generate" is tapped, flatten the canvas + image into a single composite image (PNG) for upload.

### 4. Processing / Loading

- Full-screen or modal overlay
- Animated progress indicator
- Estimated time ("Usually takes 15–30 seconds")
- The installer is standing with a client — this needs to feel fast and polished, not janky

### 5. Result View

- **Before / After comparison:**
  - Slider overlay (drag a divider left/right to reveal original vs. generated)
  - OR tap to toggle between the two
- **Actions:**
  - "Save" — persists to session history
  - "Regenerate" — re-runs the pipeline (same annotations, new generation)
  - "Edit Annotations" — go back to canvas with existing marks
  - "Share" — copy link or download image
- Display the annotated version as a small thumbnail reference

### 6. Session History

- Grid of past sessions
- Each card: original thumbnail, result thumbnail, date, optional label
- Tap to open full result view
- Delete capability

---

## API Endpoints (Backend)

### `POST /api/upload`

Upload the original photo.

- **Input:** `multipart/form-data` with image file
- **Process:** Store in Supabase Storage under `originals/{sessionId}/{filename}`
- **Response:** `{ sessionId, originalUrl }`

### `POST /api/generate`

Submit annotated image for AI processing.

- **Input:** `{ sessionId, annotatedImage: base64 }` — the flattened canvas export
- **Process:**
  1. Store annotated image in Supabase Storage under `annotated/{sessionId}/{filename}`
  2. Create a job record in the `jobs` table with status `pending`
  3. Send the annotated image to the image model API with the lighting prompt
  4. On success: store result in `results/{sessionId}/{filename}`, update job to `complete`
  5. On failure: update job to `failed` with error info
- **Response:** `{ jobId }` (client polls for status)

### `GET /api/job/:jobId`

Poll job status.

- **Response:** `{ jobId, status, resultUrl?, error? }`

### `GET /api/sessions`

List all sessions for the gallery.

- **Response:** `[{ sessionId, originalUrl, resultUrl, createdAt, label? }]`

### `DELETE /api/session/:sessionId`

Delete a session and its associated images.

---

## Database Schema (Supabase Postgres)

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT,                          -- optional address or note
  original_url TEXT NOT NULL,
  annotated_url TEXT,
  result_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | processing | complete | failed
  prompt TEXT,
  error TEXT,
  attempts INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Supabase Storage Buckets

- `originals` — raw photos from iPad
- `annotated` — composite images with annotations baked in
- `results` — AI-generated images

All buckets: public read access (signed URLs optional for prod, but not needed for demo).

---

## AI Image Pipeline

### Model Selection

Use **Replicate** as the model host. Recommended models (test in order of preference):

1. **SDXL Inpainting** — treat the annotation marks as a mask/guide for where to add lighting
2. **ControlNet + SDXL** — use the annotated image as a ControlNet conditioning input (scribble or canny mode)
3. **Flux** variants on Replicate if SDXL results are insufficient

### Prompt Strategy

The prompt is critical. The annotations (lines and X marks) tell the model *where* to add light. The prompt tells it *what kind* of light.

**Base prompt (iterate on this):**

```
Photorealistic outdoor landscape lighting at dusk. Warm white LED path lights 
along walkways and garden edges. Accent uplighting on trees, architectural 
features, and pillars. Soft ambient glow. The lighting should look professionally 
installed — subtle, elegant, high-end residential. Do not change the structure 
of the house, landscaping, or hardscape. Only add lighting fixtures and their 
light effects. Maintain the exact composition and perspective of the original photo.
```

**Key prompt engineering notes:**
- Emphasize *do not alter the scene* — only add lights
- Reference "dusk" or "evening" to give the model context for light visibility
- The yellow/green annotation lines serve as spatial guides — the prompt should reference "along the marked paths" or similar if the model supports instruction-following
- This will take iteration. Store the prompt in an environment variable or config so it's easy to tweak without redeploying.

### Pipeline Steps

```
1. Receive annotated image (PNG, ~2-4MB)
2. Optionally resize to model's preferred input resolution (1024x1024 or similar)
3. POST to Replicate API with model, prompt, and image
4. Poll Replicate for completion (they return a prediction ID)
5. On completion, download result image
6. Store in Supabase Storage
7. Update job record
```

### Environment Variables (Backend)

```
REPLICATE_API_TOKEN=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
CORS_ORIGIN=https://your-frontend.vercel.app
PORT=3001
```

### Environment Variables (Frontend)

```
NEXT_PUBLIC_API_URL=https://your-backend.up.railway.app
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

---

## Design Direction

This is a field tool used by installers standing in a client's backyard. The design must be:

- **iPad-first.** Every tap target ≥ 48px. No hover-dependent interactions.
- **Fast and confident.** The client is watching. The app should feel premium — like the installer has serious technology behind them.
- **Dark UI for the annotation screen** — helps the photo pop and reduces glare outdoors.
- **Light/neutral UI for dashboard and results** — clean, professional.

### Brand Alignment

- Lighting Distinctions is a high-end outdoor lighting company
- Aesthetic: refined, warm, professional — think landscape architecture portfolio, not SaaS dashboard
- Primary accent: warm gold/amber (echoes the lighting itself)
- Typography: use a distinctive but readable display font (e.g., DM Serif Display for headings) paired with a clean sans-serif body (e.g., DM Sans)
- Avoid: neon colors, playful/rounded UI, anything that looks like a consumer app

### Key Design Moments

1. **Annotation canvas** — this is where the installer spends the most time. Make the tools intuitive, the image crisp, and the drawing responsive.
2. **Loading/processing** — the installer is standing with a homeowner. This screen needs to build confidence, not anxiety. Consider a subtle animation showing the image being "lit up" or a progress bar with stage labels.
3. **Before/after reveal** — this is the money shot. The client sees their own backyard with professional lighting. Make this dramatic — a smooth slider or a satisfying transition.

---

## Project Structure

```
lighting-distinctions/
├── frontend/                    # Next.js app (deployed to Vercel)
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx             # Dashboard / Home
│   │   ├── capture/
│   │   │   └── page.tsx         # Camera capture
│   │   ├── annotate/
│   │   │   └── page.tsx         # Annotation canvas
│   │   ├── processing/
│   │   │   └── page.tsx         # Loading state
│   │   ├── result/
│   │   │   └── page.tsx         # Before/after view
│   │   └── history/
│   │       └── page.tsx         # Session gallery
│   ├── components/
│   │   ├── AnnotationCanvas.tsx # Core canvas component
│   │   ├── BeforeAfterSlider.tsx
│   │   ├── SessionCard.tsx
│   │   ├── Toolbar.tsx
│   │   └── ...
│   ├── lib/
│   │   ├── api.ts               # Backend API client
│   │   └── supabase.ts          # Supabase client init
│   ├── public/
│   ├── tailwind.config.ts
│   ├── next.config.js
│   └── package.json
│
├── backend/                     # Express app (deployed to Railway)
│   ├── src/
│   │   ├── index.ts             # Express server entry
│   │   ├── routes/
│   │   │   ├── upload.ts
│   │   │   ├── generate.ts
│   │   │   ├── job.ts
│   │   │   └── sessions.ts
│   │   ├── services/
│   │   │   ├── replicate.ts     # Replicate API integration
│   │   │   └── supabase.ts      # Supabase storage + DB
│   │   └── config.ts            # Env vars, constants
│   ├── package.json
│   └── tsconfig.json
│
├── .github/
│   └── workflows/               # Optional CI
├── README.md
└── PRD.md                       # This file
```

---

## Non-Goals (Explicitly Out of Scope)

- **Real-time quote engine** — no pricing, no fixture counts, no tiers
- **Client quote document** — no PDF generation, no branded deliverables
- **CRM integration** — no Jobber, Housecall Pro, or HubSpot
- **User authentication** — this is a demo; no login, no user accounts
- **Multi-tenant** — single installer, single company
- **Offline support** — requires network for AI pipeline
- **Payment or billing** — none

---

## Implementation Order

Build in this sequence:

### Phase 1: Scaffolding
1. Init monorepo with `frontend/` and `backend/` directories
2. Set up Next.js 14 with App Router, TypeScript, Tailwind
3. Set up Express + TypeScript backend
4. Create Supabase project — tables, storage buckets
5. Wire up env vars, CORS, basic health check

### Phase 2: Capture + Annotation
6. Build camera capture screen (iPad file picker)
7. Build annotation canvas with touch drawing (this is the hardest UI piece)
   - Freehand line tool
   - X marker tool
   - Undo/redo stack
   - Canvas export to PNG
8. Upload original image to Supabase via backend

### Phase 3: AI Pipeline
9. Integrate Replicate API on backend
10. Build the generate endpoint — accept annotated image, call model, store result
11. Implement job polling on frontend
12. Build processing/loading screen

### Phase 4: Results + Polish
13. Build before/after comparison view
14. Build session history gallery
15. Design polish — typography, transitions, loading states
16. Test on actual iPad hardware
17. Deploy frontend to Vercel, backend to Railway

---

## Testing Checklist

- [ ] Photo capture works on iPad Safari
- [ ] Annotation drawing is responsive and doesn't lag on large images
- [ ] Pinch-to-zoom doesn't conflict with drawing (or mode toggle works)
- [ ] Canvas export produces a clean composite PNG
- [ ] Upload → generate → poll → result flow completes end-to-end
- [ ] AI-generated image actually shows realistic lighting (prompt iteration)
- [ ] Before/after slider is smooth and satisfying
- [ ] Session history persists and displays correctly
- [ ] App is usable in outdoor sunlight (contrast, dark annotation screen)
- [ ] All tap targets are ≥ 48px
- [ ] Loading states cover all async operations
