-- Advanced DBMS concepts for the RouteWise report. Run once after schema.sql and seed.sql.
CREATE OR REPLACE VIEW route_delay_summary AS
SELECT r.route_id, r.route_code, r.route_name,
       COUNT(dr.report_id)::INTEGER AS report_count,
       ROUND(COALESCE(AVG(dr.delay_minutes),0),2) AS avg_delay_minutes,
       COALESCE(MAX(dr.delay_minutes),0)::INTEGER AS max_delay_minutes
FROM routes r
LEFT JOIN trips t ON t.route_id=r.route_id
LEFT JOIN delay_reports dr ON dr.trip_id=t.trip_id
GROUP BY r.route_id,r.route_code,r.route_name;

-- Trigger: automatically create an alert for reports with delay >= 15 minutes.
CREATE OR REPLACE FUNCTION create_delay_alert() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.delay_minutes >= 15 THEN
    INSERT INTO delay_alerts(report_id,alert_message)
    VALUES(NEW.report_id, format('High delay: %s minutes at stop ID %s on trip ID %s', NEW.delay_minutes, NEW.stop_id, NEW.trip_id))
    ON CONFLICT(report_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_create_delay_alert ON delay_reports;
CREATE TRIGGER trg_create_delay_alert AFTER INSERT OR UPDATE OF delay_minutes, stop_id, trip_id
ON delay_reports FOR EACH ROW EXECUTE FUNCTION create_delay_alert();

-- Stored function: summary for a route code.
CREATE OR REPLACE FUNCTION get_route_delay_stats(p_route_code VARCHAR)
RETURNS TABLE(route_code VARCHAR, route_name VARCHAR, report_count BIGINT, avg_delay NUMERIC, max_delay INTEGER)
LANGUAGE SQL STABLE AS $$
  SELECT r.route_code,r.route_name,COUNT(dr.report_id),ROUND(COALESCE(AVG(dr.delay_minutes),0),2),COALESCE(MAX(dr.delay_minutes),0)::INTEGER
  FROM routes r LEFT JOIN trips t ON t.route_id=r.route_id LEFT JOIN delay_reports dr ON dr.trip_id=t.trip_id
  WHERE r.route_code=p_route_code GROUP BY r.route_code,r.route_name;
$$;

-- Window function: rank routes by average delay.
SELECT route_code,route_name,avg_delay_minutes,
       RANK() OVER (ORDER BY avg_delay_minutes DESC) AS delay_rank
FROM route_delay_summary;

-- GROUP BY / HAVING: routes with at least two delay reports.
SELECT r.route_code,COUNT(*) AS report_count,ROUND(AVG(dr.delay_minutes),2) AS avg_delay
FROM routes r JOIN trips t ON t.route_id=r.route_id JOIN delay_reports dr ON dr.trip_id=t.trip_id
GROUP BY r.route_code HAVING COUNT(*) >= 2 ORDER BY avg_delay DESC;

-- Function call example:
-- SELECT * FROM get_route_delay_stats('R-B');

-- Transaction example. Replace IDs with a valid trip/stop combination.
-- BEGIN;
-- INSERT INTO delay_reports(trip_id,stop_id,delay_minutes,cause) VALUES(1,2,17,'Traffic congestion');
-- The trigger creates a delay_alert row for delay >= 15.
-- COMMIT;
-- ROLLBACK instead of COMMIT to undo the test.

-- Index performance example:
-- EXPLAIN ANALYZE SELECT * FROM delay_reports WHERE trip_id=2 ORDER BY observed_at DESC;

-- =====================================================================
-- Additions for the Level 3 rubric. Safe to run more than once.
-- =====================================================================

-- Backfill: seed.sql runs before the trigger exists, so create alerts for
-- seeded reports of 15+ minutes as well.
INSERT INTO delay_alerts(report_id, alert_message)
SELECT report_id, format('High delay: %s minutes at stop ID %s on trip ID %s', delay_minutes, stop_id, trip_id)
FROM delay_reports WHERE delay_minutes >= 15
ON CONFLICT (report_id) DO NOTHING;

-- ---------- DDL: ALTER and DROP ----------
ALTER TABLE buses ADD COLUMN IF NOT EXISTS depot_name VARCHAR(80) DEFAULT 'Majestic Depot';
UPDATE buses SET depot_name = 'Majestic Depot' WHERE depot_name IS NULL;
ALTER TABLE buses ALTER COLUMN depot_name SET NOT NULL;
ALTER TABLE routes DROP CONSTRAINT IF EXISTS chk_route_code_format;
ALTER TABLE routes ADD CONSTRAINT chk_route_code_format CHECK (route_code ~ '^R-[A-Z0-9]+$');
CREATE TABLE IF NOT EXISTS temp_stop_import (stop_code VARCHAR(30), stop_name VARCHAR(120));
DROP TABLE IF EXISTS temp_stop_import;

-- ---------- Nested subquery: stops where a delay was above the overall average ----------
SELECT stop_name, area FROM stops
WHERE stop_id IN (SELECT stop_id FROM delay_reports
                  WHERE delay_minutes > (SELECT AVG(delay_minutes) FROM delay_reports))
ORDER BY stop_name;

-- ---------- Correlated subquery: the worst delay on each trip ----------
SELECT r.route_code, t.trip_id, dr.stop_id, dr.delay_minutes
FROM delay_reports dr
JOIN trips t ON t.trip_id = dr.trip_id
JOIN routes r ON r.route_id = t.route_id
WHERE dr.delay_minutes = (SELECT MAX(d2.delay_minutes) FROM delay_reports d2 WHERE d2.trip_id = dr.trip_id)
ORDER BY dr.delay_minutes DESC;

-- ---------- NOT EXISTS: stops that no route serves ----------
SELECT s.stop_name FROM stops s
WHERE NOT EXISTS (SELECT 1 FROM route_stops rs WHERE rs.stop_id = s.stop_id);

-- ---------- CTE: stops whose average delay is 10 minutes or more ----------
WITH stop_delay AS (
  SELECT stop_id, COUNT(*) AS reports, AVG(delay_minutes) AS avg_delay
  FROM delay_reports GROUP BY stop_id)
SELECT s.stop_name, sd.reports, ROUND(sd.avg_delay,1) AS avg_delay
FROM stop_delay sd JOIN stops s ON s.stop_id = sd.stop_id
WHERE sd.avg_delay >= 10 ORDER BY sd.avg_delay DESC;

-- ---------- Recursive CTE: every stop reachable from Majestic, fewest hops ----------
WITH RECURSIVE reachable(stop_id, path, hops) AS (
  SELECT 1::BIGINT, ARRAY[1::BIGINT], 0
  UNION ALL
  SELECT nxt.stop_id, r.path || nxt.stop_id, r.hops + 1
  FROM reachable r
  JOIN route_stops cur ON cur.stop_id = r.stop_id
  JOIN route_stops nxt ON nxt.route_id = cur.route_id AND nxt.stop_sequence = cur.stop_sequence + 1
  WHERE NOT nxt.stop_id = ANY(r.path) AND r.hops < 6)
SELECT s.stop_name, MIN(hops) AS min_hops
FROM reachable rc JOIN stops s ON s.stop_id = rc.stop_id
GROUP BY s.stop_name ORDER BY min_hops, s.stop_name;

-- ---------- Role-based access control inside the database ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'routewise_admin')    THEN CREATE ROLE routewise_admin NOLOGIN;    END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'routewise_staff')    THEN CREATE ROLE routewise_staff NOLOGIN;    END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'routewise_commuter') THEN CREATE ROLE routewise_commuter NOLOGIN; END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO routewise_admin;
GRANT SELECT ON stops, routes, route_stops, trips, trip_stop_times, route_delay_summary TO routewise_staff, routewise_commuter;
GRANT SELECT, INSERT, UPDATE ON delay_reports TO routewise_staff;
GRANT INSERT ON complaints TO routewise_commuter;
-- Demo (expect "permission denied for table delay_reports"):
-- SET ROLE routewise_commuter;
-- INSERT INTO delay_reports(trip_id,stop_id,delay_minutes,cause) VALUES (1,2,5,'x');
-- RESET ROLE;

-- =====================================================================
-- BEFORE trigger, audit (AFTER) trigger and stored procedure.
-- Used from the web UI: Manage page (BEFORE trigger, audit) and
-- Database page (function, procedure, trigger list, audit log).
-- =====================================================================

ALTER TABLE delay_reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- ---------- BEFORE INSERT/UPDATE trigger: clean the cause text, stamp edits ----------
-- "  signal   FAILURE " is stored as "Signal failure". Runs before the row is written,
-- so it can change NEW; an AFTER trigger cannot.
CREATE OR REPLACE FUNCTION normalize_delay_report() RETURNS TRIGGER AS $$
DECLARE cleaned TEXT;
BEGIN
  cleaned := regexp_replace(btrim(coalesce(NEW.cause, '')), '\s+', ' ', 'g');
  IF cleaned = '' THEN cleaned := 'Unknown'; END IF;
  NEW.cause := upper(left(cleaned, 1)) || lower(substr(cleaned, 2));
  IF TG_OP = 'UPDATE' THEN NEW.updated_at := NOW(); END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_normalize_delay_report ON delay_reports;
CREATE TRIGGER trg_normalize_delay_report
BEFORE INSERT OR UPDATE ON delay_reports
FOR EACH ROW EXECUTE FUNCTION normalize_delay_report();

-- ---------- AFTER INSERT/UPDATE/DELETE trigger: audit log ----------
-- The web app runs  SELECT set_config('routewise.user_id', <id>, true)  inside each
-- transaction, so the trigger can record which signed-in user made the change.
CREATE TABLE IF NOT EXISTS delay_report_audit (
  audit_id   BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  report_id  BIGINT NOT NULL,              -- no FK: history must survive a DELETE
  action     VARCHAR(10) NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  old_delay  INTEGER,
  new_delay  INTEGER,
  old_cause  VARCHAR(200),
  new_cause  VARCHAR(200),
  changed_by BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_delay_report_audit_time ON delay_report_audit(changed_at DESC);

CREATE OR REPLACE FUNCTION audit_delay_report() RETURNS TRIGGER AS $$
DECLARE uid BIGINT := NULLIF(current_setting('routewise.user_id', true), '')::BIGINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO delay_report_audit(report_id, action, old_delay, old_cause, changed_by)
    VALUES (OLD.report_id, 'DELETE', OLD.delay_minutes, OLD.cause, uid);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO delay_report_audit(report_id, action, old_delay, new_delay, old_cause, new_cause, changed_by)
    VALUES (NEW.report_id, 'UPDATE', OLD.delay_minutes, NEW.delay_minutes, OLD.cause, NEW.cause, uid);
    RETURN NEW;
  ELSE
    INSERT INTO delay_report_audit(report_id, action, new_delay, new_cause, changed_by)
    VALUES (NEW.report_id, 'INSERT', NEW.delay_minutes, NEW.cause, uid);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_delay_report ON delay_reports;
CREATE TRIGGER trg_audit_delay_report
AFTER INSERT OR UPDATE OR DELETE ON delay_reports
FOR EACH ROW EXECUTE FUNCTION audit_delay_report();

-- ---------- STORED PROCEDURE: resolve all open alerts on a route ----------
-- Called from the Database page with:  CALL resolve_route_alerts('R-B', NULL);
CREATE OR REPLACE PROCEDURE resolve_route_alerts(p_route_code VARCHAR, INOUT p_resolved INTEGER DEFAULT NULL)
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM routes WHERE route_code = p_route_code) THEN
    RAISE EXCEPTION 'Route % does not exist', p_route_code;
  END IF;
  UPDATE delay_alerts da
  SET resolved = TRUE
  FROM delay_reports dr
  JOIN trips t  ON t.trip_id  = dr.trip_id
  JOIN routes r ON r.route_id = t.route_id
  WHERE da.report_id = dr.report_id
    AND r.route_code = p_route_code
    AND da.resolved = FALSE;
  GET DIAGNOSTICS p_resolved = ROW_COUNT;
END;
$$;

-- Privileges on the new objects for the database roles defined above
GRANT SELECT, INSERT, UPDATE, DELETE ON delay_report_audit TO routewise_admin;
GRANT SELECT ON delay_report_audit TO routewise_staff;
GRANT EXECUTE ON PROCEDURE resolve_route_alerts(VARCHAR, INTEGER) TO routewise_admin;

-- Demo in psql:
-- UPDATE delay_reports SET cause = '  heavy   RAIN ' WHERE report_id = 1;   -- BEFORE trigger cleans it
-- SELECT report_id, cause, updated_at FROM delay_reports WHERE report_id = 1;
-- SELECT * FROM delay_report_audit ORDER BY audit_id DESC LIMIT 5;      -- AFTER trigger logged it
-- CALL resolve_route_alerts('R-B', NULL);                               -- procedure
