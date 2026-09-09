-- Match Mode: who is looking, likes/passes, and availability.
-- Mutual likes are derived (A liked B and B liked A) — no extra table.

create table if not exists match_availability (
  player_id text primary key references player (id) on delete cascade,
  blocked_dates jsonb not null default '[]'::jsonb,
  time_bands jsonb not null default '[]'::jsonb,
  travel_radius_miles int not null default 10,
  note text,
  updated_at timestamptz not null default now()
);

create table if not exists match_swipe (
  actor_id text not null references player (id) on delete cascade,
  target_id text not null references player (id) on delete cascade,
  direction text not null check (direction in ('like', 'pass')),
  created_at timestamptz not null default now(),
  primary key (actor_id, target_id),
  check (actor_id <> target_id)
);
create index if not exists match_swipe_target_idx on match_swipe (target_id, direction);
