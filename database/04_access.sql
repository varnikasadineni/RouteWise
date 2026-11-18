-- =====================================================================
-- 04_access.sql  -  Role-based access control inside PostgreSQL
-- Run after 03_routines.sql (it grants on the procedure). Safe to run again.
--
-- App role (users.role)   Database role          What it may do
-- ADMIN                   routewise_admin        everything on every table; run the procedure
-- DEPOT_STAFF             routewise_staff        read the network; insert/update (not delete) delay reports
-- COMMUTER                routewise_commuter     read the network; file complaints
--
-- The web app enforces the same rules with requireRole() in lib/auth.ts.
-- The Database page (/admin/database) shows these privileges live via has_table_privilege().
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'routewise_admin')    THEN CREATE ROLE routewise_admin    NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'routewise_staff')    THEN CREATE ROLE routewise_staff    NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'routewise_commuter') THEN CREATE ROLE routewise_commuter NOLOGIN; END IF;
END $$;

-- Admin: full DML on every table and view
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO routewise_admin;
GRANT EXECUTE ON PROCEDURE resolve_route_alerts(VARCHAR, INTEGER) TO routewise_admin;

-- Staff and commuters: read the network and the dashboard view
GRANT SELECT ON stops, routes, route_stops, trips, trip_stop_times, route_delay_summary
  TO routewise_staff, routewise_commuter;

-- Staff: report and correct delays, read alerts and the audit log, but no DELETE
GRANT SELECT, INSERT, UPDATE ON delay_reports TO routewise_staff;
GRANT SELECT ON delay_alerts, delay_report_audit TO routewise_staff;

-- Commuters: file complaints only
GRANT INSERT ON complaints TO routewise_commuter;

-- Demonstration (expect "ERROR: permission denied for table delay_reports"):
--   SET ROLE routewise_staff;
--   DELETE FROM delay_reports WHERE report_id = 1;
--   RESET ROLE;
