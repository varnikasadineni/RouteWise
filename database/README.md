# database/

PostgreSQL scripts for RouteWise, numbered in the order they run.

| File | Purpose | Changes data? |
|---|---|---|
| `01_schema.sql` | DDL: 11 tables, primary/foreign keys, UNIQUE, CHECK, NOT NULL, ON DELETE rules, 7 indexes | Creates objects |
| `02_seed.sql` | Sample network: 15 stops, 5 routes, 20 route stops, 4 buses, 7 trips, 28 stop times, 10 delay reports | Inserts sample rows |
| `03_routines.sql` | View `route_delay_summary`, function `get_route_delay_stats`, procedure `resolve_route_alerts`, 3 triggers (1 BEFORE, 2 AFTER) | Creates objects; back-fills alerts |
| `04_access.sql` | Database roles `routewise_admin`, `routewise_staff`, `routewise_commuter` and their GRANTs | Creates roles |
| `05_dml.sql` | INSERT, UPDATE, DELETE, SELECT examples and 6 statements the database rejects | No: everything is rolled back |
| `06_queries.sql` | JOIN, LEFT JOIN, GROUP BY/HAVING, nested, correlated, NOT EXISTS, CTE, recursive CTE, window function, view, function, procedure, EXPLAIN, role check | No: the procedure call is rolled back |
| `07_ddl_demo.sql` | ALTER TABLE (add column, NOT NULL, named CHECK), then CREATE / ALTER / RENAME / TRUNCATE / DROP on a throwaway table | Adds `buses.depot_name` and `chk_route_code_format` |
| `08_verify.sql` | Read-only check: row counts, constraints, indexes, routines, triggers, role privileges | No |

## Load order

Fresh database (PowerShell or Git Bash, with `psql` on the PATH and `PGPASSWORD` set):

```bash
psql -U postgres -h localhost -c "CREATE DATABASE routewise;"
psql -U postgres -h localhost -d routewise -f database/01_schema.sql
psql -U postgres -h localhost -d routewise -f database/02_seed.sql
psql -U postgres -h localhost -d routewise -f database/03_routines.sql
psql -U postgres -h localhost -d routewise -f database/04_access.sql
psql -U postgres -h localhost -d routewise -f database/07_ddl_demo.sql
psql -U postgres -h localhost -d routewise -f database/08_verify.sql
```

Then, for the demonstration:

```bash
psql -U postgres -h localhost -d routewise -f database/05_dml.sql
psql -U postgres -h localhost -d routewise -f database/06_queries.sql
```

`05_dml.sql` and `06_queries.sql` print `ERROR` lines on purpose: they show the constraints, the procedure's validation and the database roles rejecting bad operations. They end with ROLLBACK, so they can be run any number of times.

## Upgrading a database built with the earlier scripts

Databases created with the earlier `schema.sql`, `seed.sql` and `advanced_queries.sql` already contain everything. Running `01` to `04` and `07` on them is safe: all scripts use `IF NOT EXISTS`, `CREATE OR REPLACE` or `ON CONFLICT`. They only make the trigger functions `SECURITY DEFINER` and grant staff `SELECT` on alerts and the audit log.

## Data integrity at the database level

- **Keys:** surrogate identity primary keys; composite keys on `route_stops` and `trip_stop_times`; natural keys (`email`, `stop_code`, `route_code`, `registration_no`) are UNIQUE.
- **CHECK:** delay 0–240 minutes, latitude/longitude ranges, positive capacity and sequence numbers, allowed values for `role`, `status` and `trip_status`, non-blank cause and description.
- **ON DELETE:** CASCADE (a trip's stop times and reports; a report's alert), RESTRICT (stops still used by routes), SET NULL (a deleted user's reports and complaints are kept).
- **Triggers:** clean the cause text, create high-delay alerts and audit every change, whatever the source (web app or psql).
