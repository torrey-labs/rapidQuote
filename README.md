# Lighting Distinctions — Image Pipeline Demo

Field tool for outdoor lighting installers. Photograph a yard on iPad, mark where lights go with labeled tools, and get back an AI-generated render of the space with the lighting installed.

**This is a demo.** No auth, no quoting, no CRM. Built by Torrey Labs for Kevin at Lighting Distinctions.

- **Project context + architecture:** `AGENTS.md`
- **Product spec:** `PRD.md`
- **Full phased plan:** `/Users/shivaan/.claude/plans/typed-prancing-hoare.md`

---

## First-time setup

Everything the app needs lives behind an API key. This section walks you through provisioning each service and filling in `.env.local`.

### 1. Create the Supabase project

1. Go to <https://supabase.com/dashboard> and create a new free-tier project. Name it `lighting-distinctions`. Wait ~60 seconds for it to provision.
2. Once it's ready, open **Project Settings → API** and copy:
   - **Project URL** → paste into `NEXT_PUBLIC_SUPABASE_URL`
   - **`anon` public key** → paste into `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **`service_role` secret key** → paste into `SUPABASE_SERVICE_KEY` (server-only, never commit)
3. Open **SQL Editor → New query**, paste the full contents of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), and run it. You should see `Success. No rows returned.`
4. Open **Storage** and confirm three buckets exist: `originals`, `annotated`, `results`, all marked **public**. If the SQL didn't create them (depends on your Supabase permissions), create them manually: click **New bucket**, set the name exactly as listed, toggle **Public bucket** on, and save.

### 2. Get an Anthropic API key

1. Sign in at <https://console.anthropic.com>.
2. Go to **Settings → API Keys → Create Key**.
3. Name it `lighting-distinctions-dev`, copy the value, and paste into `ANTHROPIC_API_KEY` in `.env.local`. The key starts with `sk-ant-`.

### 3. Get a Google Gemini API key

1. Sign in at <https://aistudio.google.com/apikey>.
2. Click **Create API key** (you may need to create a Google Cloud project first — the Studio UI walks you through it).
3. Copy the key and paste into `GEMINI_API_KEY`.
4. Leave `GEMINI_IMAGE_MODEL` as `gemini-2.5-flash-image-preview` (pinned on purpose — upgrade explicitly).

### 4. Fill in `.env.local`

```bash
cp .env.example .env.local
# open .env.local and paste the values from steps 1–3
```

### 5. Run locally

```bash
npm install          # already done if you just ran the scaffold
npm run dev          # http://localhost:3000
```

Visit <http://localhost:3000/api/health> — you should see:

```json
{
  "ok": true,
  "services": {
    "supabase": "ok",
    "anthropic": "configured",
    "gemini": "configured",
    "geminiModel": "gemini-2.5-flash-image-preview"
  }
}
```

If any service reports `not_configured` or `error`, check the corresponding env var and the Supabase migration.

### 6. (Later) Deploy to Vercel

Not required for Phase 1. When ready:

1. Push this repo to GitHub.
2. At <https://vercel.com/new>, import the repo.
3. Framework preset auto-detects **Next.js**.
4. Add every variable from `.env.local` into **Environment Variables** (both Production and Preview).
5. Deploy. Vercel returns a preview URL.

---

## What's in this Phase 1 scaffold

| Path | Purpose |
|---|---|
| `src/app/layout.tsx` | Root layout, loads DM Serif Display + DM Sans via `next/font/google` |
| `src/app/page.tsx` | Home stub with "New capture" CTA and env-readiness pointer |
| `src/app/globals.css` | Tailwind v4 `@theme inline` brand tokens (cream, charcoal, accent, tool colors) |
| `src/app/api/health/route.ts` | GET `/api/health` — live Supabase probe + env readiness |
| `src/lib/config.ts` | Lazy env var loader with fail-fast |
| `src/lib/supabase.ts` | Server-only Supabase client (service key, lazy) |
| `src/lib/anthropic.ts` | Claude client + `PROMPT_FUSION_MODEL` constant |
| `src/lib/gemini.ts` | Google GenAI client + `getImageModel()` |
| `src/lib/types.ts` | `Stroke`, `SessionRow`, `GenerationRow`, tool kinds |
| `supabase/migrations/0001_init.sql` | `sessions` + `generations` tables, triggers, buckets |
| `.env.example` | All required env vars, documented |
| `AGENTS.md` | Project guide for Claude Code and other agents — read before coding |

Phase 2 (capture + annotation canvas), Phase 3 (prompt fusion + Gemini pipeline), Phase 4 (results + history), and Phase 5 (polish + deploy) layer on top.

---

## Scripts

```bash
npm run dev        # Turbopack dev server, http://localhost:3000
npm run build      # Production build (runs TypeScript + route typegen)
npm run start      # Serve the production build
npm run lint       # ESLint
```

---

## Next.js 16 note

This scaffold is on **Next.js 16** + **Tailwind v4**, not the Next.js 14 you may have in muscle memory. APIs differ — notably `params` is now a `Promise`, `RouteContext`/`PageProps`/`LayoutProps` are globally generated helpers, and Tailwind config lives in `globals.css` via `@theme inline`. Read `AGENTS.md` (the "Next.js 16 gotchas" section) before writing code, and consult `node_modules/next/dist/docs/` for anything version-specific.
