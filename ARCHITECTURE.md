# Architecture — Lighting Distinctions Image Pipeline

Technical reference for the full system. Covers the pipeline, data flow, external services, database schema, storage layout, API contracts, and every source file.

---

## System overview

Single Next.js 16 application deployed on Vercel. No separate backend. Three external services:

```
┌─────────────────────────────────────────────────┐
│  Next.js 16 App (Vercel)                        │
│                                                 │
│  UI Pages          API Routes                   │
│  /                 POST /api/upload              │
│  /capture          POST /api/generate            │
│  /annotate/[id]    GET  /api/job/[id]            │
│  /processing/[..]  GET  /api/sessions            │
│  /result/[..]      PATCH/DELETE /api/sessions/[id]│
│  /history          POST /api/regenerate/[id]     │
│                    GET  /api/health              │
└────────┬──────────────┬──────────────┬───────────┘
         │              │              │
         ▼              ▼              ▼
   ┌──────────┐  ┌────────────┐  ┌──────────────┐
   │ Supabase │  │ Anthropic  │  │ Google       │
   │          │  │ Claude     │  │ Gemini 2.5   │
   │ Postgres │  │ Haiku 4.5  │  │ Flash Image  │
   │ Storage  │  │            │  │              │
   └──────────┘  └────────────┘  └──────────────┘
```

---

## Pipeline: end-to-end generation flow

This is the critical path — what happens when the installer taps "Generate":

```
1. CLIENT: Flatten image + SVG strokes → PNG blob
2. CLIENT: POST /api/generate (FormData: annotatedImage, sessionId, strokes JSON, notes)
3. SERVER (synchronous, before response):
   a. Upload annotated PNG → Supabase Storage (annotated/{sessionId}/{genId}.png)
   b. Save strokes JSON to sessions.strokes_json
   c. Insert generations row (status='pending')
   d. Return { generationId } immediately (HTTP 200)
4. SERVER (inside after() — runs after response is sent):
   a. Update generation status → 'processing'
   b. Count strokes by tool type: { pathway: N, roofline: N, accent: N }
   c. PROMPT FUSION: Call Claude Haiku 4.5
      - System message: master prompt (cached via cache_control.ephemeral)
      - User message: stroke counts + installer notes
      - Response: JSON { finalPrompt, reasoning }
      - Save reasoning to generations.fusion_log
   d. IMAGE GENERATION: Call Gemini 2.5 Flash Image
      - Input: fused prompt text + annotated PNG as inlineData
      - Config: responseModalities = ["TEXT", "IMAGE"]
      - Response: inline image bytes in candidates[0].content.parts
   e. Upload result PNG → Supabase Storage (results/{sessionId}/{genId}.png)
   f. Update generation: status='complete', result_url=public URL
   g. On any error: status='failed', error=message
5. CLIENT: Polls GET /api/job/{genId} every 2 seconds
6. CLIENT: On status='complete', redirect to /result/{sessionId}/{genId}
```

Total latency: ~15-20 seconds (1s fusion + 5-10s Gemini + upload overhead).

### Why `after()`?

`after()` from `next/server` schedules work after the HTTP response is sent. This lets the POST return `{ generationId }` immediately while the pipeline runs asynchronously. On Vercel, `after()` delegates to `waitUntil()` which extends the function lifetime. Requires Vercel Pro (60s limit) since Hobby caps at 10s.

---

## Prompt fusion architecture

Two-stage prompting:

**Stage 1 — Claude Haiku writes the prompt:**

The master prompt (`src/lib/prompts/master-prompt.ts`) is a system message that teaches Claude the annotation color code, image generation rules, and output format. It's sent with `cache_control: { type: 'ephemeral' }` for Anthropic's prompt caching — subsequent calls within 5 minutes reuse the cached system block (~50% latency reduction).

The user message contains:
- Stroke counts per tool (e.g. "3 pathway line(s) drawn in blue, 1 roofline line(s) drawn in amber")
- Installer's free-text notes if provided (e.g. "backyard with pool and fountain")

Claude returns a JSON object:
```json
{
  "finalPrompt": "the prompt for Gemini",
  "reasoning": "brief explanation of choices"
}
```

**Stage 2 — Gemini generates the image:**

The `finalPrompt` from Claude + the annotated PNG are sent to Gemini as a multimodal `generateContent` call. Gemini sees the image with colored marks and follows the text instructions to produce an edited version with realistic lighting added.

### Tuning the output

Three levers to improve generation quality:

1. **Master prompt** (`src/lib/prompts/master-prompt.ts`) — rules, style, constraints for Claude
2. **User message template** (`buildUserMessage()` in same file) — how counts/notes are formatted
3. **Gemini config** (`src/lib/image-pipeline.ts`) — responseModalities, any imageConfig options

Check `generations.fusion_log` in Supabase to see exactly what prompt Gemini received for each generation.

---

## Database schema

### `sessions` table

```sql
id            UUID PK (auto-generated)
label         TEXT NULL              -- user-assigned label (e.g. "123 Oak St")
original_url  TEXT NOT NULL          -- public URL of original photo in Supabase Storage
strokes_json  JSONB NULL            -- array of Stroke objects, saved on generate
created_at    TIMESTAMPTZ           -- auto
updated_at    TIMESTAMPTZ           -- auto-updated via trigger
```

### `generations` table

```sql
id             UUID PK (auto-generated)
session_id     UUID FK → sessions(id) ON DELETE CASCADE
status         TEXT NOT NULL         -- 'pending' | 'processing' | 'complete' | 'failed'
annotated_url  TEXT NULL             -- public URL of annotated PNG
result_url     TEXT NULL             -- public URL of AI-generated result
fusion_log     TEXT NULL             -- Claude's reasoning + the fused prompt
error          TEXT NULL             -- error message if failed
attempts       INT DEFAULT 0        -- number of pipeline runs
created_at     TIMESTAMPTZ
updated_at     TIMESTAMPTZ          -- auto-updated via trigger
```

One session can have many generations (regenerate creates new rows). RLS is enabled with no policies — the service key bypasses RLS, anon key gets zero access.

### Indexes

- `sessions_created_at_idx` — descending, for home page and history queries
- `generations_session_id_idx` — FK lookups
- `generations_status_idx` — polling queries

---

## Supabase Storage layout

Three public-read buckets. All writes go through the service key in API routes.

```
originals/
  {sessionId}/photo.jpg          -- resized original (max 2048px, JPEG q=0.85)

annotated/
  {sessionId}/{genId}.png        -- flattened image + annotation strokes

results/
  {sessionId}/{genId}.png        -- AI-generated result from Gemini
```

---

## API routes

### `POST /api/upload`

Upload a captured photo and create a session.

- **Input:** `multipart/form-data` with `image` field (JPEG blob)
- **Process:** Create session row, upload to `originals/{sessionId}/photo.jpg`
- **Response:** `{ sessionId: string, originalUrl: string }`

### `POST /api/generate`

Submit an annotated image for AI processing.

- **Input:** `multipart/form-data` with:
  - `annotatedImage` — flattened PNG blob
  - `sessionId` — UUID string
  - `strokes` — JSON string of Stroke[]
  - `notes` — optional string
- **Process:** Upload annotated PNG, save strokes, create generation row, kick off pipeline via `after()`
- **Response:** `{ generationId: string }`

### `GET /api/job/[genId]`

Poll generation status.

- **Response:** `{ generationId, status, resultUrl?, error? }`

### `POST /api/regenerate/[sessionId]`

Re-run the pipeline with existing annotations.

- **Process:** Fetch last generation's annotated image + session strokes, create new generation row, re-run fusion + Gemini via `after()`
- **Response:** `{ generationId: string }`

### `GET /api/sessions`

List all sessions with their latest completed generation.

- **Response:** `{ sessions: [{ id, label, originalUrl, resultUrl, genId, createdAt }] }`

### `PATCH /api/sessions/[sessionId]`

Update session label.

- **Input:** `{ label: string | null }`
- **Response:** `{ ok: true }`

### `DELETE /api/sessions/[sessionId]`

Delete a session, all generations (FK cascade), and all storage objects across all three buckets.

- **Response:** `{ ok: true }`

### `GET /api/health`

Readiness probe. Checks Supabase connectivity (live query), Anthropic and Gemini key presence.

- **Response:** `{ ok: boolean, services: { supabase, anthropic, gemini, geminiModel } }`

---

## Annotation tool system

### Tools

| Tool | Color | Shape | Stored as | Passed to fusion |
|---|---|---|---|---|
| Pathway | `#3b82f6` (blue) | Freehand line | `LineStroke` | Yes — count |
| Roofline | `#f59e0b` (amber) | Freehand line | `LineStroke` | Yes — count |
| Accent | `#ef4444` (red) | X mark | `AccentMark` | Yes — count |
| Eraser | `#9ca3af` (gray) | Radius remove | N/A | No |

### Stroke types (from `src/lib/types.ts`)

```typescript
LineStroke = {
  id: string;           // crypto.randomUUID()
  tool: 'pathway' | 'roofline';
  color: string;        // hex color
  width: number;        // stroke thickness (2-20)
  points: [number, number][];  // normalized 0-1 ratios
}

AccentMark = {
  id: string;
  tool: 'accent';
  color: string;
  position: [number, number];  // normalized 0-1 ratio
  size: number;                // stroke weight at creation time
}
```

### Coordinate system

All points are stored as ratios (0–1) relative to the natural image dimensions. This makes them resolution-independent — the same stroke data renders correctly regardless of screen size or image resolution. Conversion happens at render time: `pixelX = ratio * imgNaturalWidth`.

### Canvas rendering

- **Image:** `<img>` element with `object-contain` fills the container
- **SVG overlay:** positioned to exactly match the rendered image bounds (not the container), using computed offset/size from `updateRenderedRect()`
- **Strokes:** rendered via `perfect-freehand` library (getStroke → SVG path), producing smooth pressure-sensitive outlines
- **Flatten for export:** `flattenCanvasToBlob()` draws the `<img>` onto a `<canvas>`, then serializes + draws the SVG on top, exports as PNG

---

## File map

### Pages (`src/app/`)

| File | Type | Purpose |
|---|---|---|
| `layout.tsx` | Server | Root layout. Loads DM Serif Display + DM Sans fonts. Sets body classes. |
| `page.tsx` | Server | Home page. Fetches recent sessions from Supabase, renders brand header + "New capture" CTA + session grid. |
| `globals.css` | — | Tailwind v4 `@theme inline` tokens: cream, charcoal, accent, tool colors, font vars. |
| `capture/page.tsx` | Client | Camera/file picker. Resizes image client-side, uploads via `/api/upload`, redirects to annotate. |
| `annotate/[sessionId]/page.tsx` | Server | Fetches session from DB, passes `originalUrl` + `initialStrokes` to `AnnotationCanvas`. |
| `processing/[sessionId]/[genId]/page.tsx` | Client | Polls `/api/job/[genId]` every 2s. Shows spinner + stage labels. Redirects on complete, shows error on fail. |
| `result/[sessionId]/[genId]/page.tsx` | Server | Fetches session + generation, passes to `ResultView`. |
| `history/page.tsx` | Client | Fetches `/api/sessions`, renders grid with thumbnails, view/delete actions. |

### API Routes (`src/app/api/`)

| File | Method | Purpose |
|---|---|---|
| `upload/route.ts` | POST | Create session, upload original photo |
| `generate/route.ts` | POST | Upload annotated image, kick off pipeline via `after()` |
| `job/[genId]/route.ts` | GET | Poll generation status |
| `regenerate/[sessionId]/route.ts` | POST | Re-run pipeline with existing annotations |
| `sessions/route.ts` | GET | List all sessions with latest generation |
| `sessions/[sessionId]/route.ts` | PATCH, DELETE | Update label, delete session + storage |
| `health/route.ts` | GET | Service readiness probe |

### Components (`src/components/`)

| File | Purpose |
|---|---|
| `AnnotationCanvas.tsx` | Core annotation component. SVG overlay on image, `perfect-freehand` drawing, tool handling, undo/redo, coordinate normalization, flatten + generate. ~380 lines, highest complexity. |
| `Toolbar.tsx` | Floating bottom toolbar. Tool buttons, undo/redo/clear, thickness slider, notes toggle, legend toggle, collapse, back button. |
| `NotesPanel.tsx` | Collapsible textarea for installer's scene description. |
| `ResultView.tsx` | Before/after slider (`react-compare-slider`), label input, regenerate/download/edit actions. |

### Libraries (`src/lib/`)

| File | Purpose |
|---|---|
| `config.ts` | Lazy env var loader. `required(name)` throws if missing. `config.check()` returns service readiness flags without throwing. |
| `supabase.ts` | Cached server-side Supabase client using service role key. Single instance, lazy-initialized. |
| `anthropic.ts` | Cached Anthropic client. Exports `getAnthropic()` and `PROMPT_FUSION_MODEL` constant (`claude-haiku-4-5-20251001`). |
| `gemini.ts` | Cached GoogleGenAI client. Exports `getGemini()` and `getImageModel()` (reads `GEMINI_IMAGE_MODEL` env var). |
| `types.ts` | TypeScript types: `ToolKind`, `LineStroke`, `AccentMark`, `Stroke`, `StrokeCounts`, `GenerationStatus`, `SessionRow`, `GenerationRow`. |
| `image-utils.ts` | Client-side utilities: `resizeImage()` (OffscreenCanvas resize), `flattenCanvasToBlob()` (image+SVG→PNG), `getSvgPathFromStroke()` (perfect-freehand points→SVG path d). |
| `prompt-fusion.ts` | Calls Claude Haiku with master prompt + stroke counts + notes. Parses JSON response. Returns `{ finalPrompt, reasoning }`. |
| `image-pipeline.ts` | Calls Gemini `generateContent` with fused prompt + annotated PNG. Extracts inline image bytes from response. Throws `GeminiRefusalError` on safety blocks. |
| `prompts/master-prompt.ts` | Master prompt constant + `buildUserMessage()` helper. The master prompt teaches Claude the annotation color code, generation rules, and output format. |

### Other files

| File | Purpose |
|---|---|
| `AGENTS.md` | Project guide for AI agents. Stack, Next.js 16 gotchas, architecture, tool semantics, gotchas. |
| `PRD.md` | Original product requirements document. |
| `ARCHITECTURE.md` | This file. |
| `.env.example` | Template for all 6 required env vars. |
| `supabase/migrations/0001_init.sql` | Creates sessions + generations tables, indexes, updated_at triggers, RLS policies, storage buckets. |
| `public/icons/eraser.png` | Custom eraser icon (black outline, rendered white via CSS `filter: invert(1)`). |
| `next.config.ts` | Next.js config (currently empty/default). |
| `postcss.config.mjs` | PostCSS config for Tailwind v4 (`@tailwindcss/postcss`). |
| `tsconfig.json` | TypeScript config with `@/*` path alias to `./src/*`. |
| `eslint.config.mjs` | ESLint config (Next.js defaults). |

---

## Tailwind v4 design tokens

Defined in `src/app/globals.css` inside `@theme inline { ... }`. No `tailwind.config.ts` exists.

```
Surfaces:     cream, cream-muted, charcoal, charcoal-muted, canvas-bg
Brand accent: accent, accent-strong, accent-soft
Tool colors:  tool-pathway (#3b82f6), tool-roofline (#f59e0b), tool-accent (#ef4444)
Typography:   font-sans (DM Sans), font-serif (DM Serif Display)
```

Usage: `bg-cream`, `text-charcoal`, `border-accent`, `font-serif`, etc.

---

## Next.js 16 specifics

This project runs on Next.js 16.2.3, which has breaking changes vs. Next.js 14/15:

- **`params` is a `Promise`** — must `await params` in pages, layouts, and route handlers
- **`RouteContext<'/path/[id]'>`** — globally generated type helper, no import needed
- **`PageProps<'/path/[id]'>`** — same for pages
- **`after(callback)`** from `next/server` — stable, schedules work after response
- **Tailwind v4** — CSS-first config, no JS config file
- **Route handlers dynamic by default** — POST/PATCH/DELETE never cached

Consult `node_modules/next/dist/docs/` for version-matched documentation.

---

## Security notes

- `SUPABASE_SERVICE_KEY` is server-only — never exposed to the browser
- RLS is enabled on both tables with no policies — service key bypasses, anon key gets nothing
- No authentication — the app is open to anyone with the URL
- No rate limiting — add before public deployment (see open items in plan)
- Image uploads are stored in public Supabase buckets — URLs are guessable if you know the session/gen IDs
