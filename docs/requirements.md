# RouteWise requirements

## Problem statement
Commuters may find it difficult to compare possible bus journeys by transfer count, while transit teams need a structured way to inspect reported delays. RouteWise is an academic prototype combining graph-based path exploration with relational delay analytics.

## Objectives
1. Represent a small Bengaluru-inspired sample bus network in Neo4j.
2. Use PostgreSQL for routes, stops, trips, stop times, users, and delay reports.
3. Rank candidate journeys by number of route changes, then estimated segment time.
4. Summarize route delay reports with SQL views and analytics queries.
5. Demonstrate database integrity, advanced SQL features, and two database paradigms.
6. Provide a Next.js interface for journey search, delay reporting, and analytics.

## Functional requirements
- Users can select an origin and destination and view candidate paths.
- The route planner displays ordered stops, route codes, transfer count, and approximate duration.
- Staff can submit delay records for a valid trip/stop combination.
- The dashboard displays delay summary by route.
- Database constraints reject invalid records.

## Non-functional requirements
- Database credentials are stored in environment variables.
- Server endpoints validate inputs and use parameterized SQL.
- The UI is responsive and reports failures without exposing secrets.
- Data labelled sample/simulated is not represented as live transit data.

## Roles
Planned roles: ADMIN, DEPOT_STAFF, COMMUTER. Commuters can register; passwords are hashed and sessions are signed in HTTP-only cookies. Delay reports require ADMIN or DEPOT_STAFF authorization. Staff/admin accounts are created by the provided script. Route/stop management UI is not yet included.

## Data source note
The bundled network and delay observations are illustrative sample data. Replace or supplement them with a permitted public dataset if available, and cite the source in the final report.
