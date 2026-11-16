import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { requireRole } from "@/lib/auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ADMIN only. Everything here is read live from PostgreSQL's system catalog,
// so any role, grant, trigger or routine added in psql shows up on the next refresh.
export async function GET() {
  if (!(await requireRole("ADMIN"))) return NextResponse.json({ error: "Only an admin can view database users and privileges." }, { status: 403 });
  try {
    const [appUsers, roles, privileges, triggers, routines, alerts, audit, routes] = await Promise.all([
      pgPool.query(`
        SELECT u.user_id, u.full_name, u.email, u.role, u.created_at, COUNT(dr.report_id)::INT AS reports
        FROM users u LEFT JOIN delay_reports dr ON dr.reported_by = u.user_id
        GROUP BY u.user_id ORDER BY u.user_id`),
      pgPool.query(`
        SELECT r.rolname, r.rolsuper, r.rolcanlogin, r.rolcreatedb, r.rolcreaterole,
               ARRAY(SELECT g.rolname::text FROM pg_auth_members m JOIN pg_roles g ON g.oid = m.roleid
                     WHERE m.member = r.oid ORDER BY 1) AS member_of  -- ::text so the driver returns a JS array
        FROM pg_roles r
        WHERE r.rolname !~ '^pg_'
        ORDER BY r.rolsuper DESC, r.rolname`),
      pgPool.query(`
        SELECT r.rolname AS role, c.relname AS object, CASE c.relkind WHEN 'v' THEN 'view' ELSE 'table' END AS kind,
               has_table_privilege(r.oid, c.oid, 'SELECT') AS sel,
               has_table_privilege(r.oid, c.oid, 'INSERT') AS ins,
               has_table_privilege(r.oid, c.oid, 'UPDATE') AS upd,
               has_table_privilege(r.oid, c.oid, 'DELETE') AS del
        FROM pg_roles r
        CROSS JOIN pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r','v')
          AND r.rolname !~ '^pg_' AND NOT r.rolsuper
          AND (has_table_privilege(r.oid, c.oid, 'SELECT') OR has_table_privilege(r.oid, c.oid, 'INSERT')
            OR has_table_privilege(r.oid, c.oid, 'UPDATE') OR has_table_privilege(r.oid, c.oid, 'DELETE'))
        ORDER BY r.rolname, c.relname`),
      pgPool.query(`
        SELECT trigger_name, action_timing, string_agg(event_manipulation, ' OR ' ORDER BY event_manipulation) AS events,
               event_object_table AS table_name, action_orientation
        FROM information_schema.triggers
        WHERE trigger_schema = 'public'
        GROUP BY trigger_name, action_timing, event_object_table, action_orientation
        ORDER BY event_object_table, action_timing DESC, trigger_name`),
      pgPool.query(`
        SELECT p.proname AS name,
               CASE p.prokind WHEN 'p' THEN 'PROCEDURE' WHEN 'f' THEN
                 CASE WHEN p.prorettype = 'trigger'::regtype THEN 'TRIGGER FUNCTION' ELSE 'FUNCTION' END END AS kind,
               pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.prokind IN ('f','p')
        ORDER BY kind, name`),
      pgPool.query(`
        SELECT da.alert_id, da.report_id, r.route_code, da.alert_message, da.created_at, da.resolved
        FROM delay_alerts da
        JOIN delay_reports dr ON dr.report_id = da.report_id
        JOIN trips t ON t.trip_id = dr.trip_id
        JOIN routes r ON r.route_id = t.route_id
        ORDER BY da.created_at DESC, da.alert_id DESC`),
      pgPool.query(`
        SELECT a.audit_id, a.report_id, a.action, a.old_delay, a.new_delay, a.old_cause, a.new_cause,
               a.changed_at, COALESCE(u.full_name || ' (' || u.role || ')', 'psql / seed') AS changed_by
        FROM delay_report_audit a LEFT JOIN users u ON u.user_id = a.changed_by
        ORDER BY a.audit_id DESC LIMIT 25`),
      pgPool.query(`SELECT route_code, route_name FROM routes ORDER BY route_code`),
    ]);
    return NextResponse.json({
      appUsers: appUsers.rows, roles: roles.rows, privileges: privileges.rows, triggers: triggers.rows,
      routines: routines.rows, alerts: alerts.rows, audit: audit.rows, routes: routes.rows,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not read the database catalog. Run database/advanced_queries.sql if the audit table is missing." }, { status: 500 });
  }
}
