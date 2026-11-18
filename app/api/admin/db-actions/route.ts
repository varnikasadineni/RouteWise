import { NextRequest, NextResponse } from "next/server";
import { pgPool, withAppUser } from "@/lib/db";
import { requireRole } from "@/lib/auth";
export const runtime = "nodejs";

// ADMIN only. Runs the stored function or the stored procedure for one route.
export async function POST(req: NextRequest) {
  const user = await requireRole("ADMIN");
  if (!user) return NextResponse.json({ error: "Only an admin can run database routines." }, { status: 403 });
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const routeCode = String(body.routeCode ?? "");
  if (!/^R-[A-Z0-9]+$/.test(routeCode))
    return NextResponse.json({ error: "Choose a route." }, { status: 400 });
  try {
    if (body.action === "function") {
      const sql = "SELECT * FROM get_route_delay_stats($1)";
      const r = await pgPool.query(sql, [routeCode]);
      return NextResponse.json({ sql: sql.replace("$1", `'${routeCode}'`), rows: r.rows });
    }
    if (body.action === "procedure") {
      const sql = "CALL resolve_route_alerts($1, NULL)";
      const r = await withAppUser(user.userId, (c) => c.query(sql, [routeCode]));
      return NextResponse.json({ sql: sql.replace("$1", `'${routeCode}'`), rows: r.rows });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Routine failed." }, { status: 500 });
  }
}
