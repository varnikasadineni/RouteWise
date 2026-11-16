import { NextRequest, NextResponse } from "next/server";
import neo4j from "neo4j-driver";
import { getNeo4jDriver, neoDatabase } from "@/lib/neo4j";
import { requireRole } from "@/lib/auth";
export const runtime = "nodejs";

// Neo4j Create / Read / Update / Delete for the :SEGMENT relationships between :Stop nodes.
// Read is open to ADMIN and DEPOT_STAFF; Create, Update and Delete are ADMIN only.

async function run(cypher: string, params: Record<string, unknown>) {
  const session = getNeo4jDriver().session({ database: neoDatabase });
  try { return await session.run(cypher, params); } finally { await session.close(); }
}
// Neo4j stores JS numbers as floats, so send whole minutes as Neo4j integers.
function toNum(v: unknown) { return neo4j.isInt(v) ? (v as { toNumber(): number }).toNumber() : Number(v); }
function minutes(v: unknown) { const m = Number(v); return Number.isInteger(m) && m >= 1 && m <= 180 ? m : null; }
function fail(e: unknown) { console.error(e); return NextResponse.json({ error: "Neo4j request failed. Check that Neo4j is running and create_graph.cypher has been run." }, { status: 500 }); }

// READ
export async function GET() {
  if (!(await requireRole("ADMIN", "DEPOT_STAFF"))) return NextResponse.json({ error: "Sign in as depot staff or admin." }, { status: 401 });
  try {
    const r = await run(
      `MATCH (a:Stop)-[r:SEGMENT]->(b:Stop)
       RETURN elementId(r) AS id, r.routeCode AS routeCode, r.travelMinutes AS travelMinutes,
              a.stopId AS fromId, a.name AS fromName, b.stopId AS toId, b.name AS toName
       ORDER BY routeCode, fromName`, {});
    return NextResponse.json({ segments: r.records.map(x => ({
      id: x.get("id"), routeCode: x.get("routeCode"), travelMinutes: toNum(x.get("travelMinutes")),
      fromId: x.get("fromId"), fromName: x.get("fromName"), toId: x.get("toId"), toName: x.get("toName") })) });
  } catch (e) { return fail(e); }
}

// CREATE
export async function POST(req: NextRequest) {
  if (!(await requireRole("ADMIN"))) return NextResponse.json({ error: "Only an admin can add segments." }, { status: 403 });
  let body; try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const fromId = String(body.fromId ?? ""), toId = String(body.toId ?? ""), routeCode = String(body.routeCode ?? "").trim().toUpperCase();
  const m = minutes(body.travelMinutes);
  if (!fromId || !toId || fromId === toId || !/^R-[A-Z0-9]+$/.test(routeCode) || m === null)
    return NextResponse.json({ error: "Choose two different stops, a route code like R-B, and 1 to 180 minutes." }, { status: 400 });
  try {
    const r = await run(
      `MATCH (a:Stop {stopId: $fromId}), (b:Stop {stopId: $toId})
       MERGE (a)-[r:SEGMENT {routeCode: $routeCode}]->(b)
       SET r.travelMinutes = $m
       RETURN elementId(r) AS id`, { fromId, toId, routeCode, m: neo4j.int(m) });
    if (!r.records.length) return NextResponse.json({ error: "One of those stops is not in the graph." }, { status: 404 });
    return NextResponse.json({ ok: true, id: r.records[0].get("id") }, { status: 201 });
  } catch (e) { return fail(e); }
}

// UPDATE
export async function PATCH(req: NextRequest) {
  if (!(await requireRole("ADMIN"))) return NextResponse.json({ error: "Only an admin can edit segments." }, { status: 403 });
  let body; try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const id = String(body.id ?? ""), m = minutes(body.travelMinutes);
  if (!id || m === null) return NextResponse.json({ error: "Travel time must be a whole number from 1 to 180." }, { status: 400 });
  try {
    const r = await run(
      `MATCH ()-[r:SEGMENT]->() WHERE elementId(r) = $id
       SET r.travelMinutes = $m
       RETURN r.travelMinutes AS travelMinutes`, { id, m: neo4j.int(m!) });
    if (!r.records.length) return NextResponse.json({ error: "Segment not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}

// DELETE
export async function DELETE(req: NextRequest) {
  if (!(await requireRole("ADMIN"))) return NextResponse.json({ error: "Only an admin can delete segments." }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "Missing segment id." }, { status: 400 });
  try {
    const r = await run(
      `MATCH ()-[r:SEGMENT]->() WHERE elementId(r) = $id
       DELETE r
       RETURN count(*) AS deleted`, { id });
    if (!toNum(r.records[0]?.get("deleted"))) return NextResponse.json({ error: "Segment not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}
