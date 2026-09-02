-- Friends and DMs persist across accounts.

create table if not exists player_friend (
  player_a_id text not null references player (id) on delete cascade,
  player_b_id text not null references player (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (player_a_id, player_b_id),
  check (player_a_id < player_b_id)
);
create index if not exists player_friend_b_idx on player_friend (player_b_id);

create table if not exists dm_thread (
  id text primary key,
  player_a_id text not null references player (id) on delete cascade,
  player_b_id text not null references player (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (player_a_id, player_b_id),
  check (player_a_id < player_b_id)
);

create table if not exists dm_message (
  id text primary key,
  thread_id text not null references dm_thread (id) on delete cascade,
  author_id text not null references player (id),
  author_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists dm_message_thread_idx on dm_message (thread_id, created_at);
