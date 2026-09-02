-- Admin court field/photo overrides (visible to every account).
-- Additive chat columns so court/time change proposals persist.

create table if not exists court_override (
  court_id text primary key,
  name text,
  address text,
  neighborhood text,
  notes text,
  surface text,
  hoops int,
  amenities jsonb,
  lights_hours text,
  hours text,
  preview_url text,
  gallery jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table game_message
  add column if not exists kind text;

alter table game_message
  add column if not exists payload jsonb;
