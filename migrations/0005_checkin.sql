-- Additive pregame check-in / no-show. Does not rewrite earlier migrations.

create table if not exists game_checkin (
  game_id text not null references game (id) on delete cascade,
  player_id text not null references player (id) on delete cascade,
  at timestamptz not null default now(),
  location_verified boolean not null default false,
  distance_m integer,
  primary key (game_id, player_id)
);

create table if not exists game_noshow (
  id text primary key,
  game_id text not null references game (id) on delete cascade,
  reporter_id text not null references player (id),
  accused_id text not null references player (id),
  status text not null default 'pending'
    check (status in ('pending', 'contested', 'verified', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (game_id, reporter_id)
);

create table if not exists reliability_event (
  id text primary key,
  player_id text not null references player (id) on delete cascade,
  game_id text,
  kind text not null,
  created_at timestamptz not null default now()
);

create index if not exists reliability_event_player_idx
  on reliability_event (player_id, created_at desc);
