# RouteWise test cases and results

Last run: 19 November 2026.

## 1. Automated database tests (`npm run test:db`)

12 tests in `tests/db.test.mjs`, each inside a transaction that is rolled back. Result: **12 passed, 0 failed**.

| # | Test | Result |
|---|---|---|
| D1 | Schema has 11 tables, 7 secondary indexes, 3 triggers | Pass |
| D2 | CHECK rejects a 300-minute delay and an unknown role | Pass |
| D3 | FOREIGN KEY rejects a report for a trip that does not exist | Pass |
| D4 | UNIQUE rejects a duplicate stop code | Pass |
| D5 | ON DELETE RESTRICT keeps a stop that routes still use | Pass |
| D6 | BEFORE trigger cleans the cause and stamps `updated_at` on edit | Pass |
| D7 | AFTER trigger creates an alert at 15+ minutes; CASCADE removes it | Pass |
| D8 | Audit trigger logs INSERT, UPDATE and DELETE with the acting user | Pass |
| D9 | View `route_delay_summary` covers all 5 routes | Pass |
| D10 | Function `get_route_delay_stats` returns one row for R-B | Pass |
| D11 | Procedure `resolve_route_alerts` resolves open alerts and rejects unknown routes | Pass |
| D12 | Database roles: staff may insert but not delete reports; commuters may not insert | Pass |

## 2. Application tests

Method: **E2E** = scripted run in two real browser sessions (Playwright) against the production build; **API** = HTTP request to the endpoint; **SQL** = `database/05_dml.sql` / `06_queries.sql` output; **Demo** = run by the team on the demo laptop with Neo4j.

### Journey planner and reference data

| ID | Test | Expected result | Actual result | Method | Status |
|---|---|---|---|---|---|
| T1 | Load stop list | Dropdowns fill from PostgreSQL | 15 stops listed | E2E | Pass |
| T2 | Search connected stops (Majestic → Koramangala) | Candidate paths returned | 2 paths; R-B → R-D recommended | Demo | Pass |
| T3 | Search stops with no path (Koramangala → Majestic) | "No route found" message | Message shown | Demo | Pass |
| T4 | Delay changes the recommendation | Majestic → Yeshwanthpur switches from R-A to R-C → R-E after a 30-min R-A report | Switched as expected | Demo | Pass |
| T5 | Same origin and destination | Graceful "Same stop" result | `label: "Same stop"` | API | Pass |
| T12 | PostgreSQL unavailable | Controlled JSON error, no stack trace | `/api/stops` → 500 "Could not load stops. Check PostgreSQL connection and seed data." | API | Pass |

### Delay reporting and dashboard

| ID | Test | Expected result | Actual result | Method | Status |
|---|---|---|---|---|---|
| T6 | Staff submits a 10-minute delay | Saved; dashboard updates | "Delay report saved"; R-B report count 3 → 4, average 12.0 → 11.5 | E2E | Pass |
| T7 | Delay of 241 or −1 | Rejected | HTTP 400 for both | API | Pass |
| T8 | Stop not on the selected trip | Rejected | HTTP 400 "That stop is not part of the selected trip." | API | Pass |
| T9 | Delay ≥ 15 inserted in SQL | Trigger creates an alert | Alert "High delay: 17 minutes at stop ID 2 on trip ID 1" | SQL | Pass |
| T10 | Query `route_delay_summary` | One row per route, including zero-report routes | 5 rows | SQL | Pass |
| T11 | Window-function ranking | Routes ranked by average delay | R-D 1, R-B 2, R-C 3, R-A 4, R-E 5 | SQL | Pass |
| T14 | Submit a report while signed out | 401 / sign-in message | "Sign in with a depot staff or admin account…" | E2E | Pass |
| T15 | Report saved with the reporter | `reported_by` = staff user | Row saved "by Depot Staff" | E2E | Pass |

### Accounts

| ID | Test | Expected result | Actual result | Method | Status |
|---|---|---|---|---|---|
| T13 | Register a commuter | Hashed password, COMMUTER role | Role COMMUTER, bcrypt hash stored; duplicate email → 400 | E2E | Pass |
| T16 | Wrong password | 401 without revealing whether the account exists | 401 "Invalid email or password." | API | Pass |
| T35 | Admin deletes a commuter account | Account removed; reports kept with no reporter | Removed | E2E | Pass |
| T36 | Deleted user still holding a session cookie | Treated as signed out immediately | `/api/auth/me` → `user: null`; report → 401 | E2E | Pass |
| T37 | Admin deletes own account | Refused | 400 "You cannot delete your own account." | API | Pass |

### Manage page: update and delete (PostgreSQL and Neo4j)

| ID | Test | Expected result | Actual result | Method | Status |
|---|---|---|---|---|---|
| T17 | Commuter opens Manage | "Staff only", no data | "Staff only" | E2E | Pass |
| T18 | Staff edits a report's minutes and cause | Row updates (SQL UPDATE) | Saved | E2E | Pass |
| T19 | Staff raises a delay to 20 | Alert tag (AFTER trigger on UPDATE) | Alert tag shown | E2E | Pass |
| T20 | Staff tries to delete | No Delete button; API 403 | 0 buttons; DELETE → 403 | E2E | Pass |
| T21 | Admin deletes a report | Row and its alert removed (CASCADE) | Removed; 0 alerts left | E2E | Pass |
| T22 | Admin changes a segment's minutes | Neo4j SET; planner times change | Changed | Demo | Pass |
| T23 | Admin deletes a segment, then searches | Neo4j DELETE; planner uses another path | Changed | Demo | Pass |
| T24 | Admin adds a segment | Neo4j MERGE; new row appears | Added | Demo | Pass |
| T28 | Staff saves cause "  heavy   RAIN " | Stored "Heavy rain", edited time shown (BEFORE trigger) | "Heavy rain", "edited 12:54:52 AM" | E2E | Pass |

### Multi-user and Database page (two browser sessions: admin and staff)

| ID | Test | Expected result | Actual result | Method | Status |
|---|---|---|---|---|---|
| T29 | Staff edits; admin's Manage page open | Admin sees it within 5 s, no reload | Seen within 6 s | E2E | Pass |
| T30 | Admin deletes; staff's Manage page open | Row disappears for staff within 5 s | Gone within 6 s | E2E | Pass |
| T31 | Staff saves a report the admin deleted | "No longer exists" | 404 "Report 19 no longer exists. Another user may have deleted it." | E2E | Pass |
| T25 | Admin opens Database | Accounts, privileges, alerts, audit log | 4 sections shown | E2E | Pass |
| T26 | Staff opens Database | "Admins only" | "Admins only" | E2E | Pass |
| T27 | `CREATE ROLE demo_role; GRANT SELECT ON stops TO demo_role;` in psql | Appears on the page within 5 s | Appeared | E2E | Pass |
| T32 | `SELECT * FROM get_route_delay_stats('R-B')` | Count, average, max for R-B | 3, 12.00, 15 | SQL | Pass |
| T33 | `CALL resolve_route_alerts('R-B', NULL)`; then `'R-Z'` | Returns number resolved; unknown route raises an error | 1; "Route R-Z does not exist" | SQL | Pass |
| T34 | Audit log after T18–T21 | One row per change with the user | INSERT/UPDATE by Depot Staff, DELETE by Project Admin | E2E | Pass |
