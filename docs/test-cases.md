# RouteWise test cases

| ID | Test | Expected result | Actual result / evidence |
|---|---|---|---|
| T1 | Load stop list | Stop dropdowns populate from PostgreSQL | Fill after running |
| T2 | Search connected stops | Candidate graph paths returned | Fill after running |
| T3 | Search disconnected stops | Clear no-route message | Fill after running |
| T4 | Compare candidates | Fewer route changes rank first; time breaks ties | Fill after running |
| T5 | Same origin/destination | Graceful same-stop result | Fill after running |
| T6 | Submit delay 10 | Report saved; dashboard updates | Fill after running |
| T7 | Submit delay -1 or 241 | API rejects input | Fill after running |
| T8 | Submit stop not on trip | API rejects mismatch | Fill after running |
| T9 | Insert delay >= 15 directly in SQL | Trigger creates a delay alert | Fill after running |
| T10 | Query route_delay_summary | One row per route, including routes with zero reports | Fill after running |
| T11 | Run window function ranking query | Routes are ranked by average delay | Fill after running |
| T12 | Database unavailable | UI/API shows a controlled error | Fill after running |

Attach actual screenshots and mark pass/fail only after executing each test.

| T13 | Register valid commuter | Account saved with hashed password and COMMUTER role | Fill after running |
| T14 | Submit delay report without login | API returns 401 | Fill after running |
| T15 | Submit delay report as depot staff | Report is saved with reported_by user ID | Fill after running |
| T16 | Login with incorrect password | API returns 401 without revealing account existence | Fill after running |

## Update / Delete (admin page `/admin`)

| ID | Test | Expected result | Actual result / evidence |
|---|---|---|---|
| T17 | Open /admin as a commuter or signed out | "Staff only" message, no data | Fill after running |
| T18 | Staff edits a report's cause and minutes, Save | Row updates (SQL UPDATE) | Fill after running |
| T19 | Staff raises a delay to 15 or more | Alert chip appears (trigger on UPDATE) | Fill after running |
| T20 | Staff tries Delete | No Delete button; API returns 403 | Fill after running |
| T21 | Admin deletes a report | Row and its alert disappear (ON DELETE CASCADE) | Fill after running |
| T22 | Admin changes a segment's minutes | Neo4j SET; journey planner times change | Fill after running |
| T23 | Admin deletes a segment, then searches that journey | Neo4j DELETE; planner offers a different path | Fill after running |
| T24 | Admin adds a segment | Neo4j MERGE; new row appears | Fill after running |

## Database page, triggers, procedure and multi-user (two browsers: one normal, one incognito)

| ID | Test | Expected result | Actual result / evidence |
|---|---|---|---|
| T25 | Admin opens Database | Accounts, roles, privileges, triggers, routines, alerts, audit log | Fill after running |
| T26 | Staff opens Database | "Admins only" (403) | Fill after running |
| T27 | `CREATE ROLE demo_role; GRANT SELECT ON stops TO demo_role;` in psql | demo_role and its SELECT on stops appear within 5 s | Fill after running |
| T28 | Staff edits cause to "  heavy   RAIN " | Saved as "Heavy rain", "edited" time shown (BEFORE trigger) | Fill after running |
| T29 | Staff edits a report; admin's Manage page open | Admin sees the change within 5 s, no reload | Fill after running |
| T30 | Admin deletes a report; staff's Manage page open | Row disappears for staff within 5 s | Fill after running |
| T31 | Staff saves a report admin already deleted | "no longer exists" message | Fill after running |
| T32 | Run function get_route_delay_stats('R-B') from Database page | Count, average and max delay for R-B | Fill after running |
| T33 | Call procedure resolve_route_alerts('R-B') | Returns number resolved; R-B alerts show Resolved | Fill after running |
| T34 | Audit log after T28–T30 | One row per change, with the user's name | Fill after running |
