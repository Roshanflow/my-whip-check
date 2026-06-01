-- MyWhipCheck — Migration v3
-- Run this AFTER migration.sql and migration-v2.sql.
-- Adds unique constraint to prevent duplicate MOT records per vehicle per test date.

alter table mot_records
  add constraint mot_records_vehicle_test_date_unique
  unique (vehicle_id, test_date);
