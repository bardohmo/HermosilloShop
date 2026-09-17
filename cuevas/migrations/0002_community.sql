-- Neighborhood membership + shared reports for Las Cuevas.

create table if not exists members (
  user_id text primary key,
  email text not null,
  display_name text not null default '',
  status text not null default 'pending',
  role text not null default 'neighbor',
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by text
);

create unique index if not exists members_email_lower_idx on members (lower(email));
create index if not exists members_status_idx on members (status);

create table if not exists reports (
  id text primary key,
  user_id text not null,
  type text not null,
  lat double precision not null,
  lng double precision not null,
  note text not null default '',
  author text not null,
  created_at timestamptz not null default now()
);

create index if not exists reports_created_at_idx on reports (created_at desc);
