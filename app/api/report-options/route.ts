import { NextResponse } from "next/server";
import { pgPool } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // always query the database, never cache at build time
export async function GET(){try{const r=await pgPool.query(`SELECT t.trip_id,r.route_code,s.stop_id,s.stop_name FROM trips t JOIN routes r ON r.route_id=t.route_id JOIN trip_stop_times tst ON tst.trip_id=t.trip_id JOIN stops s ON s.stop_id=tst.stop_id ORDER BY t.trip_id,tst.stop_sequence`);return NextResponse.json({options:r.rows});}catch(e){console.error(e);return NextResponse.json({error:"Could not load trips."},{status:500});}}
