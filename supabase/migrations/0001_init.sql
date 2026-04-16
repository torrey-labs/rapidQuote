-- Lighting Distinctions — initial schema
-- Apply via Supabase SQL editor, or run through the Supabase CLI once the
-- project is linked. Idempotent.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- sessions: one per captured photo. Holds the original image and the raw
-- strokes JSON so "Edit Annotations" can rehydrate the canvas.
-- ---------------------------------------------------------------------------
create table if not exists public.sessions (
  id            uuid        primary key default gen_random_uuid(),
  label         text,
  original_url  text        not null,
  strokes_json  jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists sessions_created_at_idx
  on public.sessions (created_at desc);

-- ---------------------------------------------------------------------------
-- generations: one row per generation attempt. A session may have many
-- generations (regenerate creates new rows; we keep history for debugging).
-- ---------------------------------------------------------------------------
create table if not exists public.generations (
  id             uuid        primary key default gen_random_uuid(),
  session_id     uuid        not null references public.sessions(id) on delete cascade,
  status         text        not null default 'pending'
                 check (status in ('pending', 'processing', 'complete', 'failed')),
  annotated_url  text,
  result_url     text,
  fusion_log     text,
  error          text,
  attempts       int         not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists generations_session_id_idx
  on public.generations (session_id);

create index if not exists generations_status_idx
  on public.generations (status);

-- ---------------------------------------------------------------------------
-- updated_at triggers — keeps updated_at current on UPDATE.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sessions_set_updated_at on public.sessions;
create trigger sessions_set_updated_at
  before update on public.sessions
  for each row execute function public.set_updated_at();

drop trigger if exists generations_set_updated_at on public.generations;
create trigger generations_set_updated_at
  before update on public.generations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: the demo has no auth. All writes go through Next.js route handlers
-- using the service key, which bypasses RLS. Keep RLS enabled (Supabase
-- default) so the anon key cannot touch these tables even if leaked.
-- ---------------------------------------------------------------------------
alter table public.sessions    enable row level security;
alter table public.generations enable row level security;

-- No policies are created intentionally — service key bypasses RLS,
-- anon key gets zero access.

-- ---------------------------------------------------------------------------
-- Storage buckets. If this INSERT fails in your environment due to
-- permissions, create the three buckets manually in the Supabase dashboard
-- (Storage → New bucket, public = on) with these exact names.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('originals', 'originals', true),
  ('annotated', 'annotated', true),
  ('results',   'results',   true)
on conflict (id) do nothing;
