-- Application rate limits. Keyed by user id or a coarse IP hash.
create table if not exists rate_limit_hit (
  bucket text not null,
  subject text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, subject, window_start)
);

create index if not exists rate_limit_hit_window_idx
  on rate_limit_hit (window_start);
