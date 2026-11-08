-- Direct Instagram administration. Private to the service role; all browser access uses the authenticated Edge Function.
create table public.social_admins(email text primary key check(email=lower(email)), created_at timestamptz not null default now());
insert into public.social_admins(email) values ('cae_sk@hotmail.com');
create table public.social_settings(id boolean primary key default true check(id), paused boolean not null default true, auto_publish boolean not null default false, auto_reply boolean not null default false, daily_post_limit integer not null default 2 check(daily_post_limit between 1 and 10), updated_at timestamptz not null default now());
insert into public.social_settings(id) values(true);
create table public.social_secrets(id text primary key, value jsonb not null, updated_at timestamptz not null default now());
create table public.social_accounts(id text primary key, username text not null, token_cipher text not null, expires_at timestamptz not null, created_at timestamptz not null default now());
create table public.social_posts(id uuid primary key default gen_random_uuid(), account_id text not null references public.social_accounts(id), caption text not null check(length(caption) between 1 and 2200), image_url text not null, scheduled_at timestamptz, status text not null default 'draft' check(status in ('draft','scheduled','publishing','published','failed','needs_review')), container_id text, media_id text, last_error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index social_posts_due on public.social_posts(status,scheduled_at);
create table public.social_inbox(id text primary key, account_id text not null references public.social_accounts(id), kind text not null check(kind in ('comment','message')), external_id text not null, sender_id text not null, sender_name text, text text not null, received_at timestamptz not null, status text not null default 'open' check(status in ('open','replying','replied','needs_review','dismissed')), reply text, sent_id text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index social_inbox_open on public.social_inbox(status,received_at);
create index social_inbox_account_sender on public.social_inbox(account_id,sender_id,received_at desc);
create table public.social_oauth(id text primary key, actor text not null, expires_at timestamptz not null, used_at timestamptz);
create table public.social_audit(id bigint generated always as identity primary key, actor text not null, action text not null, details jsonb not null default '{}', created_at timestamptz not null default now());
do $$ declare tab text; begin foreach tab in array array['social_admins','social_settings','social_secrets','social_accounts','social_posts','social_inbox','social_oauth','social_audit'] loop execute format('alter table public.%I enable row level security',tab); execute format('revoke all on public.%I from anon, authenticated',tab); execute format('grant all on public.%I to service_role',tab); end loop; end $$;
grant usage,select on sequence public.social_audit_id_seq to service_role;
create or replace function public.social_claim_post(post_id uuid) returns setof public.social_posts language sql security invoker set search_path=public as $$ update public.social_posts set status='publishing',updated_at=now() where id=post_id and status='scheduled' and scheduled_at<=now() returning * $$;
revoke all on function public.social_claim_post(uuid) from public,anon,authenticated;
grant execute on function public.social_claim_post(uuid) to service_role;
create or replace function public.social_claim_reply(item_id text) returns setof public.social_inbox language sql security invoker set search_path=public as $$ update public.social_inbox set status='replying',updated_at=now() where id=item_id and status='open' returning * $$;
revoke all on function public.social_claim_reply(text) from public,anon,authenticated;
grant execute on function public.social_claim_reply(text) to service_role;
-- A database lease serializes worker and operator-triggered runs; ambiguous outbound calls are never blindly retried.
create table public.social_worker_lock(id boolean primary key default true check(id), until_at timestamptz not null default now());
insert into public.social_worker_lock(id) values(true);
alter table public.social_worker_lock enable row level security;
revoke all on public.social_worker_lock from anon,authenticated;
grant all on public.social_worker_lock to service_role;
create or replace function public.social_claim_worker() returns setof public.social_worker_lock language sql security invoker set search_path=public as $$ update public.social_worker_lock set until_at=now()+interval '3 minutes' where id=true and until_at<now() returning * $$;
revoke all on function public.social_claim_worker() from public,anon,authenticated;
grant execute on function public.social_claim_worker() to service_role;

-- Later additive content-library migration (applied separately in the hosted database):
alter table public.social_settings add column auto_create boolean not null default false, add column daily_hour integer not null default 12 check(daily_hour between 0 and 23);
alter table public.social_accounts add column language text not null default 'en' check(language in ('en','es'));
create table public.social_library(id uuid primary key default gen_random_uuid(),language text not null check(language in ('en','es')),caption text not null check(length(caption) between 1 and 2200),image_url text not null,enabled boolean not null default true,used_at timestamptz,created_at timestamptz not null default now());
alter table public.social_library enable row level security;
revoke all on public.social_library from anon,authenticated;
grant all on public.social_library to service_role;
create index social_library_available on public.social_library(language,enabled,used_at);
-- The pg_cron / pg_net schedule and its generated credential were provisioned separately.
-- Never commit the worker credential. See direct-instagram.md for operational details.
