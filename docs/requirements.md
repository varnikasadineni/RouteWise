# RouteWise requirements

## Problem statement
Commuters in Bengaluru find it hard to compare BMTC bus journeys: which buses connect two stops, how many changes each option needs, and whether a route is running late right now. Depot staff need one place to record delays, and administrators need to see who changed what. RouteWise combines graph-based path search (Neo4j) with relational delay records and analytics (PostgreSQL).

## Objectives
1. Store the bus network, schedules, users and delay observations in a normalised (3NF) PostgreSQL schema with full integrity constraints.
2. Represent stops and their connections as a Neo4j graph so that every path between two stops can be found with one query.
3. Recommend journeys by expected time: segment minutes + 5 minutes per transfer + delays reported on each route in the last 3 hours.
4. Summarise delays per route with a view, aggregates and a window function.
5. Enforce business rules in the database itself: constraints, triggers (alerts, audit, data cleaning), a function and a procedure.
6. Provide a Next.js interface with authentication and three roles, enforced both in the API and with PostgreSQL roles.

## Functional requirements
| ID | Requirement | Where |
|---|---|---|
| F1 | Any user can choose an origin and destination and see up to 3 ranked journeys with stops, routes, transfers, minutes and current delay | `/` → `GET /api/routes` |
| F2 | Any user can see each route's report count, average and maximum delay, refreshed every 5 s | `/dashboard` → view `route_delay_summary` |
| F3 | Commuters can register; everyone can sign in and out | `/register`, `/login` |
| F4 | Staff and admins can report a delay for a valid trip and stop | `/report-delay` → transaction |
| F5 | Staff and admins can edit a delay report; only admins can delete one | `/admin` (Manage) |
| F6 | Admins can add, edit and delete Neo4j route segments | `/admin` → Route segments |
| F7 | Admins can see all accounts, database role privileges, alerts and the audit log, and delete staff or commuter accounts | `/admin/database` |
| F8 | A delay of 15+ minutes raises an alert automatically; every change is audited with the user who made it | Triggers |
| F9 | The database rejects invalid data (range, reference, uniqueness, allowed values) | Constraints |

## Non-functional requirements
- Database credentials live only in `.env.local` (never committed); `.env.example` documents the variables.
- Every query is parameterised (SQL `$1`, Cypher `$origin`), which prevents injection.
- Passwords are stored as bcrypt hashes; sessions are signed, HTTP-only cookies that expire after 8 hours.
- Every protected request re-checks the account in the database, so a deleted account loses access immediately.
- Errors are reported without exposing secrets or stack traces.
- Sample data is labelled as illustrative, not live BMTC data.

## Roles
| Action | COMMUTER | DEPOT_STAFF | ADMIN |
|---|---|---|---|
| Plan journeys, view dashboard | yes | yes | yes |
| Report and edit delays | – | yes | yes |
| Delete delay reports | – | – | yes |
| Add / edit / delete graph segments | – | – | yes |
| Database page; delete staff/commuter accounts | – | – | yes |

Matching PostgreSQL roles: `routewise_commuter`, `routewise_staff`, `routewise_admin` (`database/04_access.sql`).

## Data source note
The bundled network and delay observations are illustrative sample data inspired by Bengaluru's BMTC network. They are not official or live BMTC data.
