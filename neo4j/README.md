# neo4j/

The RouteWise stop network as a property graph. Run the files in Neo4j Browser (Neo4j Desktop → Start the instance → Connect → Query).

| File | Purpose |
|---|---|
| `01_create_graph.cypher` | Deletes all nodes, then creates 15 `:Stop` nodes, 19 `:SEGMENT` relationships and the `stop_id_index` index |
| `02_queries.cypher` | Read queries: counts, the journey search the app uses, shortest path, aggregation per route, transfer hubs, reachability |
| `03_crud_demo.cypher` | CREATE (MERGE), READ, UPDATE (SET), DELETE / DETACH DELETE on a test stop; the graph ends unchanged |

If Neo4j Browser runs only the first statement of a file, turn on *Settings → Enable multi statement query editor*.

## Data model

| Element | Name | Properties |
|---|---|---|
| Node label | `:Stop` | `stopId` (string, equals PostgreSQL `stops.stop_id`), `name`, `area` |
| Relationship | `(:Stop)-[:SEGMENT]->(:Stop)` (directed) | `routeCode` (equals PostgreSQL `routes.route_code`), `travelMinutes` |
| Index | `stop_id_index` on `:Stop(stopId)` | used by every lookup by stop ID |

A **transfer** happens where `routeCode` changes between two consecutive segments of a path.

## How the application uses it

| Operation | Endpoint | Cypher |
|---|---|---|
| Journey search (Read) | `GET /api/routes` | `MATCH p = (o:Stop {stopId:$origin})-[:SEGMENT*1..8]->(d:Stop {stopId:$destination}) …` |
| List segments (Read) | `GET /api/admin/segments` | `MATCH (a:Stop)-[r:SEGMENT]->(b:Stop) RETURN elementId(r), …` |
| Add segment (Create) | `POST /api/admin/segments` | `MATCH (a), (b) MERGE (a)-[r:SEGMENT {routeCode:$routeCode}]->(b) SET r.travelMinutes = $m` |
| Change minutes (Update) | `PATCH /api/admin/segments` | `MATCH ()-[r:SEGMENT]->() WHERE elementId(r) = $id SET r.travelMinutes = $m` |
| Remove segment (Delete) | `DELETE /api/admin/segments?id=` | `MATCH ()-[r:SEGMENT]->() WHERE elementId(r) = $id DELETE r` |

All values are passed as parameters, never concatenated into the query text.
