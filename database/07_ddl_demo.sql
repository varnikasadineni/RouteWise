-- =====================================================================
-- 07_ddl_demo.sql  -  ALTER, RENAME, TRUNCATE and DROP
-- Part A changes the real schema (kept); Part B uses a throwaway table.
-- Safe to run again.
-- Run with psql:  psql -U postgres -h localhost -d routewise -f database/07_ddl_demo.sql
-- =====================================================================
\set ON_ERROR_STOP on
\pset pager off

\echo '== Part A: ALTER the real schema =='
-- Add a column with a default, back-fill it, then make it NOT NULL
ALTER TABLE buses ADD COLUMN IF NOT EXISTS depot_name VARCHAR(80) DEFAULT 'Majestic Depot';
UPDATE buses SET depot_name = 'Majestic Depot' WHERE depot_name IS NULL;
ALTER TABLE buses ALTER COLUMN depot_name SET NOT NULL;

-- Add a named CHECK constraint (route codes look like R-A, R-B ...)
ALTER TABLE routes DROP CONSTRAINT IF EXISTS chk_route_code_format;
ALTER TABLE routes ADD CONSTRAINT chk_route_code_format CHECK (route_code ~ '^R-[A-Z0-9]+$');

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'buses' ORDER BY ordinal_position;

SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'routes'::regclass AND contype = 'c';

\echo '== Part B: full DDL life cycle on a throwaway table =='
DROP TABLE IF EXISTS demo_depot;
CREATE TABLE demo_depot (
  depot_id   SERIAL PRIMARY KEY,
  depot_name VARCHAR(80) NOT NULL UNIQUE,
  capacity   INT CHECK (capacity > 0)
);
ALTER TABLE demo_depot ADD COLUMN area VARCHAR(80);
ALTER TABLE demo_depot RENAME COLUMN area TO locality;
ALTER TABLE demo_depot ALTER COLUMN capacity SET DEFAULT 50;
INSERT INTO demo_depot(depot_name, locality) VALUES ('Shantinagar', 'Shantinagar');

SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'demo_depot' ORDER BY ordinal_position;
SELECT * FROM demo_depot;

TRUNCATE demo_depot;
SELECT COUNT(*) AS rows_after_truncate FROM demo_depot;
DROP TABLE demo_depot;
SELECT to_regclass('demo_depot') AS demo_depot_after_drop;
