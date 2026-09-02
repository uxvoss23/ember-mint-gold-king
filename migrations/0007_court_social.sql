-- Phase 1 product truth: court reviews, work orders, and hooping-now
-- persist in the database so they survive refresh and show across accounts.

create table if not exists court_review (
  id text primary key,
  court_id text not null,
  author_id text not null references player(id),
  author_name text not null,
  rating int not null check (rating between 1 and 5),
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists court_review_court_idx on court_review (court_id, created_at desc);

create table if not exists work_order (
  id text primary key,
  court_id text not null,
  court_name text,
  kind text not null,
  detail text,
  status text not null default 'submitted',
  reporter_id text references player(id),
  reporter_name text,
  photo_url text,
  photos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists work_order_status_idx on work_order (status, created_at desc);
create index if not exists work_order_court_idx on work_order (court_id);

create table if not exists hoop_checkin (
  id text primary key,
  court_id text not null,
  court_name text,
  author_id text not null references player(id),
  author_name text not null,
  photo_url text not null,
  created_at timestamptz not null default now()
);
create index if not exists hoop_checkin_court_idx on hoop_checkin (court_id, created_at desc);

create table if not exists hoop_verify (
  checkin_id text not null references hoop_checkin(id) on delete cascade,
  author_id text not null references player(id),
  author_name text not null,
  created_at timestamptz not null default now(),
  primary key (checkin_id, author_id)
);

create table if not exists hoop_chat (
  id text primary key,
  checkin_id text not null references hoop_checkin(id) on delete cascade,
  author_id text references player(id),
  author_name text not null,
  body text not null,
  photo_url text,
  system boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists hoop_chat_checkin_idx on hoop_chat (checkin_id, created_at);
