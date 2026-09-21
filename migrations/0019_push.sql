create table if not exists push_subscription (
  endpoint text primary key,
  player_id text not null references player (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscription_player_idx on push_subscription (player_id);
