import { NextRequest, NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
import { currentUser } from "@/lib/auth";
export const runtime = "nodejs";
// POST /api/delay-reports  (DEPOT_STAFF or ADMIN)
// One transaction: tag it with the user (for the audit trigger), check that the stop is on the
// trip, INSERT the report, COMMIT. The triggers (cause clean-up, alert, audit) run inside the same
// transaction, so the report, its alert and its audit row are saved together or not at all.
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user || !(user.role === "ADMIN" || user.role === "DEPOT_STAFF"))
    return NextResponse.json(
      { error: "Sign in with a depot staff or admin account to submit delay reports." },
      { status: 401 },
    );
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const tripId = Number(body.tripId),
    stopId = Number(body.stopId),
    delayMinutes = Number(body.delayMinutes),
    cause = String(body.cause || "Unknown").slice(0, 200);
  if (
    !Number.isInteger(tripId) ||
    !Number.isInteger(stopId) ||
    !Number.isInteger(delayMinutes) ||
    delayMinutes < 0 ||
    delayMinutes > 240
  )
    return NextResponse.json(
      { error: "Trip, stop, and a whole-number delay between 0 and 240 minutes are required." },
      { status: 400 },
    );
  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('routewise.user_id', $1, true)", [String(user.userId)]);
    const exists = await client.query(
      "SELECT 1 FROM trip_stop_times WHERE trip_id=$1 AND stop_id=$2 LIMIT 1",
      [tripId, stopId],
    );
    if (!exists.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "That stop is not part of the selected trip." }, { status: 400 });
    }
    const inserted = await client.query(
      `INSERT INTO delay_reports(trip_id,stop_id,reported_by,delay_minutes,cause,observed_at) VALUES($1,$2,$3,$4,$5,NOW()) RETURNING report_id`,
      [tripId, stopId, user.userId, delayMinutes, cause],
    );
    await client.query("COMMIT");
    return NextResponse.json({ ok: true, reportId: inserted.rows[0].report_id });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    return NextResponse.json(
      { error: "Database rejected the report. Check server logs and schema." },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
