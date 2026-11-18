// Automated database tests for RouteWise (PostgreSQL).
// Run:  npm run test:db     (reads DATABASE_URL from .env.local or the environment)
// Every test runs inside a transaction that is rolled back, so the data is never changed.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import pg from "pg";

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const line = fs
      .readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .find((l) => l.startsWith("DATABASE_URL="));
    if (line) return line.slice("DATABASE_URL=".length).trim();
  } catch {}
  throw new Error("Set DATABASE_URL or create .env.local first");
}

const pool = new pg.Pool({ connectionString: databaseUrl(), max: 2 });
after(() => pool.end());

// Runs fn inside BEGIN ... ROLLBACK on one connection.
async function inTransaction(fn) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await fn(c);
  } finally {
    await c.query("ROLLBACK").catch(() => {});
    c.release();
  }
}
// Expects the statement to fail, without aborting the surrounding transaction.
async function rejects(c, sql, params, pattern) {
  await c.query("SAVEPOINT s");
  await assert.rejects(c.query(sql, params), pattern);
  await c.query("ROLLBACK TO SAVEPOINT s");
}
const newReport = (c, minutes, cause) =>
  c
    .query(
      "INSERT INTO delay_reports(trip_id, stop_id, delay_minutes, cause) VALUES (1, 2, $1, $2) RETURNING *",
      [minutes, cause],
    )
    .then((r) => r.rows[0]);

test("schema: 11 tables, 7 secondary indexes, 3 triggers", async () => {
  const t = await pool.query(
    "SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",
  );
  const i = await pool.query(
    "SELECT COUNT(*)::int AS n FROM pg_indexes WHERE schemaname='public' AND indexname LIKE 'idx%'",
  );
  const g = await pool.query(
    "SELECT COUNT(DISTINCT trigger_name)::int AS n FROM information_schema.triggers WHERE trigger_schema='public'",
  );
  assert.equal(t.rows[0].n, 11);
  assert.equal(i.rows[0].n, 7);
  assert.equal(g.rows[0].n, 3);
});

test("CHECK rejects a 300-minute delay and an unknown role", () =>
  inTransaction(async (c) => {
    await rejects(
      c,
      "INSERT INTO delay_reports(trip_id, stop_id, delay_minutes, cause) VALUES (1, 2, 300, 'x')",
      [],
      /check constraint/,
    );
    await rejects(
      c,
      "INSERT INTO users(full_name, email, password_hash, role) VALUES ('X', 'x@t.com', 'h', 'DRIVER')",
      [],
      /users_role_check/,
    );
  }));

test("FOREIGN KEY rejects a report for a trip that does not exist", () =>
  inTransaction(async (c) => {
    await rejects(
      c,
      "INSERT INTO delay_reports(trip_id, stop_id, delay_minutes, cause) VALUES (999, 1, 5, 'x')",
      [],
      /foreign key/,
    );
  }));

test("UNIQUE rejects a duplicate stop code", () =>
  inTransaction(async (c) => {
    await rejects(
      c,
      "INSERT INTO stops(stop_code, stop_name, area) VALUES ('BLR001', 'Dup', 'X')",
      [],
      /duplicate key/,
    );
  }));

test("ON DELETE RESTRICT keeps a stop that routes still use", () =>
  inTransaction(async (c) => {
    await rejects(
      c,
      "DELETE FROM stops WHERE stop_id = 1",
      [],
      /foreign key constraint "route_stops_stop_id_fkey"/,
    );
  }));

test("BEFORE trigger cleans the cause and stamps updated_at on edit", () =>
  inTransaction(async (c) => {
    const r = await newReport(c, 5, "  signal   FAILURE ");
    assert.equal(r.cause, "Signal failure");
    assert.equal(r.updated_at, null);
    const u = await c.query(
      "UPDATE delay_reports SET cause = '   ' WHERE report_id = $1 RETURNING cause, updated_at",
      [r.report_id],
    );
    assert.equal(u.rows[0].cause, "Unknown");
    assert.ok(u.rows[0].updated_at);
  }));

test("AFTER trigger creates an alert at 15+ minutes, and CASCADE removes it", () =>
  inTransaction(async (c) => {
    const low = await newReport(c, 14, "x");
    const high = await newReport(c, 15, "x");
    const alerts = await c.query("SELECT report_id FROM delay_alerts WHERE report_id = ANY($1)", [
      [low.report_id, high.report_id],
    ]);
    assert.deepEqual(
      alerts.rows.map((r) => String(r.report_id)),
      [String(high.report_id)],
    );
    await c.query("DELETE FROM delay_reports WHERE report_id = $1", [high.report_id]);
    const left = await c.query("SELECT COUNT(*)::int AS n FROM delay_alerts WHERE report_id = $1", [
      high.report_id,
    ]);
    assert.equal(left.rows[0].n, 0);
  }));

test("audit trigger logs INSERT, UPDATE and DELETE with the acting user", () =>
  inTransaction(async (c) => {
    const u = await c.query(
      "INSERT INTO users(full_name, email, password_hash, role) VALUES ('Test Staff', 'audit@test.com', 'h', 'DEPOT_STAFF') RETURNING user_id",
    );
    await c.query("SELECT set_config('routewise.user_id', $1, true)", [String(u.rows[0].user_id)]);
    const r = await newReport(c, 8, "Rain");
    await c.query("UPDATE delay_reports SET delay_minutes = 12 WHERE report_id = $1", [r.report_id]);
    await c.query("DELETE FROM delay_reports WHERE report_id = $1", [r.report_id]);
    const a = await c.query(
      "SELECT action, old_delay, new_delay, changed_by FROM delay_report_audit WHERE report_id = $1 ORDER BY audit_id",
      [r.report_id],
    );
    assert.deepEqual(
      a.rows.map((x) => x.action),
      ["INSERT", "UPDATE", "DELETE"],
    );
    assert.equal(a.rows[1].old_delay, 8);
    assert.equal(a.rows[1].new_delay, 12);
    assert.ok(a.rows.every((x) => String(x.changed_by) === String(u.rows[0].user_id)));
  }));

test("view route_delay_summary covers all 5 routes", async () => {
  const r = await pool.query("SELECT route_code FROM route_delay_summary ORDER BY route_code");
  assert.deepEqual(
    r.rows.map((x) => x.route_code),
    ["R-A", "R-B", "R-C", "R-D", "R-E"],
  );
});

test("function get_route_delay_stats returns one row for R-B", async () => {
  const r = await pool.query("SELECT * FROM get_route_delay_stats('R-B')");
  assert.equal(r.rowCount, 1);
  assert.equal(r.rows[0].route_code, "R-B");
});

test("procedure resolve_route_alerts resolves open alerts and rejects unknown routes", () =>
  inTransaction(async (c) => {
    await newReport(c, 30, "x"); // trip 1 is on R-A: creates an open alert
    const r = await c.query("CALL resolve_route_alerts('R-A', NULL)");
    assert.ok(r.rows[0].p_resolved >= 1);
    const again = await c.query("CALL resolve_route_alerts('R-A', NULL)");
    assert.equal(again.rows[0].p_resolved, 0);
    await rejects(c, "CALL resolve_route_alerts('R-Z', NULL)", [], /does not exist/);
  }));

test("database roles: staff may insert but not delete reports; commuters may not insert", () =>
  inTransaction(async (c) => {
    await c.query("SET LOCAL ROLE routewise_staff");
    const r = await newReport(c, 16, "staff insert"); // triggers still write alert + audit
    assert.ok(r.report_id);
    await rejects(c, "DELETE FROM delay_reports WHERE report_id = 1", [], /permission denied/);
    await c.query("RESET ROLE");
    await c.query("SET LOCAL ROLE routewise_commuter");
    await rejects(
      c,
      "INSERT INTO delay_reports(trip_id, stop_id, delay_minutes, cause) VALUES (1, 2, 5, 'x')",
      [],
      /permission denied/,
    );
  }));
