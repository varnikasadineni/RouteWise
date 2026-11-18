"use client";
import AuthLink from "@/app/AuthLink";
import { useEffect, useState } from "react";
type Opt = { trip_id: number; route_code: string; stop_id: number; stop_name: string };
export default function ReportDelay() {
  const [options, setOptions] = useState<Opt[]>([]);
  const [trip, setTrip] = useState(0);
  const [stop, setStop] = useState(0);
  const [minutes, setMinutes] = useState(10);
  const [cause, setCause] = useState("Traffic congestion");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch("/api/report-options")
      .then((r) => r.json())
      .then((d) => {
        if (d.options) {
          const opts: Opt[] = d.options.map((o: Opt) => ({
            ...o,
            trip_id: Number(o.trip_id),
            stop_id: Number(o.stop_id),
          }));
          setOptions(opts);
          if (opts[0]) {
            setTrip(opts[0].trip_id);
            setStop(opts[0].stop_id);
          }
        }
      })
      .catch(() => setStatus("Could not load trips. Check the database setup."));
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus("");
    try {
      const r = await fetch("/api/delay-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId: trip, stopId: stop, delayMinutes: minutes, cause }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not save report");
      setStatus("Delay report saved. Visit the dashboard to see updated analytics.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Submission failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="shell">
      <header className="top">
        <div>
          <div className="brand">
            Route<span>Wise</span>
          </div>
          <div className="tag">Delay reporting</div>
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
        <div className="eyebrow">Sample operations workflow</div>
        <h1>Record an observed delay.</h1>
        <p>Use this form to test data validation, foreign-key integrity, and the delay analytics pipeline.</p>
      </section>
      <section className="card" style={{ maxWidth: 680 }}>
        <h2>New delay report</h2>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="trip">Trip and route</label>
            <select
              id="trip"
              value={trip}
              onChange={(e) => {
                const v = Number(e.target.value);
                setTrip(v);
                const match = options.find((o) => o.trip_id === v);
                if (match) setStop(match.stop_id);
              }}
              required
            >
              {options
                .filter((o, i) => options.findIndex((x) => x.trip_id === o.trip_id) === i)
                .map((o) => (
                  <option key={o.trip_id} value={o.trip_id}>
                    {o.route_code} · Trip {o.trip_id}
                  </option>
                ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="stop">Stop</label>
            <select id="stop" value={stop} onChange={(e) => setStop(Number(e.target.value))} required>
              {options
                .filter((o) => o.trip_id === trip)
                .map((o) => (
                  <option key={o.stop_id} value={o.stop_id}>
                    {o.stop_name}
                  </option>
                ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="minutes">Delay in minutes (0–240)</label>
            <input
              id="minutes"
              type="number"
              min="0"
              max="240"
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="cause">Cause</label>
            <select id="cause" value={cause} onChange={(e) => setCause(e.target.value)}>
              <option>Traffic congestion</option>
              <option>High passenger volume</option>
              <option>Vehicle issue</option>
              <option>Weather</option>
              <option>Unknown</option>
            </select>
          </div>
          <button className="btn" disabled={busy || options.length === 0}>
            {busy ? "Saving…" : "Submit delay report"}
          </button>
        </form>
        {status && <div className="status">{status}</div>}
        <p className="muted">
          Staff-only: sign in with a DEPOT_STAFF or ADMIN account before submitting a report. Create a demo
          staff account with scripts/create-user.mjs.
        </p>
      </section>
    </main>
  );
}
