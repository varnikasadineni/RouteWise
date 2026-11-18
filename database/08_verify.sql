-- =====================================================================
-- 08_verify.sql  -  Read-only check that the database is complete
-- Run after 01-04 (and optionally 07):
--   psql -U postgres -h localhost -d routewise -f database/08_verify.sql
-- =====================================================================
\pset pager off

\echo '== Tables and row counts =='
SELECT table_name,
       (xpath('/row/n/text()', query_to_xml(format('SELECT COUNT(*) AS n FROM %I', table_name), false, true, '')))[1]::text::int AS row_count
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

\echo '== Constraints per table (p = primary key, f = foreign key, u = unique, c = check) =='
SELECT conrelid::regclass AS table_name,
       COUNT(*) FILTER (WHERE contype = 'p') AS pk,
       COUNT(*) FILTER (WHERE contype = 'f') AS fk,
       COUNT(*) FILTER (WHERE contype = 'u') AS uniq,
       COUNT(*) FILTER (WHERE contype = 'c') AS checks
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
GROUP BY conrelid
ORDER BY 1::text;

\echo '== Secondary indexes =='
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public' AND indexname LIKE 'idx%'
ORDER BY tablename, indexname;

\echo '== Views, functions, procedures =='
SELECT 'VIEW' AS kind, table_name AS name FROM information_schema.views WHERE table_schema = 'public'
UNION ALL
SELECT CASE p.prokind WHEN 'p' THEN 'PROCEDURE'
                      ELSE CASE WHEN p.prorettype = 'trigger'::regtype THEN 'TRIGGER FUNCTION' ELSE 'FUNCTION' END END,
       p.proname
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
ORDER BY 1, 2;

\echo '== Triggers =='
SELECT trigger_name, action_timing AS timing,
       string_agg(event_manipulation, ' OR ' ORDER BY event_manipulation) AS events,
       event_object_table AS table_name
FROM information_schema.triggers
WHERE trigger_schema = 'public'
GROUP BY trigger_name, action_timing, event_object_table
ORDER BY timing DESC, trigger_name;

\echo '== Database roles and their table privileges =='
SELECT r.rolname AS role, c.relname AS table_or_view,
       concat_ws(', ',
         CASE WHEN has_table_privilege(r.oid, c.oid, 'SELECT') THEN 'SELECT' END,
         CASE WHEN has_table_privilege(r.oid, c.oid, 'INSERT') THEN 'INSERT' END,
         CASE WHEN has_table_privilege(r.oid, c.oid, 'UPDATE') THEN 'UPDATE' END,
         CASE WHEN has_table_privilege(r.oid, c.oid, 'DELETE') THEN 'DELETE' END) AS privileges
FROM pg_roles r
CROSS JOIN pg_class c
WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'v')
  AND r.rolname IN ('routewise_staff', 'routewise_commuter')
  AND (has_table_privilege(r.oid, c.oid, 'SELECT') OR has_table_privilege(r.oid, c.oid, 'INSERT')
    OR has_table_privilege(r.oid, c.oid, 'UPDATE') OR has_table_privilege(r.oid, c.oid, 'DELETE'))
ORDER BY 1, 2;
