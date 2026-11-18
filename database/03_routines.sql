-- =====================================================================
-- 03_routines.sql  -  View, stored function, stored procedure, triggers
-- Run after 01_schema.sql and 02_seed.sql. Safe to run again.
--
--   VIEW       route_delay_summary          report count / avg / max delay per route
--   FUNCTION   get_route_delay_stats(code)  the same summary for one route
--   PROCEDURE  resolve_route_alerts(code)   marks a route's open alerts resolved
--   TRIGGERS on delay_reports:
--     trg_normalize_delay_report  BEFORE INSERT/UPDATE         tidy cause, stamp updated_at
--     trg_create_delay_alert      AFTER  INSERT/UPDATE         alert when delay >= 15 min
--     trg_audit_delay_report      AFTER  INSERT/UPDATE/DELETE  write delay_report_audit
--
-- Trigger functions are SECURITY DEFINER, so a limited role (routewise_staff)
-- can insert a delay report and the trigger can still write alerts and audit rows.
-- =====================================================================

-- ---------- VIEW ----------
-- LEFT JOIN keeps routes that have no delay reports (they show 0).
CREATE OR REPLACE VIEW route_delay_summary AS
SELECT r.route_id, r.route_code, r.route_name,
       COUNT(dr.report_id)::INTEGER                AS report_count,
       ROUND(COALESCE(AVG(dr.delay_minutes),0),2)  AS avg_delay_minutes,
       COALESCE(MAX(dr.delay_minutes),0)::INTEGER  AS max_delay_minutes
FROM routes r
LEFT JOIN trips t          ON t.route_id = r.route_id
LEFT JOIN delay_reports dr ON dr.trip_id = t.trip_id
GROUP BY r.route_id, r.route_code, r.route_name;

-- ---------- STORED FUNCTION ----------
-- Read-only (STABLE); returns a table, so it can be used inside SELECT.
CREATE OR REPLACE FUNCTION get_route_delay_stats(p_route_code VARCHAR)
RETURNS TABLE(route_code VARCHAR, route_name VARCHAR, report_count BIGINT, avg_delay NUMERIC, max_delay INTEGER)
LANGUAGE SQL STABLE AS $$
  SELECT r.route_code, r.route_name, COUNT(dr.report_id),
         ROUND(COALESCE(AVG(dr.delay_minutes),0),2), COALESCE(MAX(dr.delay_minutes),0)::INTEGER
  FROM routes r
  LEFT JOIN trips t          ON t.route_id = r.route_id
  LEFT JOIN delay_reports dr ON dr.trip_id = t.trip_id
  WHERE r.route_code = p_route_code
  GROUP BY r.route_code, r.route_name;
$$;

-- ---------- BEFORE INSERT/UPDATE trigger: clean the cause text, stamp edits ----------
-- "  signal   FAILURE " is stored as "Signal failure"; a blank cause becomes "Unknown".
-- A BEFORE trigger can change NEW before the row is written; an AFTER trigger cannot.
CREATE OR REPLACE FUNCTION normalize_delay_report() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cleaned TEXT;
BEGIN
  cleaned := regexp_replace(btrim(coalesce(NEW.cause, '')), '\s+', ' ', 'g');
  IF cleaned = '' THEN cleaned := 'Unknown'; END IF;
  NEW.cause := upper(left(cleaned, 1)) || lower(substr(cleaned, 2));
  IF TG_OP = 'UPDATE' THEN NEW.updated_at := NOW(); END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_normalize_delay_report ON delay_reports;
CREATE TRIGGER trg_normalize_delay_report
BEFORE INSERT OR UPDATE ON delay_reports
FOR EACH ROW EXECUTE FUNCTION normalize_delay_report();

-- ---------- AFTER INSERT/UPDATE trigger: high-delay alert ----------
CREATE OR REPLACE FUNCTION create_delay_alert() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.delay_minutes >= 15 THEN
    INSERT INTO delay_alerts(report_id, alert_message)
    VALUES (NEW.report_id, format('High delay: %s minutes at stop ID %s on trip ID %s',
                                  NEW.delay_minutes, NEW.stop_id, NEW.trip_id))
    ON CONFLICT (report_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_create_delay_alert ON delay_reports;
CREATE TRIGGER trg_create_delay_alert
AFTER INSERT OR UPDATE OF delay_minutes, stop_id, trip_id ON delay_reports
FOR EACH ROW EXECUTE FUNCTION create_delay_alert();

-- ---------- AFTER INSERT/UPDATE/DELETE trigger: audit log ----------
-- The web app runs  SELECT set_config('routewise.user_id', '<id>', true)  inside each
-- transaction (lib/db.ts withAppUser), so the trigger can record which user made the change.
CREATE OR REPLACE FUNCTION audit_delay_report() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
$$;
DROP TRIGGER IF EXISTS trg_audit_delay_report ON delay_reports;
CREATE TRIGGER trg_audit_delay_report
AFTER INSERT OR UPDATE OR DELETE ON delay_reports
FOR EACH ROW EXECUTE FUNCTION audit_delay_report();

-- ---------- STORED PROCEDURE: resolve all open alerts on a route ----------
-- CALL resolve_route_alerts('R-B', NULL);   -> returns p_resolved = number of alerts resolved
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

-- ---------- Backfill ----------
-- 02_seed.sql runs before the alert trigger exists, so create alerts for
-- seeded reports of 15+ minutes as well.
INSERT INTO delay_alerts(report_id, alert_message)
SELECT report_id, format('High delay: %s minutes at stop ID %s on trip ID %s', delay_minutes, stop_id, trip_id)
FROM delay_reports WHERE delay_minutes >= 15
ON CONFLICT (report_id) DO NOTHING;
