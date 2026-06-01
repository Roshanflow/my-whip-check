-- MyWhipCheck — Supabase migration
-- Paste this into the Supabase SQL Editor and run it.

-- ─── Vehicles ───────────────────────────────────────────────────────────────
create table vehicles (
  id            uuid        default gen_random_uuid() primary key,
  user_id       uuid        references auth.users(id) on delete cascade not null,
  nickname      text,
  make          text        not null,
  model         text        not null,
  year          integer     not null,
  type          text        not null check (type in ('car', 'bike')),
  registration  text        not null,
  color         text,
  notes         text,
  created_at    timestamptz default now()
);

alter table vehicles enable row level security;

create policy "Users manage own vehicles" on vehicles
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── MOT Records ─────────────────────────────────────────────────────────────
create table mot_records (
  id               uuid    default gen_random_uuid() primary key,
  vehicle_id       uuid    references vehicles(id) on delete cascade not null,
  test_date        date    not null,
  expiry_date      date,
  result           text    not null check (result in ('pass', 'fail')),
  mileage          integer,
  advisory_notes   text,
  failure_reasons  text,
  created_at       timestamptz default now()
);

alter table mot_records enable row level security;

create policy "Users manage own mot records" on mot_records
  for all
  using (
    exists (
      select 1 from vehicles
      where vehicles.id = mot_records.vehicle_id
        and vehicles.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from vehicles
      where vehicles.id = mot_records.vehicle_id
        and vehicles.user_id = auth.uid()
    )
  );

-- ─── Service Records ─────────────────────────────────────────────────────────
create table service_records (
  id            uuid    default gen_random_uuid() primary key,
  vehicle_id    uuid    references vehicles(id) on delete cascade not null,
  service_date  date    not null,
  mileage       integer,
  service_type  text    not null,
  description   text,
  cost          numeric(10, 2),
  provider      text,
  created_at    timestamptz default now()
);

alter table service_records enable row level security;

create policy "Users manage own service records" on service_records
  for all
  using (
    exists (
      select 1 from vehicles
      where vehicles.id = service_records.vehicle_id
        and vehicles.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from vehicles
      where vehicles.id = service_records.vehicle_id
        and vehicles.user_id = auth.uid()
    )
  );
