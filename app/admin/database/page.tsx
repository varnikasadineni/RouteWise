"use client";
import { useCallback, useEffect, useState } from "react";
import AuthLink from "@/app/AuthLink";

type AppUser = {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  created_at: string;
  reports: number;
};
type Role = {
  rolname: string;
  rolsuper: boolean;
  rolcanlogin: boolean;
  rolcreatedb: boolean;
  rolcreaterole: boolean;
  member_of: string[];
};
type Priv = {
  role: string;
  object: string;
  kind: string;
  sel: boolean;
  ins: boolean;
  upd: boolean;
  del: boolean;
};
type Trigger = {
  trigger_name: string;
  action_timing: string;
  events: string;
  table_name: string;
  action_orientation: string;
};
type Routine = { name: string; kind: string; args: string };
type Alert = {
  alert_id: string;
  report_id: string;
  route_code: string;
  alert_message: string;
  created_at: string;
  resolved: boolean;
};
type Audit = {
  audit_id: string;
  report_id: string;
  action: string;
  old_delay: number | null;
  new_delay: number | null;
  old_cause: string | null;
  new_cause: string | null;
  changed_at: string;
  changed_by: string;
};
type Overview = {
  appUsers: AppUser[];
  roles: Role[];
  privileges: Priv[];
  triggers: Trigger[];
  routines: Routine[];
  alerts: Alert[];
  audit: Audit[];
  routes: { route_code: string; route_name: string }[];
};

const REFRESH_MS = 5000;
const time = (s: string) => new Date(s).toLocaleTimeString();
const tick = (b: boolean) => (b ? "✓" : "–");

export default function DatabasePage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [refreshed, setRefreshed] = useState("");
  const [me, setMe] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [accountMsg, setAccountMsg] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/db-overview", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not load");
      setData(d);
      setError("");
      setRefreshed(new Date().toLocaleTimeString());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setMe(d.user ? String(d.user.userId) : null))
      .catch(() => {});
  }, []);

  async function deleteAccount(u: AppUser) {
    setAccountMsg("");
    setConfirming(null);
    try {
      const r = await fetch(`/api/admin/users/${u.user_id}`, { method: "DELETE" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Delete failed");
      setAccountMsg(`Deleted ${u.full_name} (${u.role}). Their delay reports are kept with no reporter.`);
    } catch (e) {
      setAccountMsg((e as Error).message);
    }
    load();
  }

  const header = (
    <header className="top">
      <div>
        <div className="brand">
          Route<span>Wise</span>
        </div>
        <div className="tag">Database administration</div>
      </div>
      <nav className="nav">
        <a href="/">Journey planner</a>
        <a href="/dashboard">Delay dashboard</a>
        <a href="/report-delay">Report a delay</a>
        <a href="/admin">Manage</a>
        <AuthLink />
      </nav>
    </header>
  );

  if (error && !data)
    return (
      <main className="shell">
        {header}
        <section className="card" style={{ maxWidth: 640 }}>
          <h2>Admins only</h2>
          <p className="muted">{error}</p>
          <a className="btn" href="/login" style={{ textDecoration: "none", display: "inline-block" }}>
            Sign in
          </a>
        </section>
      </main>
    );
  if (!data)
    return (
      <main className="shell">
        {header}
        <p className="muted">Loading…</p>
      </main>
    );

  const nonSuper = data.roles.filter((r) => !r.rolsuper);
  const supers = data.roles.filter((r) => r.rolsuper).map((r) => r.rolname);

  return (
    <main className="shell">
      {header}
      <section className="hero">
        <div className="eyebrow">Live from PostgreSQL · refreshed {refreshed} · every 5 s</div>
        <h1>Users, privileges and database logic.</h1>
        <p>
          Everything on this page is read from PostgreSQL&apos;s system catalog each time it refreshes. A
          role, grant or user added in psql, or a change made by another signed-in user, appears here within 5
          seconds.
        </p>
      </section>

      <section className="card dbsec">
        <h2>
          Application accounts <span className="muted">(users table)</span>
        </h2>
        <p className="muted">
          Admins can delete depot staff and commuter accounts. Admin accounts cannot be deleted here.
        </p>
        {accountMsg && <div className="status">{accountMsg}</div>}
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>App role</th>
                <th>Delay reports</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.appUsers.map((u) => (
                <tr key={u.user_id}>
                  <td>{u.user_id}</td>
                  <td>{u.full_name}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className="chip">{u.role}</span>
                  </td>
                  <td>{u.reports}</td>
                  <td>{new Date(u.created_at).toLocaleString()}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {u.role === "ADMIN" || String(u.user_id) === me ? (
                      <span className="muted">–</span>
                    ) : confirming === String(u.user_id) ? (
                      <>
                        <button
                          className="btn"
                          style={{ background: "#a52626" }}
                          onClick={() => deleteAccount(u)}
                        >
                          Confirm delete
                        </button>{" "}
                        <button
                          className="btn"
                          style={{ background: "#5c6878" }}
                          onClick={() => setConfirming(null)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        className="btn"
                        style={{ background: "#a52626" }}
                        onClick={() => {
                          setAccountMsg("");
                          setConfirming(String(u.user_id));
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card dbsec">
        <h2>
          Table privileges per role <span className="muted">(has_table_privilege)</span>
        </h2>
        {supers.length > 0 && (
          <p className="muted">
            Superusers ({supers.join(", ")}) bypass privilege checks and can do everything, so they are not
            listed below.
          </p>
        )}
        {nonSuper.length === 0 && (
          <p className="muted">
            No non-superuser roles yet. Run database/04_access.sql to create routewise_admin, routewise_staff
            and routewise_commuter.
          </p>
        )}
        <div className="privgrid">
          {nonSuper.map((r) => {
            const rows = data.privileges.filter((p) => p.role === r.rolname);
            return (
              <div key={r.rolname} className="privcard">
                <h3>{r.rolname}</h3>
                {rows.length === 0 ? (
                  <p className="muted">No table privileges.</p>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Table / view</th>
                        <th>SELECT</th>
                        <th>INSERT</th>
                        <th>UPDATE</th>
                        <th>DELETE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((p) => (
                        <tr key={p.object}>
                          <td>
                            {p.object}
                            {p.kind === "view" ? <span className="muted"> (view)</span> : null}
                          </td>
                          <td className={p.sel ? "yes" : "no"}>{tick(p.sel)}</td>
                          <td className={p.ins ? "yes" : "no"}>{tick(p.ins)}</td>
                          <td className={p.upd ? "yes" : "no"}>{tick(p.upd)}</td>
                          <td className={p.del ? "yes" : "no"}>{tick(p.del)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="card dbsec">
        <h2>
          Delay alerts{" "}
          <span className="muted">(created by the AFTER trigger, resolved by the procedure)</span>
        </h2>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Alert</th>
                <th>Route</th>
                <th>Message</th>
                <th>Created</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.alerts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    No alerts.
                  </td>
                </tr>
              ) : (
                data.alerts.map((a) => (
                  <tr key={a.alert_id}>
                    <td>{a.alert_id}</td>
                    <td>
                      <strong>{a.route_code}</strong>
                    </td>
                    <td>{a.alert_message}</td>
                    <td>{time(a.created_at)}</td>
                    <td>
                      {a.resolved ? (
                        <span className="chip">Resolved</span>
                      ) : (
                        <span className="chip delaychip">Open</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card dbsec">
        <h2>
          Audit log <span className="muted">(delay_report_audit, last 25 changes)</span>
        </h2>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Action</th>
                <th>Report</th>
                <th>Delay</th>
                <th>Cause</th>
              </tr>
            </thead>
            <tbody>
              {data.audit.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">
                    No changes yet. Add, edit or delete a delay report.
                  </td>
                </tr>
              ) : (
                data.audit.map((a) => (
                  <tr key={a.audit_id}>
                    <td>{time(a.changed_at)}</td>
                    <td>{a.changed_by}</td>
                    <td>
                      <span className={`chip ${a.action === "DELETE" ? "delaychip" : ""}`}>{a.action}</span>
                    </td>
                    <td>{a.report_id}</td>
                    <td>
                      {a.action === "UPDATE"
                        ? `${a.old_delay} → ${a.new_delay}`
                        : (a.new_delay ?? a.old_delay)}
                    </td>
                    <td>
                      {a.action === "UPDATE"
                        ? a.old_cause === a.new_cause
                          ? a.new_cause
                          : `${a.old_cause} → ${a.new_cause}`
                        : (a.new_cause ?? a.old_cause)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      <p className="foot">RouteWise academic prototype · Sample data is illustrative</p>
    </main>
  );
}
