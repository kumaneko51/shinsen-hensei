/*
 * アプリの概要: 新選組編成のクラウド同期・共有・投票機能用 Supabase スキーマ。
 * 主な機能: ユーザーごとの編成保存、公開編成、提案投票、ガチャ記録を安全に保存する。
 * 関連ファイル／構成: index.html、README.md、supabase/schema.sql
 * 更新日: 2026-08-30
 * 更新履歴:
 *   - 2026-08-30: 初版。クラウド同期用テーブルと Row Level Security を追加。
 * メンテナンスメモ:
 *   - Supabase の SQL Editor でこのファイル全体を一度だけ実行する。
 *   - service_role キーはブラウザ側のコードや GitHub に絶対に保存しない。
 */

create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  inventory jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.formations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default '編成データ',
  teams jsonb not null default '[]'::jsonb,
  mode text not null default 'free' check (mode in ('free', 'inventory')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shared_formations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '共有編成',
  description text not null default '',
  payload jsonb not null,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text not null default '',
  payload jsonb not null,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.proposal_votes (
  proposal_id uuid not null references public.proposals (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (proposal_id, user_id)
);

create table if not exists public.gacha_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pool_name text not null default '',
  result jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create or replace function public.set_updated_at_()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at_();

drop trigger if exists formations_set_updated_at on public.formations;
create trigger formations_set_updated_at
before update on public.formations
for each row execute function public.set_updated_at_();

drop trigger if exists shared_formations_set_updated_at on public.shared_formations;
create trigger shared_formations_set_updated_at
before update on public.shared_formations
for each row execute function public.set_updated_at_();

drop trigger if exists proposals_set_updated_at on public.proposals;
create trigger proposals_set_updated_at
before update on public.proposals
for each row execute function public.set_updated_at_();

alter table public.user_profiles enable row level security;
alter table public.formations enable row level security;
alter table public.shared_formations enable row level security;
alter table public.proposals enable row level security;
alter table public.proposal_votes enable row level security;
alter table public.gacha_logs enable row level security;

drop policy if exists "profiles: own rows" on public.user_profiles;
create policy "profiles: own rows" on public.user_profiles
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "formations: own rows" on public.formations;
create policy "formations: own rows" on public.formations
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "shared formations: read public or own" on public.shared_formations;
create policy "shared formations: read public or own" on public.shared_formations
for select to anon, authenticated
using (is_public or auth.uid() = user_id);

drop policy if exists "shared formations: own writes" on public.shared_formations;
create policy "shared formations: own writes" on public.shared_formations
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "proposals: read public or own" on public.proposals;
create policy "proposals: read public or own" on public.proposals
for select to anon, authenticated
using (is_public or auth.uid() = user_id);

drop policy if exists "proposals: own writes" on public.proposals;
create policy "proposals: own writes" on public.proposals
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "proposal votes: own rows" on public.proposal_votes;
create policy "proposal votes: own rows" on public.proposal_votes
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "gacha logs: own rows" on public.gacha_logs;
create policy "gacha logs: own rows" on public.gacha_logs
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
