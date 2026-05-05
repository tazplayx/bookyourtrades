-- ============================================================
-- BookYourTrades — Supabase Schema
-- Run this in the Supabase SQL Editor (supabase.com → SQL Editor → New Query)
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── PROVIDERS ────────────────────────────────────────────────
create table if not exists providers (
  id              text primary key default 'p' || extract(epoch from now())::bigint::text,
  company_name    text not null,
  trade_type      text not null,
  description     text default '',
  contact_name    text default '',
  email           text default '',
  phone           text default '',
  website         text default '',
  license_number  text default '',
  years_in_business text default '',
  service_areas   text[] default '{}',
  city            text default '',
  province        text default 'ON',
  rating          numeric(3,2) default 0,
  review_count    int default 0,
  certifications  text[] default '{}',
  featured        boolean default false,
  claimed         boolean default false,
  request_count   int default 0,
  status          text default 'pending' check (status in ('active','pending','pending_approval','suspended')),
  plan            text default 'free' check (plan in ('free','pro','enterprise')),
  logo_url        text default null,
  source          text default 'self-registered',
  profile_type    text default 'company',
  registered_at   timestamptz default now(),
  email_verified  boolean default false,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── USERS ────────────────────────────────────────────────────
create table if not exists users (
  id              text primary key default 'u' || extract(epoch from now())::bigint::text,
  email           text unique not null,
  password_hash   text not null,        -- bcrypt hash (never store plaintext)
  role            text default 'provider' check (role in ('admin','provider','client')),
  provider_id     text references providers(id) on delete set null,
  name            text default '',
  verified        boolean default false,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── BOOKINGS ─────────────────────────────────────────────────
create table if not exists bookings (
  id              text primary key default 'b' || extract(epoch from now())::bigint::text,
  provider_id     text references providers(id) on delete cascade,
  client_id       text references users(id) on delete cascade,
  client_name     text default '',
  client_email    text default '',
  client_phone    text default '',
  message         text default '',
  status          text default 'pending' check (status in ('pending','confirmed','completed','cancelled')),
  preferred_date  date,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── REVIEWS ──────────────────────────────────────────────────
create table if not exists reviews (
  id              text primary key default 'rev' || extract(epoch from now())::bigint::text,
  provider_id     text references providers(id) on delete cascade,
  reviewer_name   text default 'Anonymous',
  reviewer_email  text default '',
  rating          int not null check (rating between 1 and 5),
  comment         text default '',
  approved        boolean default false,
  created_at      timestamptz default now()
);

-- ── INQUIRIES ────────────────────────────────────────────────
create table if not exists inquiries (
  id              text primary key default 'inq' || extract(epoch from now())::bigint::text,
  name            text not null,
  email           text not null,
  phone           text default '',
  subject         text default 'General Inquiry',
  message         text not null,
  status          text default 'new' check (status in ('new','read','replied')),
  replied         boolean default false,
  created_at      timestamptz default now()
);

-- ── JOB POSTS ────────────────────────────────────────────────
create table if not exists job_posts (
  id              text primary key default 'job' || extract(epoch from now())::bigint::text,
  provider_id     text references providers(id) on delete cascade,
  company_name    text default '',
  title           text not null,
  trade_type      text default '',
  location        text default '',
  description     text default '',
  pay_range       text default '',
  job_type        text default 'Full-time',
  experience      text default '',
  posted_at       timestamptz default now(),
  expires_at      timestamptz,
  created_at      timestamptz default now()
);

-- ── BLOG POSTS ───────────────────────────────────────────────
create table if not exists blog_posts (
  id              text primary key default 'blog' || extract(epoch from now())::bigint::text,
  title           text not null,
  slug            text unique,
  excerpt         text default '',
  content         text default '',
  author          text default 'BookYourTrades Team',
  category        text default 'General',
  image_url       text default '',
  published       boolean default true,
  published_at    timestamptz default now(),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── RFQs ─────────────────────────────────────────────────────
create table if not exists rfqs (
  id              text primary key default 'rfq' || extract(epoch from now())::bigint::text,
  client_id       text references users(id) on delete set null,
  client_name     text default '',
  client_email    text default '',
  trade_type      text default '',
  location        text default '',
  description     text not null,
  budget          text default '',
  timeline        text default '',
  status          text default 'open' check (status in ('open','in_progress','closed')),
  created_at      timestamptz default now()
);

-- ── INDEXES ──────────────────────────────────────────────────
create index if not exists idx_providers_trade    on providers(trade_type);
create index if not exists idx_providers_status   on providers(status);
create index if not exists idx_providers_province on providers(province);
create index if not exists idx_users_email        on users(email);
create index if not exists idx_bookings_provider  on bookings(provider_id);
create index if not exists idx_reviews_provider   on reviews(provider_id);
create index if not exists idx_jobs_provider      on job_posts(provider_id);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────
-- Providers: publicly readable, write via service role only
alter table providers enable row level security;
create policy "providers_public_read" on providers for select using (true);
create policy "providers_service_write" on providers for all using (auth.role() = 'service_role');

-- Users: no public read (service role only)
alter table users enable row level security;
create policy "users_service_only" on users for all using (auth.role() = 'service_role');

-- Inquiries: service role only
alter table inquiries enable row level security;
create policy "inquiries_service_only" on inquiries for all using (auth.role() = 'service_role');

-- Bookings: service role only
alter table bookings enable row level security;
create policy "bookings_service_only" on bookings for all using (auth.role() = 'service_role');

-- Reviews: public read approved reviews, service role for writes
alter table reviews enable row level security;
create policy "reviews_public_read" on reviews for select using (approved = true);
create policy "reviews_service_write" on reviews for all using (auth.role() = 'service_role');

-- Job posts: publicly readable
alter table job_posts enable row level security;
create policy "jobs_public_read" on job_posts for select using (true);
create policy "jobs_service_write" on job_posts for all using (auth.role() = 'service_role');

-- Blog posts: public read for published
alter table blog_posts enable row level security;
create policy "blog_public_read" on blog_posts for select using (published = true);
create policy "blog_service_write" on blog_posts for all using (auth.role() = 'service_role');

-- RFQs: service role only
alter table rfqs enable row level security;
create policy "rfqs_service_only" on rfqs for all using (auth.role() = 'service_role');

-- ── UPDATED_AT TRIGGER ────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger providers_updated_at before update on providers
  for each row execute function set_updated_at();
create trigger users_updated_at before update on users
  for each row execute function set_updated_at();

-- ── ADMIN USER ────────────────────────────────────────────────
-- Insert the admin account (password is bcrypt of 'BYT@dmin2026!')
-- You can regenerate this hash at: https://bcrypt-generator.com (rounds=10)
insert into users (id, email, password_hash, role, verified)
values (
  'admin-01',
  'admin@bookyourtrades.com',
  '$2a$10$YourHashHere',   -- REPLACE with actual bcrypt hash before running
  'admin',
  true
) on conflict (email) do nothing;
