// Example route search. Replace '1' and '9' with PostgreSQL stop IDs.
MATCH p=(o:Stop {stopId:'1'})-[:SEGMENT*1..8]->(d:Stop {stopId:'9'})
WITH p, nodes(p) AS ns, relationships(p) AS rs
WHERE all(n IN ns WHERE single(m IN ns WHERE m = n))
RETURN [n IN ns | n.name] AS stops,
       [r IN rs | r.routeCode] AS routeCodes,
       reduce(total=0,r IN rs | total + r.travelMinutes) AS segmentMinutes
LIMIT 30;

// Sanity-check graph nodes and segments:
// MATCH (s:Stop) RETURN count(s) AS stopCount;
// MATCH ()-[r:SEGMENT]->() RETURN r.routeCode, count(*) AS segmentCount ORDER BY r.routeCode;

// ---------- READ: shortest path by number of hops ----------
MATCH p = shortestPath((a:Stop {stopId:'1'})-[:SEGMENT*..8]->(b:Stop {stopId:'9'}))
RETURN [n IN nodes(p) | n.name] AS stops, length(p) AS hops;

// ---------- READ: transfer hubs (stops served by more than one route) ----------
MATCH (s:Stop)-[r:SEGMENT]-()
WITH s, collect(DISTINCT r.routeCode) AS routes
WHERE size(routes) > 1
RETURN s.name AS stop, routes ORDER BY size(routes) DESC;

// ---------- READ: aggregation per route ----------
MATCH ()-[r:SEGMENT]->()
RETURN r.routeCode AS route, count(*) AS segments, sum(r.travelMinutes) AS totalMinutes
ORDER BY route;

// ---------- CREATE: a new stop and a segment to it ----------
MERGE (s:Stop {stopId:'16'}) SET s.name = 'Silk Board', s.area = 'BTM Layout';
MATCH (a:Stop {stopId:'8'}), (b:Stop {stopId:'16'})
MERGE (a)-[r:SEGMENT {routeCode:'R-D'}]->(b) SET r.travelMinutes = 8;

// ---------- UPDATE: change a segment's travel time ----------
MATCH (:Stop {stopId:'6'})-[r:SEGMENT {routeCode:'R-B'}]->(:Stop {stopId:'7'})
SET r.travelMinutes = 18
RETURN r.routeCode, r.travelMinutes;

// ---------- UPDATE: rename a stop ----------
MATCH (s:Stop {stopId:'16'})
SET s.name = 'Central Silk Board'
RETURN s;

// ---------- DELETE: one segment, then the stop with all its segments ----------
MATCH (:Stop {stopId:'8'})-[r:SEGMENT {routeCode:'R-D'}]->(:Stop {stopId:'16'})
DELETE r;
MATCH (s:Stop {stopId:'16'})
DETACH DELETE s;
