// =====================================================================
// 02_queries.cypher  -  READ queries: path search, traversal, aggregation
// Run each query on its own in Neo4j Browser. Nothing here changes the graph.
// =====================================================================

// Q1 Counts: 15 stops, 19 segments
MATCH (s:Stop) RETURN count(s) AS stops;
MATCH ()-[r:SEGMENT]->() RETURN count(r) AS segments;

// Q2 The whole network as a picture
MATCH (a:Stop)-[r:SEGMENT]->(b:Stop) RETURN a, r, b;

// Q3 Journey search used by the app (GET /api/routes): every simple path of
//    1-8 segments from Majestic (1) to Koramangala (9), with route codes and minutes
MATCH p = (o:Stop {stopId:'1'})-[:SEGMENT*1..8]->(d:Stop {stopId:'9'})
WHERE all(n IN nodes(p) WHERE single(m IN nodes(p) WHERE m = n))
RETURN [n IN nodes(p) | n.name] AS stops,
       [r IN relationships(p) | r.routeCode] AS routes,
       reduce(t = 0, r IN relationships(p) | t + r.travelMinutes) AS minutes
ORDER BY minutes;

// Q4 Fewest hops between two stops
MATCH p = shortestPath((a:Stop {stopId:'1'})-[:SEGMENT*..8]->(b:Stop {stopId:'9'}))
RETURN [n IN nodes(p) | n.name] AS stops, length(p) AS hops;

// Q5 Aggregation: segments, total and average minutes per route
MATCH ()-[r:SEGMENT]->()
RETURN r.routeCode AS route, count(*) AS segments,
       sum(r.travelMinutes) AS total_minutes, round(avg(r.travelMinutes), 1) AS avg_minutes
ORDER BY route;

// Q6 Transfer hubs: stops served by more than one route
MATCH (s:Stop)-[r:SEGMENT]-()
WITH s, collect(DISTINCT r.routeCode) AS routes
WHERE size(routes) > 1
RETURN s.name AS stop, routes, size(routes) AS route_count
ORDER BY route_count DESC, stop;

// Q7 Stops reachable from Majestic within 2 segments
MATCH (a:Stop {stopId:'1'})-[:SEGMENT*1..2]->(b:Stop)
RETURN DISTINCT b.name AS reachable_stop
ORDER BY reachable_stop;
