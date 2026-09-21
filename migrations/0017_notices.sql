-- In-app alerts for DMs, invites, opponent lock-in, and score confirmation.
create table if not exists player_notice (
  id text primary key,
  player_id text not null references player (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  match_id text,
  from_player_id text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists player_notice_player_idx
  on player_notice (player_id, created_at desc);
