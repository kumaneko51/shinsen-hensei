-- 一門所属で読み取りを制限。書き込みは管理者の登録作業のみ。
begin;
create table if not exists public.family_land_reports (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  report_number integer not null,
  payload jsonb not null,
  image_path text not null unique,
  created_at timestamptz not null default now(),
  unique(family_id, report_number)
);
alter table public.family_land_reports enable row level security;
revoke all on public.family_land_reports from anon, authenticated;
grant select on public.family_land_reports to authenticated;
drop policy if exists "land reports: family read" on public.family_land_reports;
create policy "land reports: family read" on public.family_land_reports
for select to authenticated using (public.is_family_member_(family_id));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('family-land-reports','family-land-reports',false,10485760,array['image/png','image/jpeg'])
on conflict(id) do update set public=false;
drop policy if exists "land images: family read" on storage.objects;
create policy "land images: family read" on storage.objects
for select to authenticated using (
  bucket_id='family-land-reports' and exists (
    select 1 from public.family_land_reports r
    where r.image_path=storage.objects.name and public.is_family_member_(r.family_id)
  )
);
commit;
