-- Replace Supabase Auth (GoTrue) with self-hosted email+password auth.
--
-- Why: this app already keeps its own `profiles` table and admin UI
-- (/admin/users) for role management, so Supabase Auth was only doing three
-- things — password storage, session cookies, and invite emails. Rolling
-- our own removes the Supabase Dashboard setup steps (email templates,
-- redirect URLs, disabling public signup) entirely.
--
-- New model: profiles.password_hash holds a bcrypt hash; a `sessions` row
-- backs each signed-in browser session (see src/lib/auth/session.ts). There
-- is no self-service invite/reset email — an admin sets a new user's
-- initial password directly from /admin/users, and resets a forgotten one
-- the same way (which also revokes that user's existing sessions).

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_auth_user();

alter table public.profiles
  drop constraint if exists profiles_id_fkey,
  alter column id set default gen_random_uuid(),
  add column password_hash text;

-- Case-insensitive uniqueness — login looks users up by lowercased email.
create unique index profiles_email_lower_idx on public.profiles (lower(email));

create table public.sessions (
  id text primary key, -- sha-256 hex digest of the session cookie's token; the raw token itself is never stored
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index sessions_user_idx on public.sessions (user_id);
create index sessions_expires_idx on public.sessions (expires_at);

alter table public.sessions enable row level security;
