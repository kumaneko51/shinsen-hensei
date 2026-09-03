/*
 * アプリの概要: 新選組編成のクラウド同期・共有・投票機能用 Supabase スキーマ。
 * 主な機能: ユーザーごとの編成保存、公開編成、提案投票、ガチャ記録を安全に保存する。
 * 関連ファイル／構成: index.html、README.md、supabase/schema.sql
 * 更新日: 2026-09-03
 * 更新履歴:
 *   - 2026-08-30: 初版。クラウド同期用テーブルと Row Level Security を追加。
 *   - 2026-09-03: 一門限定の編成閲覧・コメント・招待ID機能を追加。
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

-- 一門限定の閲覧・コメント機能
create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  invite_code text not null unique,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.family_members (
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  display_name text not null default '',
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

create table if not exists public.family_lineups (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null default '',
  source_team_id text not null default '',
  title text not null default '部隊',
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, user_id, source_team_id)
);

create table if not exists public.family_lineup_comments (
  id uuid primary key default gen_random_uuid(),
  family_lineup_id uuid not null references public.family_lineups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null default '',
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create or replace function public.is_family_member_(family_uuid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.family_members
    where family_id = family_uuid
      and user_id = auth.uid()
  );
$$;

create or replace function public.create_family(family_name text)
returns public.families
language plpgsql
security definer
set search_path = public
as $$
declare
  created_family public.families;
  member_name text;
begin
  if auth.uid() is null then raise exception 'ログインが必要です'; end if;
  if exists (select 1 from public.family_members where user_id = auth.uid()) then raise exception 'すでに一門へ所属しています'; end if;
  if char_length(trim(coalesce(family_name, ''))) not between 1 and 40 then raise exception '一門名は1〜40文字で入力してください'; end if;
  insert into public.families (name, invite_code, owner_id)
  values (trim(family_name), 'FM-' || upper(encode(gen_random_bytes(8), 'hex')), auth.uid())
  returning * into created_family;
  member_name := coalesce(auth.jwt() -> 'user_metadata' ->> 'display_name', 'メンバー');
  insert into public.family_members (family_id, user_id, display_name, role)
  values (created_family.id, auth.uid(), member_name, 'owner');
  return created_family;
end;
$$;

create or replace function public.join_family_by_invite(input_invite_code text)
returns public.families
language plpgsql
security definer
set search_path = public
as $$
declare
  target_family public.families;
  member_name text;
begin
  if auth.uid() is null then raise exception 'ログインが必要です'; end if;
  if exists (select 1 from public.family_members where user_id = auth.uid()) then raise exception 'すでに一門へ所属しています'; end if;
  select * into target_family
  from public.families
  where upper(invite_code) = upper(trim(coalesce(input_invite_code, '')));
  if not found then raise exception '招待IDが見つかりません'; end if;
  member_name := coalesce(auth.jwt() -> 'user_metadata' ->> 'display_name', 'メンバー');
  insert into public.family_members (family_id, user_id, display_name)
  values (target_family.id, auth.uid(), member_name);
  return target_family;
end;
$$;

drop trigger if exists families_set_updated_at on public.families;
create trigger families_set_updated_at
before update on public.families
for each row execute function public.set_updated_at_();

drop trigger if exists family_lineups_set_updated_at on public.family_lineups;
create trigger family_lineups_set_updated_at
before update on public.family_lineups
for each row execute function public.set_updated_at_();

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.family_lineups enable row level security;
alter table public.family_lineup_comments enable row level security;

drop policy if exists "families: members can read" on public.families;
create policy "families: members can read" on public.families
for select to authenticated
using (public.is_family_member_(id));

drop policy if exists "families: owner can update" on public.families;
create policy "families: owner can update" on public.families
for update to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "family members: members can read" on public.family_members;
create policy "family members: members can read" on public.family_members
for select to authenticated
using (public.is_family_member_(family_id));

drop policy if exists "family lineups: members can read" on public.family_lineups;
create policy "family lineups: members can read" on public.family_lineups
for select to authenticated
using (public.is_family_member_(family_id));

drop policy if exists "family lineups: owner can write" on public.family_lineups;
create policy "family lineups: owner can write" on public.family_lineups
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid() and public.is_family_member_(family_id));

drop policy if exists "family comments: members can read" on public.family_lineup_comments;
create policy "family comments: members can read" on public.family_lineup_comments
for select to authenticated
using (
  exists (
    select 1
    from public.family_lineups
    where id = family_lineup_id
      and public.is_family_member_(family_id)
  )
);

drop policy if exists "family comments: author can write" on public.family_lineup_comments;
create policy "family comments: author can write" on public.family_lineup_comments
for all to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.family_lineups
    where id = family_lineup_id
      and public.is_family_member_(family_id)
  )
);

revoke all on function public.is_family_member_(uuid) from public;
grant execute on function public.is_family_member_(uuid) to authenticated;
revoke all on function public.create_family(text) from public;
grant execute on function public.create_family(text) to authenticated;
revoke all on function public.join_family_by_invite(text) from public;
grant execute on function public.join_family_by_invite(text) to authenticated;
