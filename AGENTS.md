<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Lighting Distinctions — Image Pipeline Demo

Mobile-first web app for an outdoor lighting installer. Installer photographs a client's yard on iPad, annotates where lights should go with labeled tools, and gets back an AI-generated render of the space with realistic lighting added.

**Demo only.** No auth, no CRM, no quoting, no billing. See `PRD.md` for the full non-goals list.

**Client:** Lighting Distinctions (Kevin)
**Built by:** Torrey Labs (Shivaan Sood, Aaryan Agrawal)
**Plan:** `/Users/shivaan/.claude/plans/typed-prancing-hoare.md` (full phased plan — read before starting new work)

---

## Stack (as installed — verify with `package.json`)

| Layer | Choice |
|---|---|
| Framework | **Next.js 16** (App Router) — `node_modules/next/dist/docs/` is the source of truth for APIs |
| Language | TypeScript, React 19 |
| Styling | **Tailwind v4** — CSS-first config via `@theme inline` in `src/app/globals.css`, **no** `tailwind.config.ts` |
| Data + storage | Supabase (Postgres + S3-compatible Storage) via `@supabase/supabase-js` |
| Prompt fusion | Anthropic Claude Haiku 4.5 via `@anthropic-ai/sdk` |
| Image generation | Google Gemini 2.5 Flash Image ("Nano Banana") via `@google/genai` |
| Deploy | Vercel (single deploy target, no separate backend) |

---

## Next.js 16 gotchas vs. training data

These are the breaking changes you're most likely to trip over. Verify against the bundled docs before each change.

- **`params` is a `Promise`** in pages, layouts, and route handlers. You must `await params` before destructuring.
  ```ts
  export async function GET(req: Request, ctx: RouteContext<'/api/job/[genId]'>) {
    const { genId } = await ctx.params;
  }
  ```
- **`RouteContext<'/route/[id]'>`, `PageProps<'/route/[id]'>`, `LayoutProps<'/route/[id]'>` are globally available types** — generated during `next dev` / `next build` / `next typegen`. No import needed. Use them instead of hand-rolling `{ params: Promise<{ id: string }> }` types.
- **`after(callback)`** from `next/server` is stable. Use it inside route handlers to schedule async work after the response is sent — this is how `/api/generate` kicks off the pipeline without blocking the HTTP response. On Vercel, `after` delegates to `waitUntil()` automatically.
- **Route handlers are dynamic by default.** POST/PUT/DELETE/PATCH are never cached. GET can opt into caching via `export const dynamic = 'force-static'` or the new `use cache` directive — don't cache our GETs that hit Supabase.
- **Tailwind v4** has no JS/TS config file. Define tokens in `src/app/globals.css` inside `@theme inline { ... }`. Tokens like `--color-accent` become utility classes `bg-accent`, `text-accent`, etc. The existing `globals.css` is already using this pattern.
- **`connection()` from `next/server`** opts a server component into dynamic rendering when you need to read runtime env vars inside a server component. Route handlers don't need this.
- **`/src` + env vars:** `.env.local` and friends still live in the **project root**, not inside `src/`. Next.js only reads env files from the parent of `src/`.

**Before writing anything Next-specific, open the relevant doc:**

| Task | Doc path |
|---|---|
| Route handlers | `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` + `.../03-api-reference/03-file-conventions/route.md` |
| Dynamic segments | `.../03-api-reference/03-file-conventions/dynamic-routes.md` |
| `after()` | `.../03-api-reference/04-functions/after.md` |
| Fonts | `.../01-getting-started/13-fonts.md` |
| Env vars | `.../02-guides/environment-variables.md` |
| Server/client components | `.../01-getting-started/05-server-and-client-components.md` |
| Fetching / mutating data | `.../01-getting-started/06-fetching-data.md`, `.../07-mutating-data.md` |
| Caching | `.../01-getting-started/08-caching.md`, `.../02-guides/caching-without-cache-components.md` |

---

## Run locally

```
npm install
cp .env.example .env.local   # fill in real keys once accounts exist
npm run dev                  # http://localhost:3000
```

### Required env vars

| Var | Purpose | Source |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (browser & server) | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (browser) | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (server only — never ship to client) | Supabase → Project Settings → API |
| `ANTHROPIC_API_KEY` | Claude Haiku for prompt fusion | https://console.anthropic.com/settings/keys |
| `GEMINI_API_KEY` | Google AI Studio key for Gemini image gen | https://aistudio.google.com/apikey |
| `GEMINI_IMAGE_MODEL` | Pinned model ID, e.g. `gemini-3-pro-image-preview` (Nano Banana Pro) | Set in `.env.local`, upgrade explicitly |

See `.env.example` for the full template. `/api/health` reports which services are configured.

---

## Architecture (short)

Single Next.js app. UI routes render pages; API routes orchestrate the pipeline:

```
capture → upload → annotate → generate → process → result
```

`POST /api/generate` is the core orchestration point and the only place that touches three external services in one request:

1. Store annotated PNG in Supabase Storage (`annotated/`)
2. Count strokes by tool type (pathway / roofline / accent) from the posted JSON
3. Claude Haiku fuses master prompt + counts + installer notes → final image prompt
   (prompt caching enabled on the master prompt block)
4. Call Gemini 2.5 Flash Image with fused prompt + annotated PNG
5. Gemini returns inline image bytes in a single HTTP call (no polling)
6. Upload result to Supabase Storage (`results/`), mark `generations` row `complete`

Run steps 2–6 inside `after()` so the POST returns `{ generationId }` immediately. Client polls `GET /api/job/[genId]` every 2s and redirects to `/result/[sessionId]/[genId]` on completion.

### Route map (planned, not all built)

| Route | Phase | Purpose |
|---|---|---|
| `/` | 1 | Home — logo, "New Capture" CTA, recent sessions |
| `/capture` | 2 | iPad file-picker camera entry |
| `/annotate/[sessionId]` | 2 | Full-bleed canvas with labeled tools |
| `/processing/[sessionId]/[genId]` | 3 | Loading state, polls job |
| `/result/[sessionId]/[genId]` | 4 | Before/after slider + actions |
| `/history` | 4 | Session gallery |
| `GET /api/health` | 1 | Env + Supabase readiness probe |
| `POST /api/upload` | 2 | Store original photo, create session |
| `POST /api/generate` | 3 | Store annotated PNG, kick off async pipeline |
| `GET /api/job/[genId]` | 3 | Poll generation status |
| `GET /api/sessions` | 4 | List sessions for history |
| `DELETE /api/sessions/[sessionId]` | 4 | Delete session + storage |

---

## Annotation tool semantics

> **Branch note:** `experiment/sticker-annotations` replaces the three-tool set below with a five-tool set (two lines + three fixture stickers). Merge back to `main` only after comparing Gemini results across several real photos. The table below describes the current **experimental** tool set.

The installer picks **labeled** tools from a toolbar. Lines encode lighting *styles* (continuous runs); stickers encode *fixture types* at discrete spots.

| Tool | Kind | Color / asset | Meaning in prompt fusion |
|---|---|---|---|
| Permanent | Line, 1–10px | `#f59e0b` (amber) | Permanent architectural roofline / eave lighting |
| Downlight | Sticker, 1–10% image width | `/stickers/downlight.png` | Eave/ceiling downlight fixture at that spot |
| Uplight | Sticker, 1–10% image width | `/stickers/uplight.png` | Ground uplight on tree/pillar at that spot |
| Pathlight | Sticker, 1–10% image width | `/stickers/pathlight.png` | Walkway-height path fixture at that spot |
| Eraser | Radius remove | — | (not passed to fusion) |

**Adding or changing tools requires updating ALL of:**

- `src/lib/types.ts` (ToolKind, Stroke union, StrokeCounts) — source of truth
- `src/components/Toolbar.tsx` (UI buttons + legend)
- `src/components/AnnotationCanvas.tsx` (placement + render logic)
- `src/lib/prompts/master-prompt.ts` (semantics in fused prompt)
- `src/app/api/generate/route.ts` AND `src/app/api/regenerate/[sessionId]/route.ts` (`countStrokes`)

If the five fall out of sync, Claude will describe tools the canvas doesn't have (or vice versa) and generations will degrade silently.

---

## Prompt fusion (Phase 3)

Master prompt lives in `src/lib/prompts/master-prompt.ts`. It is sent as a cached system block to Claude Haiku 4.5. The user message includes stroke counts per tool type and the installer's optional free-text notes. Claude returns a final image-model prompt as JSON:

```json
{ "finalPrompt": "...", "reasoning": "..." }
```

The `finalPrompt` is passed to Gemini alongside the annotated PNG. The `reasoning` is logged to `generations.fusion_log` for debugging.

Iterate the master prompt in that file and redeploy — no installer retraining needed.

---

## Data model (see `supabase/migrations/0001_init.sql`)

```
sessions
  id uuid PK
  label text NULL
  original_url text NOT NULL
  strokes_json jsonb NULL           -- rehydrated into canvas on "Edit Annotations"
  created_at timestamptz
  updated_at timestamptz

generations
  id uuid PK
  session_id uuid FK → sessions(id) ON DELETE CASCADE
  status text  -- pending | processing | complete | failed
  annotated_url text NULL
  result_url text NULL
  fusion_log text NULL               -- Claude's reasoning for the fused prompt
  error text NULL
  attempts int
  created_at timestamptz
  updated_at timestamptz
```

One session can have many generations (regenerate creates a new row). The `strokes_json` lives on `sessions` so "Edit Annotations" can rehydrate the canvas regardless of which generation you came from.

### Supabase Storage buckets

- `originals` — raw photos from iPad (after client-side resize)
- `annotated` — composite images with strokes flattened in (input to Gemini)
- `results` — AI-generated images (downloaded from Gemini, stored for durability)

All buckets public-read. Writes go through the server using the service key.

---

## Testing

Manual only. No automated tests. Full checklist in `PRD.md`.

Critical manual checks before shipping a change:

- Photo capture works on iPad Safari
- Drawing is responsive on all three line/spot tools
- Undo / redo / clear work reliably
- Canvas export produces a clean PNG with strokes visible
- Upload → generate → poll → result completes end-to-end in <20s
- Before/after slider is smooth
- Session history persists across reloads
- All tap targets ≥ 48px

---

## Non-goals (do not add without asking)

- Auth, login, user accounts
- Quote engine, pricing, PDF generation
- CRM integration (Jobber, Housecall Pro, HubSpot)
- Multi-tenancy
- Offline support
- Payment or billing
- Automated test suite
- Canvas pan/zoom (v1 ships with direct drawing only)

If Kevin asks for any of these, treat it as a v2 conversation and surface it before building.

---

## Gotchas (project-specific)

- **iPad Safari capture.** Use `<input type="file" accept="image/*" capture="environment">`. Do NOT use `getUserMedia` / `MediaDevices` — inconsistent on iPad.
- **Client-side resize before upload.** Raw iPad photos are 5–10MB. Resize to max 2048px long edge, JPEG q=0.85 before upload. See `src/lib/image-utils.ts` (Phase 2).
- **No pan/zoom on the canvas.** v1 ships with direct drawing only. Adding it is a multi-day effort because gesture handling fights with drawing on mobile Safari.
- **Gemini returns inline bytes.** No polling against Gemini itself — extract image bytes from the response candidates in `src/lib/image-pipeline.ts` (Phase 3).
- **Gemini can refuse.** Safety filters may reject some images. Treat refusals as a distinct error state with clearer copy, not a generic "generation failed."
- **Pin the Gemini model version.** `GEMINI_IMAGE_MODEL` is a specific version string, not a floating alias. Upgrade explicitly after validating.
- **Service key is server-only.** `SUPABASE_SERVICE_KEY` must never appear in client bundles or `NEXT_PUBLIC_*` vars. Keep all Supabase writes inside route handlers.
- **No rate limiting yet.** App is unauthenticated — anyone with the URL can burn Gemini credits (~$0.039 per generation). Add an IP-based limit or shared-secret gate before publishing a shareable URL. Tracked in the plan as an open item.

---

## Phases (current state)

Full phased plan lives at `/Users/shivaan/.claude/plans/typed-prancing-hoare.md`. Keep this checklist in sync with reality as phases ship.

- [x] **Phase 0 — AI model decision.** Closed: Gemini 2.5 Flash Image (Nano Banana) via `@google/genai`.
- [ ] **Phase 1 — Scaffold + accounts** (~1 day). Next.js 16 init, Supabase project, all env vars wired, `/api/health` green, Vercel preview deploy live.
- [ ] **Phase 2 — Capture → Annotate → Upload** (~2–3 days). Home page, iPad capture, client-side resize, annotation canvas with labeled tools, `POST /api/upload`.
- [ ] **Phase 3 — Prompt fusion + Gemini pipeline** (~2–3 days). Master prompt, Claude Haiku fusion, Gemini image call, `POST /api/generate`, `GET /api/job/[id]`, processing screen.
- [ ] **Phase 4 — Results, history, regeneration** (~1–2 days). Before/after slider, regenerate, edit annotations, session gallery, delete.
- [ ] **Phase 5 — Design polish + iPad testing + deploy** (~1–2 days). DM Serif Display + DM Sans, warm gold/amber tokens, error/empty states, real-iPad testing, Vercel production deploy.

Mark phases complete as they ship.
