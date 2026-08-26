-- Additive moderation / discipline. Does not rewrite 0001–0003.

alter table player
  add column if not exists banned_at timestamptz;

alter table player
  add column if not exists suspended_until timestamptz;

alter table player
  add column if not exists warn_count integer not null default 0;

alter table score_dispute
  add column if not exists resolved_by text;

alter table score_dispute
  add column if not exists resolved_at timestamptz;

alter table score_dispute
  add column if not exists resolution text;

alter table player_report
  add column if not exists status text not null default 'open';

alter table player_report
  add column if not exists resolved_by text;

alter table player_report
  add column if not exists resolved_at timestamptz;

create table if not exists moderation_note (
  id text primary key,
  target_player_id text not null references player (id),
  game_id text references game (id),
  author_user_id text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists moderation_audit (
  id text primary key,
  actor_user_id text not null,
  action text not null,
  target_player_id text,
  game_id text,
  report_id text,
  dispute_id text,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists moderation_audit_created_idx on moderation_audit (created_at desc);
