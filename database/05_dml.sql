-- =====================================================================
-- 05_dml.sql  -  DML demonstration: INSERT, UPDATE, DELETE, SELECT
--                plus statements the database deliberately REJECTS
-- Run with psql:  psql -U postgres -h localhost -d routewise -f database/05_dml.sql
--
-- Everything runs inside one transaction that ends with ROLLBACK, so your data
-- is unchanged afterwards. ON_ERROR_ROLLBACK lets the transaction continue after
-- each intentionally rejected statement.
-- =====================================================================
\set ON_ERROR_STOP off
\set ON_ERROR_ROLLBACK on
\pset pager off

BEGIN;

\echo '== INSERT: a new stop, and add it to route R-D (multivalued attribute row) =='
INSERT INTO stops(stop_code, stop_name, area, latitude, longitude)
VALUES ('BLR016', 'Silk Board', 'BTM Layout', 12.9177, 77.6238)
RETURNING stop_id, stop_code, stop_name;

INSERT INTO route_stops(route_id, stop_id, stop_sequence)
SELECT 4, stop_id, 6 FROM stops WHERE stop_code = 'BLR016'
RETURNING route_id, stop_id, stop_sequence;

\echo '== INSERT: a delay report (the BEFORE trigger tidies the cause; AFTER triggers add an alert and an audit row) =='
INSERT INTO delay_reports(trip_id, stop_id, delay_minutes, cause)
VALUES (1, 2, 17, '  signal   FAILURE ')
RETURNING report_id, delay_minutes, cause;

SELECT da.report_id, da.alert_message, da.resolved
FROM delay_alerts da
WHERE da.report_id = (SELECT MAX(report_id) FROM delay_reports);

\echo '== UPDATE: correct the delay and cause (BEFORE trigger stamps updated_at) =='
UPDATE delay_reports
SET delay_minutes = 20, cause = 'heavy RAIN'
WHERE report_id = (SELECT MAX(report_id) FROM delay_reports)
RETURNING report_id, delay_minutes, cause, updated_at IS NOT NULL AS edited;

UPDATE buses SET status = 'MAINTENANCE'
WHERE registration_no = 'KA-01-SAMPLE-003'
RETURNING bus_id, registration_no, status;

\echo '== SELECT with JOINs: the newest delay reports with route and stop names =='
SELECT dr.report_id, r.route_code, s.stop_name, dr.delay_minutes, dr.cause
FROM delay_reports dr
JOIN trips t  ON t.trip_id  = dr.trip_id
JOIN routes r ON r.route_id = t.route_id
JOIN stops s  ON s.stop_id  = dr.stop_id
ORDER BY dr.report_id DESC
LIMIT 5;

\echo '== DELETE: remove the report (its alert goes too: ON DELETE CASCADE) =='
DELETE FROM delay_reports
WHERE report_id = (SELECT MAX(report_id) FROM delay_reports)
RETURNING report_id, delay_minutes, cause;

SELECT COUNT(*) AS alerts_left_for_deleted_report
FROM delay_alerts
WHERE report_id NOT IN (SELECT report_id FROM delay_reports);

\echo '== Audit trail written by the AFTER trigger for the three changes above =='
SELECT action, report_id, old_delay, new_delay, old_cause, new_cause
FROM delay_report_audit
ORDER BY audit_id DESC
LIMIT 3;

DELETE FROM route_stops WHERE stop_id = (SELECT stop_id FROM stops WHERE stop_code = 'BLR016');
DELETE FROM stops WHERE stop_code = 'BLR016' RETURNING stop_id, stop_code;

\echo '== REJECTED 1: CHECK constraint (delay must be 0-240 minutes) =='
INSERT INTO delay_reports(trip_id, stop_id, delay_minutes, cause) VALUES (1, 2, 300, 'Test');

\echo '== REJECTED 2: FOREIGN KEY (trip 999 does not exist) =='
INSERT INTO delay_reports(trip_id, stop_id, delay_minutes, cause) VALUES (999, 1, 5, 'Test');

\echo '== REJECTED 3: UNIQUE (stop code BLR001 is already used) =='
INSERT INTO stops(stop_code, stop_name, area) VALUES ('BLR001', 'Duplicate', 'X');

\echo '== REJECTED 4: ON DELETE RESTRICT (Majestic is still used by routes) =='
DELETE FROM stops WHERE stop_id = 1;

\echo '== REJECTED 5: NOT NULL (a route needs a name) =='
INSERT INTO routes(route_code) VALUES ('R-Z');

\echo '== REJECTED 6: CHECK on role (only ADMIN, DEPOT_STAFF, COMMUTER) =='
INSERT INTO users(full_name, email, password_hash, role) VALUES ('X', 'x@test.com', 'hash', 'DRIVER');

ROLLBACK;

\echo '== After ROLLBACK: nothing above was kept =='
SELECT (SELECT COUNT(*) FROM stops) AS stops,
       (SELECT COUNT(*) FROM delay_reports) AS delay_reports,
       (SELECT status FROM buses WHERE registration_no = 'KA-01-SAMPLE-003') AS bus_3_status;
