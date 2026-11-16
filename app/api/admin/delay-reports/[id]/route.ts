import { NextRequest, NextResponse } from "next/server";
import { withAppUser } from "@/lib/db";
import { requireRole } from "@/lib/auth";
export const runtime = "nodejs";

function reportId(raw: string) { const id = Number(raw); return Number.isInteger(id) && id > 0 ? id : null; }

// UPDATE: change minutes and/or cause. ADMIN and DEPOT_STAFF.
// BEFORE trigger trg_normalize_delay_report cleans the cause and sets updated_at.
// AFTER triggers: trg_create_delay_alert (15+ min creates an alert) and trg_audit_delay_report (audit log).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireRole("ADMIN", "DEPOT_STAFF");
  if (!user) return NextResponse.json({ error: "Sign in as depot staff or admin." }, { status: 401 });
  const id = reportId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid report ID." }, { status: 400 });
  let body; try { body = await req.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  const delayMinutes = Number(body.delayMinutes);
  const cause = String(body.cause ?? "").slice(0, 200);
  if (!Number.isInteger(delayMinutes) || delayMinutes < 0 || delayMinutes > 240)
    return NextResponse.json({ error: "Delay must be a whole number from 0 to 240." }, { status: 400 });
  try {
    const r = await withAppUser(user.userId, c => c.query(
      "UPDATE delay_reports SET delay_minutes = $1, cause = $2 WHERE report_id = $3 RETURNING report_id, delay_minutes, cause, updated_at",
      [delayMinutes, cause, id]));
    if (!r.rowCount) return NextResponse.json({ error: `Report ${id} no longer exists. Another user may have deleted it.` }, { status: 404 });
    return NextResponse.json({ ok: true, report: r.rows[0] });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Database rejected the update." }, { status: 500 });
  }
}

// DELETE: ADMIN only. Its delay_alerts row goes too (ON DELETE CASCADE); the audit log keeps a record.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireRole("ADMIN");
  if (!user) return NextResponse.json({ error: "Only an admin can delete delay reports." }, { status: 403 });
  const id = reportId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid report ID." }, { status: 400 });
  try {
    const r = await withAppUser(user.userId, c => c.query("DELETE FROM delay_reports WHERE report_id = $1", [id]));
    if (!r.rowCount) return NextResponse.json({ error: `Report ${id} no longer exists. Another user may have deleted it.` }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not delete the report." }, { status: 500 });
  }
}
