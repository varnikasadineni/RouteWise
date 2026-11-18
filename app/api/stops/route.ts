import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // always query the database, never cache at build time
export async function GET() {
  try {
    const r = await pgPool.query("SELECT stop_id, stop_name, area FROM stops ORDER BY stop_name");
    return NextResponse.json({ stops: r.rows });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not load stops. Check PostgreSQL connection and seed data." },
      { status: 500 },
    );
  }
}
