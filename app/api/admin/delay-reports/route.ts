import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { requireRole } from "@/lib/auth";
export const runtime = "nodejs";

// READ: every delay report with its route, stop, reporter and alert (if the trigger created one).
export async function GET() {
  if (!(await requireRole("ADMIN", "DEPOT_STAFF"))) return NextResponse.json({ error: "Sign in as depot staff or admin." }, { status: 401 });
  try {
    const r = await pgPool.query(`
      SELECT dr.report_id, dr.trip_id, r.route_code, s.stop_name, dr.delay_minutes, dr.cause,
             dr.observed_at, dr.updated_at, u.full_name AS reported_by, (da.alert_id IS NOT NULL) AS has_alert
      FROM delay_reports dr
      JOIN trips t  ON t.trip_id  = dr.trip_id
      JOIN routes r ON r.route_id = t.route_id
      JOIN stops s  ON s.stop_id  = dr.stop_id
      LEFT JOIN users u        ON u.user_id   = dr.reported_by
      LEFT JOIN delay_alerts da ON da.report_id = dr.report_id
      ORDER BY dr.observed_at DESC, dr.report_id DESC`);
    return NextResponse.json({ reports: r.rows });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load delay reports." }, { status: 500 });
  }
}
