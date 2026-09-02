-- Durable Overpass / court-search cache so cold starts don't hammer public APIs.

create table if not exists court_search_cache (
  cache_key text primary key,
  courts_json jsonb not null,
  fetched_at timestamptz not null default now()
);
