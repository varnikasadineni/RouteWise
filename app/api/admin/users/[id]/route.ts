import { NextRequest, NextResponse } from "next/server";
import { pgPool, withAppUser } from "@/lib/db";
import { requireRole } from "@/lib/auth";
export const runtime = "nodejs";

// DELETE /api/admin/users/:id  (ADMIN only)
// Deletes a DEPOT_STAFF or COMMUTER account. Admin accounts and your own account cannot be deleted here.
// Foreign keys use ON DELETE SET NULL, so the user's delay reports, complaints and audit rows are kept
// with no reporter. That SET NULL is an UPDATE on delay_reports, so the triggers record it too.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireRole("ADMIN");
  if (!admin) return NextResponse.json({ error: "Only an admin can delete accounts." }, { status: 403 });
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid user ID." }, { status: 400 });
  if (id === admin.userId) return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
  try {
    const r = await withAppUser(admin.userId, c => c.query(
      "DELETE FROM users WHERE user_id = $1 AND role IN ('DEPOT_STAFF','COMMUTER') RETURNING full_name, email, role", [id]));
    if (r.rowCount) return NextResponse.json({ ok: true, deleted: r.rows[0] });
    const exists = await pgPool.query("SELECT role FROM users WHERE user_id = $1", [id]);
    if (exists.rowCount) return NextResponse.json({ error: "Admin accounts cannot be deleted from this page." }, { status: 403 });
    return NextResponse.json({ error: `Account ${id} no longer exists. Another admin may have deleted it.` }, { status: 404 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not delete the account." }, { status: 500 });
  }
}
