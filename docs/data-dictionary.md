# RouteWise data dictionary

Generated from the PostgreSQL catalog after running `database/01_schema.sql` to `04_access.sql` and `07_ddl_demo.sql`. PK = primary key, FK = foreign key.

## users

Application accounts.

| Column | Type | Null | Keys | References (on delete) | Constraint / default | Description |
|---|---|---|---|---|---|---|
| `user_id` | BIGINT identity | no | PK |  |  | Surrogate key |
| `full_name` | VARCHAR(120) | no |  |  | NOT NULL | Display name |
| `email` | VARCHAR(255) | no | UNIQUE |  |  | Login email (stored lowercase) |
| `password_hash` | TEXT | no |  |  | NOT NULL | bcrypt hash, never the password |
| `role` | VARCHAR(20) | no |  |  | CHECK IN ('ADMIN','DEPOT_STAFF','COMMUTER') | App role used by requireRole() |
| `created_at` | TIMESTAMPTZ | no |  |  | DEFAULT now() | When the account was created |

## stops

Bus stops (strong entity).

| Column | Type | Null | Keys | References (on delete) | Constraint / default | Description |
|---|---|---|---|---|---|---|
| `stop_id` | BIGINT identity | no | PK |  |  | Surrogate key; equals Neo4j Stop.stopId |
| `stop_code` | VARCHAR(30) | no | UNIQUE |  |  | Natural key, e.g. BLR001 |
| `stop_name` | VARCHAR(120) | no |  |  | NOT NULL | Stop name |
| `area` | VARCHAR(120) | no |  |  | NOT NULL | Locality |
| `latitude` | NUMERIC(9,6) | yes |  |  | CHECK BETWEEN -90 AND 90 | Composite attribute "location", part 1 |
| `longitude` | NUMERIC(9,6) | yes |  |  | CHECK BETWEEN -180 AND 180 | Composite attribute "location", part 2 |
| `is_active` | BOOLEAN | no |  |  | DEFAULT true | Soft on/off flag |

## routes

Bus routes.

| Column | Type | Null | Keys | References (on delete) | Constraint / default | Description |
|---|---|---|---|---|---|---|
| `route_id` | BIGINT identity | no | PK |  |  | Surrogate key |
| `route_code` | VARCHAR(30) | no | UNIQUE |  | CHECK matches ^R-[A-Z0-9]+$ | Natural key, e.g. R-B; equals Neo4j SEGMENT.routeCode |
| `route_name` | VARCHAR(160) | no |  |  | NOT NULL | Descriptive name |
| `is_active` | BOOLEAN | no |  |  | DEFAULT true | Soft on/off flag |

## route_stops

ROUTE.stops multivalued attribute / M:N ROUTE-STOP.

| Column | Type | Null | Keys | References (on delete) | Constraint / default | Description |
|---|---|---|---|---|---|---|
| `route_id` | BIGINT | no | FK, PK, UNIQUE | routes(route_id) (CASCADE) |  | Owning route |
| `stop_id` | BIGINT | no | FK, UNIQUE | stops(stop_id) (RESTRICT) |  | Stop served |
| `stop_sequence` | INTEGER | no | PK |  | CHECK > 0 | Position of the stop on the route |

## buses

Fleet.

| Column | Type | Null | Keys | References (on delete) | Constraint / default | Description |
|---|---|---|---|---|---|---|
| `bus_id` | BIGINT identity | no | PK |  |  | Surrogate key |
| `registration_no` | VARCHAR(30) | no | UNIQUE |  |  | Natural key |
| `capacity` | INTEGER | no |  |  | CHECK > 0 | Seats |
| `status` | VARCHAR(20) | no |  |  | CHECK IN ('ACTIVE','MAINTENANCE','RETIRED'); DEFAULT 'ACTIVE' | Operational status |
| `depot_name` | VARCHAR(80) | no |  |  | DEFAULT 'Majestic Depot' | Home depot (added by ALTER in 07_ddl_demo.sql) |

## trips

One scheduled run of a route by a bus.

| Column | Type | Null | Keys | References (on delete) | Constraint / default | Description |
|---|---|---|---|---|---|---|
| `trip_id` | BIGINT identity | no | PK |  |  | Surrogate key |
| `route_id` | BIGINT | no | FK | routes(route_id) (RESTRICT) |  | Route run |
| `bus_id` | BIGINT | no | FK | buses(bus_id) (RESTRICT) |  | Bus assigned |
| `service_date` | DATE | no |  |  | NOT NULL | Day of service |
| `planned_start` | TIME | no |  |  | NOT NULL | Scheduled departure |
| `trip_status` | VARCHAR(20) | no |  |  | CHECK IN ('SCHEDULED','COMPLETED','CANCELLED'); DEFAULT 'SCHEDULED' | Trip state |

## trip_stop_times

TRIP.stop_times multivalued attribute (weak entity).

| Column | Type | Null | Keys | References (on delete) | Constraint / default | Description |
|---|---|---|---|---|---|---|
| `trip_id` | BIGINT | no | FK, PK, UNIQUE | trips(trip_id) (CASCADE) |  | Owning trip (identifying) |
| `stop_sequence` | INTEGER | no | PK |  | CHECK > 0 | Partial key: position on the trip |
| `stop_id` | BIGINT | no | FK, UNIQUE | stops(stop_id) (RESTRICT) |  | Stop reached |
| `scheduled_arrival` | TIMESTAMPTZ | no |  |  | NOT NULL | Timetable arrival |
| `actual_arrival` | TIMESTAMPTZ | yes |  |  |  | Observed arrival (NULL until it happens) |

## delay_reports

Observed delays.

| Column | Type | Null | Keys | References (on delete) | Constraint / default | Description |
|---|---|---|---|---|---|---|
| `report_id` | BIGINT identity | no | PK |  |  | Surrogate key |
| `trip_id` | BIGINT | no | FK | trips(trip_id) (CASCADE) |  | Trip that was late |
| `stop_id` | BIGINT | no | FK | stops(stop_id) (RESTRICT) |  | Where it was observed |
| `reported_by` | BIGINT | yes | FK | users(user_id) (SET NULL) |  | Staff/admin who reported it (NULL if account deleted) |
| `delay_minutes` | INTEGER | no |  |  | CHECK BETWEEN 0 AND 240 | Minutes late |
| `cause` | VARCHAR(200) | no |  |  | CHECK not blank; DEFAULT 'Unknown' | Reason; tidied by the BEFORE trigger |
| `observed_at` | TIMESTAMPTZ | no |  |  | DEFAULT now() | When it was observed |
| `updated_at` | TIMESTAMPTZ | yes |  |  |  | Set by the BEFORE trigger on edit |

## delay_alerts

High-delay alerts, created by an AFTER trigger.

| Column | Type | Null | Keys | References (on delete) | Constraint / default | Description |
|---|---|---|---|---|---|---|
| `alert_id` | BIGINT identity | no | PK |  |  | Surrogate key |
| `report_id` | BIGINT | no | FK, UNIQUE | delay_reports(report_id) (CASCADE) |  | Report that raised it (1:0..1) |
| `alert_message` | TEXT | no |  |  | NOT NULL | Generated text |
| `created_at` | TIMESTAMPTZ | no |  |  | DEFAULT now() | When raised |
| `resolved` | BOOLEAN | no |  |  | DEFAULT false | Set TRUE by procedure resolve_route_alerts |

## complaints

Commuter complaints.

| Column | Type | Null | Keys | References (on delete) | Constraint / default | Description |
|---|---|---|---|---|---|---|
| `complaint_id` | BIGINT identity | no | PK |  |  | Surrogate key |
| `submitted_by` | BIGINT | yes | FK | users(user_id) (SET NULL) |  | Commuter (NULL if account deleted) |
| `route_id` | BIGINT | yes | FK | routes(route_id) (SET NULL) |  | Route concerned (optional) |
| `stop_id` | BIGINT | yes | FK | stops(stop_id) (SET NULL) |  | Stop concerned (optional) |
| `description` | TEXT | no |  |  | CHECK not blank | Complaint text |
| `status` | VARCHAR(20) | no |  |  | CHECK IN ('OPEN','IN_REVIEW','RESOLVED','REJECTED'); DEFAULT 'OPEN' | Workflow state |
| `created_at` | TIMESTAMPTZ | no |  |  | DEFAULT now() | When filed |

## delay_report_audit

Audit log written by an AFTER trigger.

| Column | Type | Null | Keys | References (on delete) | Constraint / default | Description |
|---|---|---|---|---|---|---|
| `audit_id` | BIGINT identity | no | PK |  |  | Surrogate key |
| `report_id` | BIGINT | no |  |  | NOT NULL | Report changed (no FK: survives DELETE) |
| `action` | VARCHAR(10) | no |  |  | CHECK IN ('INSERT','UPDATE','DELETE') | INSERT / UPDATE / DELETE |
| `old_delay` | INTEGER | yes |  |  |  | Value before |
| `new_delay` | INTEGER | yes |  |  |  | Value after |
| `old_cause` | VARCHAR(200) | yes |  |  |  | Value before |
| `new_cause` | VARCHAR(200) | yes |  |  |  | Value after |
| `changed_by` | BIGINT | yes | FK | users(user_id) (SET NULL) |  | App user from set_config(routewise.user_id) |
| `changed_at` | TIMESTAMPTZ | no |  |  | DEFAULT now() | When |

## Composite and other table-level constraints

| Table | Constraint |
|---|---|
| route_stops | PRIMARY KEY (route_id, stop_sequence); UNIQUE (route_id, stop_id) |
| trip_stop_times | PRIMARY KEY (trip_id, stop_sequence); UNIQUE (trip_id, stop_id) |
| delay_alerts | UNIQUE (report_id): at most one alert per report |

