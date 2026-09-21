-- Private host↔player game threads. thread_with_id is the non-host player.
alter table game_message
  add column if not exists thread_with_id text;

create index if not exists game_message_thread_idx
  on game_message (game_id, thread_with_id, created_at);
