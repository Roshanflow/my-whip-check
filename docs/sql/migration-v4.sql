-- MyWhipCheck — Migration v4
-- Run this AFTER migration-v3.sql.
-- Adds mot_test_number column and unique constraint for deduplication by DVSA test number.

alter table mot_records
  add column if not exists mot_test_number text;

alter table mot_records
  add constraint mot_records_mot_test_number_unique
  unique (mot_test_number);
