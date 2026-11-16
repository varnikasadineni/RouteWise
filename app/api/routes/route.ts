import { NextRequest, NextResponse } from "next/server";
import neo4j, { Session } from "neo4j-driver";
import { getNeo4jDriver, neoDatabase } from "@/lib/neo4j";
import { pgPool } from "@/lib/db";
import { rankJourneys, Candidate, LIVE_DELAY_WINDOW_HOURS } from "@/lib/journeys";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const toNum = (v: unknown) => (neo4j.isInt(v) ? (v as { toNumber(): number }).toNumber() : Number(v));

// GET /api/routes?origin=1&destination=9
// 1. Neo4j: every simple path of up to 8 segments between the two stops.
// 2. PostgreSQL: current delay per route (average of reports from the last few hours).
// 3. Rank by scheduled time + transfer allowance + current delay (lib/journeys.ts).
export async function GET(req: NextRequest) {
  const origin = Number(req.nextUrl.searchParams.get("origin"));
  const destination = Number(req.nextUrl.searchParams.get("destination"));
  if (!Number.isInteger(origin) || !Number.isInteger(destination) || origin <= 0 || destination <= 0)
    return NextResponse.json({ error: "Choose valid origin and destination stops." }, { status: 400 });
  if (origin === destination)
    return NextResponse.json({ journeys: [{ stops: ["Same starting and destination stop"], routeCodes: [], legs: [], transfers: 0, segmentMinutes: 0, scheduledMinutes: 0, delayMinutes: 0, delayedLegs: [], estimatedMinutes: 0, label: "Same stop" }] });

  let session: Session | undefined;
  try {
    session = getNeo4jDriver().session({ database: neoDatabase });
    const result = await session.run(
      `MATCH p = (o:Stop {stopId: $origin})-[:SEGMENT*1..8]->(d:Stop {stopId: $destination})
       WITH p, nodes(p) AS ns, relationships(p) AS rs
       WHERE all(n IN ns WHERE single(m IN ns WHERE m = n))
       RETURN [n IN ns | n.name] AS stops,
              [r IN rs | r.routeCode] AS routeCodes,
              reduce(total = 0, r IN rs | total + coalesce(r.travelMinutes, 8)) AS segmentMinutes
       LIMIT 200`,
      { origin: String(origin), destination: String(destination) });
    const candidates: Candidate[] = result.records.map(rec => ({
      stops: rec.get("stops") as string[],
      routeCodes: rec.get("routeCodes") as string[],
      segmentMinutes: toNum(rec.get("segmentMinutes")),
    }));

    const routeCodes = [...new Set(candidates.flatMap(c => c.routeCodes))];
    const liveDelay: Record<string, number> = {};
    if (routeCodes.length) {
      const delays = await pgPool.query(
        `SELECT r.route_code, AVG(dr.delay_minutes) AS live_delay
         FROM routes r
         JOIN trips t ON t.route_id = r.route_id
         JOIN delay_reports dr ON dr.trip_id = t.trip_id
         WHERE r.route_code = ANY($1::text[])
           AND dr.observed_at >= NOW() - make_interval(hours => $2)
         GROUP BY r.route_code`,
        [routeCodes, LIVE_DELAY_WINDOW_HOURS]);
      for (const row of delays.rows) liveDelay[row.route_code] = Number(row.live_delay);
    }

    return NextResponse.json({ journeys: rankJourneys(candidates, liveDelay), liveDelayWindowHours: LIVE_DELAY_WINDOW_HOURS });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Route search failed. Verify Neo4j is running and neo4j/create_graph.cypher has been executed." }, { status: 500 });
  } finally {
    await session?.close();
  }
}
