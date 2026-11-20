// =====================================================================
// 03_crud_demo.cypher  -  CREATE, READ, UPDATE, DELETE on the graph
// Uses a test stop (stopId 'DEMO') so the real network is unchanged at the end.
// Run each statement on its own in Neo4j Browser, in order.
// The web app does the same on Manage -> Route segments (app/api/admin/segments).
// =====================================================================

// ---------- CREATE ----------
// MERGE matches an existing node or creates it, so re-running does not duplicate it
MERGE (s:Stop {stopId:'DEMO'}) SET s.name = 'Silk Board', s.area = 'BTM Layout' RETURN s;

MATCH (a:Stop {stopId:'8'}), (b:Stop {stopId:'DEMO'})
MERGE (a)-[r:SEGMENT {routeCode:'R-D'}]->(b) SET r.travelMinutes = 8
RETURN a.name, r.routeCode, r.travelMinutes, b.name;

// ---------- READ ----------
MATCH (s:Stop {stopId:'DEMO'})<-[r:SEGMENT]-(a:Stop)
RETURN a.name AS from_stop, r.routeCode AS route, r.travelMinutes AS minutes, s.name AS to_stop;

// ---------- UPDATE ----------
MATCH (s:Stop {stopId:'DEMO'}) SET s.name = 'Central Silk Board' RETURN s;

MATCH (:Stop {stopId:'8'})-[r:SEGMENT {routeCode:'R-D'}]->(:Stop {stopId:'DEMO'})
SET r.travelMinutes = 12
RETURN r.routeCode, r.travelMinutes;

// ---------- DELETE ----------
// Delete one relationship
MATCH (:Stop {stopId:'8'})-[r:SEGMENT {routeCode:'R-D'}]->(:Stop {stopId:'DEMO'}) DELETE r;

// A plain DELETE fails while a node still has relationships (like ON DELETE RESTRICT);
// DETACH DELETE removes its relationships first (like CASCADE)
MATCH (s:Stop {stopId:'DEMO'}) DETACH DELETE s;

// Check: the demo node is gone (15 stops, plus any you added from the app)
MATCH (s:Stop) RETURN count(s) AS stops;
