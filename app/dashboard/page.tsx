"use client";
import AuthLink from "@/app/AuthLink";
import { useEffect, useState } from "react";
type Row = {
  route_code: string;
  route_name: string;
  report_count: number;
  avg_delay_minutes: number;
  max_delay_minutes: number;
};
export default function Dashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const load = () =>
      fetch("/api/analytics", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (!d.rows) throw new Error(d.error || "Analytics unavailable");
          setRows(d.rows);
          setError("");
        })
        .catch((e) => setError(e.message));
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);
  return (
    <main className="shell">
      <header className="top">
        <div>
          <div className="brand">
            Route<span>Wise</span>
          </div>
          <div className="tag">Delay analytics</div>
        </div>
        <nav className="nav">
          <a href="/">Journey planner</a>
          <a href="/dashboard">Delay dashboard</a>
          <a href="/report-delay">Report a delay</a>
          <a href="/admin">Manage</a>
          <AuthLink />
        </nav>
      </header>
      <section className="hero">
        <div className="eyebrow">Operations insight</div>
        <h1>Understand delay patterns.</h1>
        <p>
          Aggregated from sample delay reports stored in PostgreSQL. Results are only as accurate as the
          entered data.
        </p>
      </section>
      <section className="card">
        <h2>Route delay summary</h2>
        <p className="muted">
          Live · refreshes every 5 s, so reports added or deleted by any user appear here.
        </p>
        {error ? (
          <div className="status">{error}</div>
        ) : rows.length === 0 ? (
          <p className="muted">Loading analytics or no delay reports have been recorded yet.</p>
        ) : (
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Route</th>
                  <th>Reports</th>
                  <th>Average delay</th>
                  <th>Maximum delay</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.route_code}>
                    <td>
                      <strong>{r.route_code}</strong>
                      <br />
                      <span className="muted">{r.route_name}</span>
                    </td>
                    <td>{r.report_count}</td>
                    <td>{Number(r.avg_delay_minutes).toFixed(1)} min</td>
                    <td>{r.max_delay_minutes} min</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="foot">Delay figures are from the project sample dataset, not live service telemetry.</p>
    </main>
  );
}
