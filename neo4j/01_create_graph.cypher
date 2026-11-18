// =====================================================================
// 01_create_graph.cypher  -  builds the RouteWise stop network in Neo4j
// Run in Neo4j Browser (Connect -> Query) against the configured database.
// It first deletes every node, so it can be re-run to reset the graph.
//   15 :Stop nodes        stopId = PostgreSQL stops.stop_id (shared key)
//   19 :SEGMENT edges     routeCode = PostgreSQL routes.route_code, travelMinutes
//   index stop_id_index on :Stop(stopId)
// =====================================================================
MATCH (n) DETACH DELETE n;
CREATE
 (s1:Stop {stopId:'1', name:'Majestic', area:'Gandhinagar'}),
 (s2:Stop {stopId:'2', name:'Mantri Square', area:'Malleshwaram'}),
 (s3:Stop {stopId:'3', name:'Yeshwanthpur', area:'Yeshwanthpur'}),
 (s4:Stop {stopId:'4', name:'Shivajinagar', area:'Shivajinagar'}),
 (s5:Stop {stopId:'5', name:'KR Market', area:'Chickpete'}),
 (s6:Stop {stopId:'6', name:'Lalbagh West Gate', area:'Lalbagh'}),
 (s7:Stop {stopId:'7', name:'Jayanagar 4th Block', area:'Jayanagar'}),
 (s8:Stop {stopId:'8', name:'BTM Layout', area:'BTM Layout'}),
 (s9:Stop {stopId:'9', name:'Koramangala', area:'Koramangala'}),
 (s10:Stop {stopId:'10', name:'Indiranagar', area:'Indiranagar'}),
 (s11:Stop {stopId:'11', name:'Domlur', area:'Domlur'}),
 (s12:Stop {stopId:'12', name:'Hebbal', area:'Hebbal'}),
 (s13:Stop {stopId:'13', name:'Banashankari', area:'Banashankari'}),
 (s14:Stop {stopId:'14', name:'Electronic City Phase 1', area:'Electronic City'}),
 (s15:Stop {stopId:'15', name:'Marathahalli', area:'Marathahalli'}),
 (s1)-[:SEGMENT {routeCode:'R-A', travelMinutes:12}]->(s2),
 (s2)-[:SEGMENT {routeCode:'R-A', travelMinutes:13}]->(s3),
 (s1)-[:SEGMENT {routeCode:'R-B', travelMinutes:10}]->(s5),
 (s5)-[:SEGMENT {routeCode:'R-B', travelMinutes:10}]->(s6),
 (s6)-[:SEGMENT {routeCode:'R-B', travelMinutes:15}]->(s7),
 (s7)-[:SEGMENT {routeCode:'R-B', travelMinutes:10}]->(s13),
 (s1)-[:SEGMENT {routeCode:'R-C', travelMinutes:10}]->(s4),
 (s4)-[:SEGMENT {routeCode:'R-C', travelMinutes:15}]->(s10),
 (s10)-[:SEGMENT {routeCode:'R-C', travelMinutes:10}]->(s11),
 (s7)-[:SEGMENT {routeCode:'R-D', travelMinutes:10}]->(s8),
 (s8)-[:SEGMENT {routeCode:'R-D', travelMinutes:10}]->(s9),
 (s9)-[:SEGMENT {routeCode:'R-D', travelMinutes:15}]->(s11),
 (s11)-[:SEGMENT {routeCode:'R-D', travelMinutes:18}]->(s15),
 (s4)-[:SEGMENT {routeCode:'R-E', travelMinutes:15}]->(s12),
 (s12)-[:SEGMENT {routeCode:'R-E', travelMinutes:15}]->(s3),
 // Additional links give the planner more than one possible journey.
 (s5)-[:SEGMENT {routeCode:'R-B', travelMinutes:12}]->(s7),
 (s11)-[:SEGMENT {routeCode:'R-C', travelMinutes:16}]->(s15),
 (s13)-[:SEGMENT {routeCode:'R-B', travelMinutes:20}]->(s14),
 (s8)-[:SEGMENT {routeCode:'R-D', travelMinutes:24}]->(s14);
CREATE INDEX stop_id_index IF NOT EXISTS FOR (s:Stop) ON (s.stopId);
