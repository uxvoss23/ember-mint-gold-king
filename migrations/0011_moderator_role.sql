-- Moderator is a player role, not only a hardcoded email.

alter table player
  add column if not exists role text not null default 'player';
