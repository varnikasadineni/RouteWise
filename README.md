# RouteWise
**RouteWise: A Graph-Based Bengaluru BMTC Bus Route Planning and Delay Analytics System**

A DBMS Level 3 project using Next.js 14, PostgreSQL and Neo4j. The stop names, schedules and delays are illustrative sample data inspired by Bengaluru; this is not a live BMTC service.

## Features
- **Journey planner** (`/`): Neo4j finds paths between two stops. Each is scored as scheduled segment time + 5 min per transfer + the average delay reported on each route in the last 3 hours (from PostgreSQL), and the fastest is recommended. A fresh delay report can switch the recommendation: try Majestic → Yeshwanthpur, then report a 30-minute delay on R-A (Trip 1) and search again.
- **Delay dashboard** (`/dashboard`): route delay summary from the `route_delay_summary` view.
- **Report a delay** (`/report-delay`): staff/admin insert a delay report inside a transaction.
- **Manage** (`/admin`): update and delete delay reports (PostgreSQL) and create, update and delete route segments (Neo4j).
- **Database** (`/admin/database`, admin only): live view of application accounts, PostgreSQL roles and their table privileges, triggers, functions and procedures, delay alerts and the audit log. Runs the stored function `get_route_delay_stats` and the stored procedure `resolve_route_alerts` from the UI.
- **Multi-user**: the Manage, Dashboard and Database pages refresh every 5 seconds, so a change or delete by one user appears for every other user. Each change is written to `delay_report_audit` (by an AFTER trigger) with the user who made it.
- **Triggers**: `trg_normalize_delay_report` (BEFORE INSERT/UPDATE: tidies the cause text, stamps `updated_at`), `trg_create_delay_alert` (AFTER: alert for 15+ minutes), `trg_audit_delay_report` (AFTER INSERT/UPDATE/DELETE: audit log).
- **Accounts**: commuter self-registration, login with bcrypt-hashed passwords and a signed HTTP-only session cookie.

### Roles
| Action | COMMUTER | DEPOT_STAFF | ADMIN |
|---|---|---|---|
| Plan journeys, view dashboard | yes | yes | yes |
| Submit / edit delay reports | – | yes | yes |
| Delete delay reports | – | – | yes |
| Add / edit / delete Neo4j segments | – | – | yes |

The database also has matching PostgreSQL roles (`routewise_admin`, `routewise_staff`, `routewise_commuter`) with GRANTs, in `database/advanced_queries.sql`.

## Prerequisites (Windows)
| Software | Version | Get it from |
|---|---|---|
| Node.js | 20 LTS or newer | nodejs.org |
| PostgreSQL | 15 or 16 (includes `psql` and pgAdmin) | postgresql.org/download/windows |
| Neo4j | 5.x: Neo4j Desktop (easiest), or the free AuraDB cloud database | neo4j.com/download |
| Git | any | git-scm.com |

Remember the password you set for the `postgres` user during installation, and the password you set for your Neo4j database.

## Setup
Run these in PowerShell from the project folder.

### 1. PostgreSQL
If `psql` is not recognised, use the full path, e.g. `& "C:\Program Files\PostgreSQL\16\bin\psql.exe"`.
```powershell
psql -U postgres -c "CREATE DATABASE routewise;"
psql -U postgres -d routewise -f database/schema.sql
psql -U postgres -d routewise -f database/seed.sql
psql -U postgres -d routewise -f database/advanced_queries.sql
```
All three files are safe to run again. `advanced_queries.sql` creates the view, trigger, function and roles, and prints the sample query results.

### 2. Neo4j
1. In Neo4j Desktop, create a local DBMS (version 5.x), set a password and click **Start**.
2. Click **Open** to launch Neo4j Browser.
3. Paste the whole of `neo4j/create_graph.cypher` and run it. If only the first statement runs, enable *Settings → Enable multi statement query editor*.
4. Check: `MATCH (s:Stop) RETURN count(s)` should return 15.

### 3. Environment file
```powershell
copy .env.example .env.local
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Edit `.env.local`: put your PostgreSQL password in `DATABASE_URL`, your Neo4j password in `NEO4J_PASSWORD`, and the random string printed above in `SESSION_SECRET`. If a password contains `@`, `#`, `/` or `:`, write it URL-encoded in `DATABASE_URL` (`@` becomes `%40`). Never commit `.env.local`.

### 4. Install and run
```powershell
npm install
npm run dev
```
Open http://localhost:3000.

### 5. Create staff and admin accounts
Public registration only creates commuters. Create the others with the script (it asks for a password):
```powershell
$env:DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/routewise"
node scripts/create-user.mjs admin@routewise.local "Project Admin" ADMIN
node scripts/create-user.mjs staff@routewise.local "Depot Staff" DEPOT_STAFF
```

## Testing
Work through `docs/test-cases.md` (T1–T24) and record pass/fail with screenshots. A suggested demo order:
1. Register a commuter, sign in, plan Majestic → Koramangala (1 transfer, R-B then R-D).
2. Sign in as staff, report a 10-minute delay; open the dashboard and see the average change.
3. In **Manage**, raise that delay to 20; the **Alert** chip appears (trigger).
4. Sign in as admin, delete the report; the alert goes too (ON DELETE CASCADE).
5. In **Manage → Route segments**, change KR Market → Jayanagar 4th Block to 40 minutes, then search Majestic → Koramangala again: the ranking changes. Delete a segment and the path disappears.
6. In psql, show the SQL from `database/advanced_queries.sql` (view, window function, CTEs, recursive CTE, roles).

## Troubleshooting
| Symptom | Cause / fix |
|---|---|
| `ECONNREFUSED 127.0.0.1:5432` | PostgreSQL is not running or `DATABASE_URL` is wrong. Start the *postgresql-x64-16* service (Services app) and check the password and port. |
| `password authentication failed` | Wrong password in `DATABASE_URL`, or it needs URL-encoding. |
| Route search: "Verify Neo4j is running" | Start the DBMS in Neo4j Desktop; check `NEO4J_URI` (`neo4j://localhost:7687`) and the password; run `create_graph.cypher`. |
| `SESSION_SECRET must be set` | Add a 32+ character `SESSION_SECRET` to `.env.local` and restart `npm run dev`. |
| `relation "route_delay_summary" does not exist` | Run `database/advanced_queries.sql`. |
| Duplicate key error when adding stops/routes | Re-run `database/seed.sql` (it now resets the ID counters). |

## Project structure
```
app/            pages (/, dashboard, report-delay, admin, login, register) and API routes (app/api/*)
lib/            db.ts (PostgreSQL pool), neo4j.ts (driver), auth.ts (sessions, roles)
database/       schema.sql, seed.sql, advanced_queries.sql
neo4j/          create_graph.cypher, route_queries.cypher
scripts/        create-user.mjs
docs/           ER diagram, architecture, requirements, test cases
```

## Limitations
- Sample data is illustrative, not live BMTC data.
- The planner does not use exact timetables, waiting times or live traffic.
- PostgreSQL and Neo4j are seeded separately; adding a stop must be done in both.
