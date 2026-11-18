-- =====================================================================
-- 06_queries.sql  -  Important queries
-- JOIN, LEFT JOIN, GROUP BY / HAVING / ORDER BY, aggregates, nested and
-- correlated subqueries, NOT EXISTS, CTE, recursive CTE, window function,
-- view, function, procedure, transaction, index use.
-- Read-only, except the procedure call, which is rolled back.
-- Run with psql:  psql -U postgres -h localhost -d routewise -f database/06_queries.sql
-- =====================================================================
\set ON_ERROR_STOP off
\pset pager off

\echo '== Q1  INNER JOIN + ORDER BY: stops of route R-B in order =='
SELECT r.route_code, rs.stop_sequence, s.stop_name
FROM route_stops rs
JOIN routes r ON r.route_id = rs.route_id
JOIN stops s  ON s.stop_id  = rs.stop_id
WHERE r.route_code = 'R-B'
ORDER BY rs.stop_sequence;

\echo '== Q2  GROUP BY + HAVING + aggregates: routes with at least 2 delay reports =='
SELECT r.route_code, COUNT(*) AS report_count,
       ROUND(AVG(dr.delay_minutes), 2) AS avg_delay, MAX(dr.delay_minutes) AS max_delay
FROM routes r
JOIN trips t          ON t.route_id = r.route_id
JOIN delay_reports dr ON dr.trip_id = t.trip_id
GROUP BY r.route_code
HAVING COUNT(*) >= 2
ORDER BY avg_delay DESC;

\echo '== Q3  LEFT JOIN: every bus and how many trips it runs (0 is kept) =='
SELECT b.registration_no, b.status, COUNT(t.trip_id) AS trips
FROM buses b
LEFT JOIN trips t ON t.bus_id = b.bus_id
GROUP BY b.bus_id, b.registration_no, b.status
ORDER BY b.registration_no;

\echo '== Q4  Nested subquery: stops where a delay was above the overall average =='
SELECT stop_name, area
FROM stops
WHERE stop_id IN (SELECT stop_id FROM delay_reports
                  WHERE delay_minutes > (SELECT AVG(delay_minutes) FROM delay_reports))
ORDER BY stop_name;

\echo '== Q5  Correlated subquery: the worst delay on each trip =='
SELECT r.route_code, t.trip_id, s.stop_name, dr.delay_minutes
FROM delay_reports dr
JOIN trips t  ON t.trip_id  = dr.trip_id
JOIN routes r ON r.route_id = t.route_id
JOIN stops s  ON s.stop_id  = dr.stop_id
WHERE dr.delay_minutes = (SELECT MAX(d2.delay_minutes)
                          FROM delay_reports d2
                          WHERE d2.trip_id = dr.trip_id)
ORDER BY dr.delay_minutes DESC;

\echo '== Q6  NOT EXISTS: stops that no route serves =='
SELECT s.stop_name
FROM stops s
WHERE NOT EXISTS (SELECT 1 FROM route_stops rs WHERE rs.stop_id = s.stop_id);

\echo '== Q7  CTE: stops whose average delay is 10 minutes or more =='
WITH stop_delay AS (
  SELECT stop_id, COUNT(*) AS reports, AVG(delay_minutes) AS avg_delay
  FROM delay_reports
  GROUP BY stop_id
)
SELECT s.stop_name, sd.reports, ROUND(sd.avg_delay, 1) AS avg_delay
FROM stop_delay sd
JOIN stops s ON s.stop_id = sd.stop_id
WHERE sd.avg_delay >= 10
ORDER BY sd.avg_delay DESC;

\echo '== Q8  Recursive CTE: every stop reachable from Majestic, and the fewest hops =='
WITH RECURSIVE reachable(stop_id, path, hops) AS (
  SELECT 1::BIGINT, ARRAY[1::BIGINT], 0
  UNION ALL
  SELECT nxt.stop_id, r.path || nxt.stop_id, r.hops + 1
  FROM reachable r
  JOIN route_stops cur ON cur.stop_id = r.stop_id
  JOIN route_stops nxt ON nxt.route_id = cur.route_id
                      AND nxt.stop_sequence = cur.stop_sequence + 1
  WHERE NOT nxt.stop_id = ANY(r.path) AND r.hops < 6
)
SELECT s.stop_name, MIN(hops) AS min_hops
FROM reachable rc
JOIN stops s ON s.stop_id = rc.stop_id
GROUP BY s.stop_name
ORDER BY min_hops, s.stop_name;

\echo '== Q9  View + window function: routes ranked by average delay =='
SELECT route_code, route_name, report_count, avg_delay_minutes,
       RANK() OVER (ORDER BY avg_delay_minutes DESC) AS delay_rank
FROM route_delay_summary;

\echo '== Q10 Stored function =='
SELECT * FROM get_route_delay_stats('R-B');

\echo '== Q11 Stored procedure inside a transaction (rolled back, so alerts stay open) =='
BEGIN;
SELECT r.route_code, da.alert_id, da.resolved
FROM delay_alerts da
JOIN delay_reports dr ON dr.report_id = da.report_id
JOIN trips t  ON t.trip_id  = dr.trip_id
JOIN routes r ON r.route_id = t.route_id
ORDER BY da.alert_id;
CALL resolve_route_alerts('R-B', NULL);
CALL resolve_route_alerts('R-Z', NULL);
ROLLBACK;

\echo '== Q12 Index use (seq scan disabled only to show the index on this small table) =='
SET enable_seqscan = off;
EXPLAIN SELECT * FROM delay_reports WHERE trip_id = 2 ORDER BY observed_at DESC;
RESET enable_seqscan;

\echo '== Q13 Database-level access control: staff cannot delete reports =='
BEGIN;
SET LOCAL ROLE routewise_staff;
SELECT COUNT(*) AS staff_can_read_reports FROM delay_reports;
DELETE FROM delay_reports WHERE report_id = 1;
ROLLBACK;
