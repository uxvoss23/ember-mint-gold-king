-- Durable court photo blobs. court_override.preview_url / gallery store
-- `/api/court-photos/<id>` references, not data URLs.

create table if not exists court_photo (
  id text primary key,
  court_id text not null,
  mime text not null,
  bytes bytea not null,
  created_at timestamptz not null default now()
);
