-- Admin-only test users. Real auth users, tagged so they stay out of
-- production mail/analytics. Impersonation stores the admin session so
-- Return to Admin can restore it.

alter table player
  add column if not exists is_test_user boolean not null default false;

alter table player
  add column if not exists test_preset text;

create index if not exists player_is_test_user_idx
  on player (is_test_user)
  where is_test_user;

create table if not exists admin_impersonation (
  target_session_token text primary key,
  admin_user_id text not null,
  admin_session_token text not null,
  target_user_id text not null,
  created_at timestamptz not null default now()
);
