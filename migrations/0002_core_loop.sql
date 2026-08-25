-- Upset City core competitive loop.
-- Additive. Does not alter 0001_auth.sql tables/columns.

create table if not exists player (
  id text primary key,
  user_id text unique references "user" ("id") on delete cascade,
  name text not null,
  handle text not null,
  city text not null default 'Austin',
  height_in integer not null default 72,
  weight_lb integer not null default 180,
  experience_years integer not null default 0,
  rating double precision not null default 1500,
  games_played integer not null default 0,
  sportsmanship double precision not null default 5,
  reliability double precision not null default 5,
  wins integer not null default 0,
  losses integer not null default 0,
  streak integer not null default 0,
  home_court_id text,
  availability text not null default 'available'
    check (availability in ('available', 'busy', 'offline')),
  bio text,
  hue integer not null default 24,
  photo_url text,
  neighborhood text,
  age integer,
  gender text,
  ethnicity text,
  open_to_challenges boolean not null default true,
  hide_from_catalog boolean not null default false,
  dm_privacy text not null default 'everyone'
    check (dm_privacy in ('everyone', 'played', 'nobody')),
  points_scored integer not null default 0,
  points_allowed integer not null default 0,
  weekly_wins integer not null default 0,
  weekly_losses integer not null default 0,
  rating_last_week double precision not null default 1500,
  rank_last_week integer not null default 0,
  preferred_hour integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists player_rating_idx on player (rating desc, games_played desc, wins desc, id);
create index if not exists player_user_id_idx on player (user_id);

create table if not exists game (
  id text primary key,
  kind text not null default 'broadcast'
    check (kind in ('broadcast', 'challenge', 'invite')),
  format text not null default '1v1'
    check (format in ('1v1', 'horse')),
  host_id text not null references player (id),
  opponent_id text references player (id),
  court_id text not null,
  court_name text not null,
  lat double precision not null,
  lon double precision not null,
  preferred_at timestamptz not null,
  scheduled_at timestamptz,
  accepted_at timestamptz,
  status text not null default 'open'
    check (status in (
      'open', 'matched', 'scheduled', 'played_pending',
      'confirmed', 'disputed', 'cancelled', 'no_show'
    )),
  notes text,
  host_bringing_ball boolean,
  opponent_bringing_ball boolean,
  invite_only boolean not null default false,
  allow_guest_invites boolean not null default false,
  scores_json text,
  score_entered_by text references player (id),
  score_confirmed_by text references player (id),
  rating_delta_host double precision,
  rating_delta_opp double precision,
  from_hoop_match_id text,
  cancelled_by text,
  cancel_reason text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (host_id <> opponent_id)
);

create index if not exists game_status_when_idx on game (status, preferred_at);
create index if not exists game_host_idx on game (host_id);
create index if not exists game_opponent_idx on game (opponent_id);
create index if not exists game_court_idx on game (court_id);

create table if not exists game_invite (
  game_id text not null references game (id) on delete cascade,
  player_id text not null references player (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (game_id, player_id)
);

create table if not exists game_message (
  id text primary key,
  game_id text not null references game (id) on delete cascade,
  author_id text references player (id),
  author_name text not null,
  body text not null,
  system boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists game_message_game_idx on game_message (game_id, created_at);

create table if not exists rating_event (
  id text primary key,
  game_id text not null unique references game (id),
  host_id text not null,
  opponent_id text not null,
  host_rating_before double precision not null,
  host_rating_after double precision not null,
  opponent_rating_before double precision not null,
  opponent_rating_after double precision not null,
  host_delta double precision not null,
  opponent_delta double precision not null,
  actual_a double precision not null,
  expected_a double precision not null,
  scores_json text not null,
  created_at timestamptz not null default now()
);

create table if not exists player_availability (
  player_id text primary key references player (id) on delete cascade,
  status text not null default 'available'
    check (status in ('available', 'busy', 'offline')),
  preferred_hour integer,
  note text,
  updated_at timestamptz not null default now()
);

create table if not exists match_decision (
  actor_id text not null references player (id) on delete cascade,
  target_id text not null references player (id) on delete cascade,
  decision text not null check (decision in ('like', 'pass')),
  created_at timestamptz not null default now(),
  primary key (actor_id, target_id),
  check (actor_id <> target_id)
);

create table if not exists match_connection (
  id text primary key,
  player_a_id text not null references player (id) on delete cascade,
  player_b_id text not null references player (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (player_a_id, player_b_id),
  check (player_a_id < player_b_id)
);

create table if not exists challenge (
  id text primary key,
  from_id text not null references player (id),
  to_id text not null references player (id),
  game_id text references game (id),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  court_id text,
  court_name text,
  lat double precision,
  lon double precision,
  preferred_at timestamptz,
  message text,
  created_at timestamptz not null default now(),
  check (from_id <> to_id)
);

create index if not exists challenge_to_idx on challenge (to_id, status);

create table if not exists player_block (
  actor_id text not null references player (id) on delete cascade,
  target_id text not null references player (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (actor_id, target_id),
  check (actor_id <> target_id)
);

create table if not exists player_report (
  id text primary key,
  actor_id text not null references player (id),
  target_id text not null references player (id),
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists score_dispute (
  id text primary key,
  game_id text not null references game (id) on delete cascade,
  opened_by text not null references player (id),
  reason text,
  status text not null default 'open'
    check (status in ('open', 'resolved', 'withdrawn')),
  created_at timestamptz not null default now()
);

create index if not exists score_dispute_game_idx on score_dispute (game_id, status);
