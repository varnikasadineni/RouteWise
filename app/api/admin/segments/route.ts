import { NextRequest, NextResponse } from "next/server";
import neo4j from "neo4j-driver";
import { getNeo4jDriver, neoDatabase } from "@/lib/neo4j";
import { requireRole } from "@/lib/auth";
import { pgPool } from "@/lib/db";
import type { PoolClient } from "pg";
export const runtime = "nodejs";

// Neo4j Create / Read / Update / Delete for the :SEGMENT relationships between :Stop nodes.
// Read is open to ADMIN and DEPOT_STAFF; Create, Update and Delete are ADMIN only.

async function run(cypher: string, params: Record<string, unknown>) {
  const session = getNeo4jDriver().session({ database: neoDatabase });
  try {
    return await session.run(cypher, params);
  } finally {
    await session.close();
  }
}
// Neo4j stores JS numbers as floats, so send whole minutes as Neo4j integers.
function toNum(v: unknown) {
  return neo4j.isInt(v) ? (v as { toNumber(): number }).toNumber() : Number(v);
}
function minutes(v: unknown) {
  const m = Number(v);
  return Number.isInteger(m) && m >= 1 && m <= 180 ? m : null;
}
function fail(e: unknown) {
  console.error(e);
  return NextResponse.json(
    {
      error:
        "Neo4j request failed. Check that Neo4j is running and create_graph.cypher has been run.",
    },
    { status: 500 },
  );
}

// READ
export async function GET() {
  if (!(await requireRole("ADMIN", "DEPOT_STAFF")))
    return NextResponse.json(
      { error: "Sign in as depot staff or admin." },
      { status: 401 },
    );
  try {
    const r = await run(
      `MATCH (a:Stop)-[r:SEGMENT]->(b:Stop)
       RETURN elementId(r) AS id, r.routeCode AS routeCode, r.travelMinutes AS travelMinutes,
              a.stopId AS fromId, a.name AS fromName, b.stopId AS toId, b.name AS toName
       ORDER BY routeCode, fromName`,
      {},
    );
    return NextResponse.json({
      segments: r.records.map((x) => ({
        id: x.get("id"),
        routeCode: x.get("routeCode"),
        travelMinutes: toNum(x.get("travelMinutes")),
        fromId: x.get("fromId"),
        fromName: x.get("fromName"),
        toId: x.get("toId"),
        toName: x.get("toName"),
      })),
    });
  } catch (e) {
    return fail(e);
  }
}

// CREATE
// The admin types the two stop names (any place, not only the existing ones).
// 1. PostgreSQL: find each stop by name, or INSERT it into stops (so it also appears in the journey planner).
// 2. Neo4j: MERGE the two :Stop nodes (same stopId as PostgreSQL) and MERGE the :SEGMENT between them.
// PostgreSQL COMMITs only after Neo4j succeeds, so a failed Neo4j write leaves no half-added stop.
function stopName(v: unknown) {
  const n = String(v ?? "")
    .trim()
    .replace(/\s+/g, " ");
  return n.length >= 2 && n.length <= 120 ? n : null;
}
async function findOrCreateStop(c: PoolClient, name: string) {
  const found = await c.query(
    "SELECT stop_id::text AS id, stop_name AS name, area FROM stops WHERE lower(stop_name) = lower($1) LIMIT 1",
    [name],
  );
  if (found.rowCount) return { ...found.rows[0], created: false };
  // stop_code must be unique: insert with a temporary code, then set it to BLR + the new id (BLR016 ...)
  const ins = await c.query(
    `INSERT INTO stops(stop_code, stop_name, area) VALUES ('TMP-' || substr(md5(random()::text), 1, 20), $1, $1)
     RETURNING stop_id`,
    [name],
  );
  const id = ins.rows[0].stop_id;
  await c.query(
    "UPDATE stops SET stop_code = 'BLR' || lpad(stop_id::text, 3, '0') WHERE stop_id = $1",
    [id],
  );
  return { id: String(id), name, area: name, created: true };
}

export async function POST(req: NextRequest) {
  if (!(await requireRole("ADMIN")))
    return NextResponse.json(
      { error: "Only an admin can add segments." },
      { status: 403 },
    );
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const fromName = stopName(body.fromName),
    toName = stopName(body.toName),
    routeCode = String(body.routeCode ?? "")
      .trim()
      .toUpperCase();
  const m = minutes(body.travelMinutes);
  if (!fromName || !toName || fromName.toLowerCase() === toName.toLowerCase())
    return NextResponse.json(
      { error: "Type two different stop names (2 to 120 characters)." },
      { status: 400 },
    );
  if (!/^R-[A-Z0-9]+$/.test(routeCode) || m === null)
    return NextResponse.json(
      { error: "Use a route code like R-B and 1 to 180 minutes." },
      { status: 400 },
    );

  const c = await pgPool.connect();
  try {
    await c.query("BEGIN");
    const a = await findOrCreateStop(c, fromName);
    const b = await findOrCreateStop(c, toName);
    const r = await run(
      `MERGE (a:Stop {stopId: $aId}) ON CREATE SET a.name = $aName, a.area = $aArea
       MERGE (b:Stop {stopId: $bId}) ON CREATE SET b.name = $bName, b.area = $bArea
       MERGE (a)-[r:SEGMENT {routeCode: $routeCode}]->(b)
       SET r.travelMinutes = $m
       RETURN elementId(r) AS id`,
      {
        aId: a.id,
        aName: a.name,
        aArea: a.area,
        bId: b.id,
        bName: b.name,
        bArea: b.area,
        routeCode,
        m: neo4j.int(m),
      },
    );
    await c.query("COMMIT");
    const added = [a, b].filter((s) => s.created).map((s) => s.name);
    return NextResponse.json(
      {
        ok: true,
        id: r.records[0].get("id"),
        newStops: added,
        from: a.name,
        to: b.name,
      },
      { status: 201 },
    );
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    return fail(e);
  } finally {
    c.release();
  }
}

// UPDATE
export async function PATCH(req: NextRequest) {
  if (!(await requireRole("ADMIN")))
    return NextResponse.json(
      { error: "Only an admin can edit segments." },
      { status: 403 },
    );
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const id = String(body.id ?? ""),
    m = minutes(body.travelMinutes);
  if (!id || m === null)
    return NextResponse.json(
      { error: "Travel time must be a whole number from 1 to 180." },
      { status: 400 },
    );
  try {
    const r = await run(
      `MATCH ()-[r:SEGMENT]->() WHERE elementId(r) = $id
       SET r.travelMinutes = $m
       RETURN r.travelMinutes AS travelMinutes`,
      { id, m: neo4j.int(m!) },
    );
    if (!r.records.length)
      return NextResponse.json(
        { error: "Segment not found." },
        { status: 404 },
      );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

// DELETE
export async function DELETE(req: NextRequest) {
  if (!(await requireRole("ADMIN")))
    return NextResponse.json(
      { error: "Only an admin can delete segments." },
      { status: 403 },
    );
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!id)
    return NextResponse.json({ error: "Missing segment id." }, { status: 400 });
  try {
    const r = await run(
      `MATCH ()-[r:SEGMENT]->() WHERE elementId(r) = $id
       DELETE r
       RETURN count(*) AS deleted`,
      { id },
    );
    if (!toNum(r.records[0]?.get("deleted")))
      return NextResponse.json(
        { error: "Segment not found." },
        { status: 404 },
      );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
