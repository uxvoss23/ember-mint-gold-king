-- Phase 7: profile completion marker. Age / gender / ethnicity / weight already
-- exist on player; this records that the player submitted them (defaults like
-- weight_lb=180 do not count as complete).

alter table player
  add column if not exists profile_completed_at timestamptz;

update player
   set profile_completed_at = coalesce(profile_completed_at, updated_at)
 where profile_completed_at is null
   and age is not null
   and gender is not null
   and ethnicity is not null
   and weight_lb is not null;

create index if not exists player_profile_completed_idx
  on player (profile_completed_at);
