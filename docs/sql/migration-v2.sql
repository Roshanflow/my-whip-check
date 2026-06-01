-- MyWhipCheck — Migration v2
-- Run this AFTER migration.sql.
-- Adds service file attachments + Supabase Storage bucket.

-- ─── Storage bucket ───────────────────────────────────────────────────────
-- Create a private bucket for service documents.
insert into storage.buckets (id, name, public)
values ('service-documents', 'service-documents', false)
on conflict (id) do nothing;

-- RLS: users can only access files under their own user_id folder
create policy "Users upload own service files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'service-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users read own service files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'service-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users delete own service files" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'service-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─── Service Files table ──────────────────────────────────────────────────
create table service_files (
  id                 uuid        default gen_random_uuid() primary key,
  service_record_id  uuid        references service_records(id) on delete cascade not null,
  file_name          text        not null,
  storage_path       text        not null,
  file_type          text        not null,
  file_size          integer,
  created_at         timestamptz default now()
);

alter table service_files enable row level security;

create policy "Users manage own service files" on service_files
  for all
  using (
    exists (
      select 1 from service_records sr
      join vehicles v on v.id = sr.vehicle_id
      where sr.id = service_files.service_record_id
        and v.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from service_records sr
      join vehicles v on v.id = sr.vehicle_id
      where sr.id = service_files.service_record_id
        and v.user_id = auth.uid()
    )
  );
