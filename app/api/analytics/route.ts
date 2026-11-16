import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // always query the database, never cache at build time
export async function GET(){try{const r=await pgPool.query(`SELECT route_code,route_name,report_count,avg_delay_minutes,max_delay_minutes FROM route_delay_summary ORDER BY avg_delay_minutes DESC, route_code`);return NextResponse.json({rows:r.rows});}catch(e){console.error(e);return NextResponse.json({error:"Could not load analytics. Run database/schema.sql, seed.sql, and advanced_queries.sql."},{status:500});}}
