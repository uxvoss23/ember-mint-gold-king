-- Broader reports (message / game / incident) on the existing player_report table.
alter table player_report
  add column if not exists kind text not null default 'player';

alter table player_report
  add column if not exists game_id text;

alter table player_report
  add column if not exists message_ref text;
