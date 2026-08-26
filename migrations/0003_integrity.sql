-- Additive integrity for score submissions, invites, and blocks.
-- Does not alter 0001/0002 objects except ADD COLUMN / ADD INDEX.

alter table game
  add column if not exists score_submission_id text;

alter table game
  add column if not exists score_submitted_at timestamptz;

alter table game_invite
  add column if not exists status text not null default 'pending';

alter table challenge
  add column if not exists expires_at timestamptz;

create index if not exists game_invite_player_status_idx on game_invite (player_id, status);
