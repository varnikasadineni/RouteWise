"use client";
import AuthLink from "@/app/AuthLink";
import { useCallback, useEffect, useState } from "react";

type User = { name: string; role: "ADMIN" | "DEPOT_STAFF" | "COMMUTER" } | null;
type Report = { report_id: number; trip_id: number; route_code: string; stop_name: string; delay_minutes: number; cause: string; observed_at: string; updated_at: string | null; reported_by: string | null; has_alert: boolean };
type Segment = { id: string; routeCode: string; travelMinutes: number; fromId: string; fromName: string; toId: string; toName: string };
type Stop = { stop_id: number; stop_name: string; area: string };

async function call(url: string, init?: RequestInit) {
  const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `Request failed (${r.status})`);
  return d;
}

export default function Admin() {
  const [user, setUser] = useState<User>(null);
  const [checked, setChecked] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [edits, setEdits] = useState<Record<number, { minutes: number; cause: string }>>({});
  const [segEdits, setSegEdits] = useState<Record<string, number>>({});
  const [newSeg, setNewSeg] = useState({ fromId: "", toId: "", routeCode: "R-D", travelMinutes: 10 });
  const [status, setStatus] = useState("");
  const [segStatus, setSegStatus] = useState("");
  const [refreshed, setRefreshed] = useState("");
  const isAdmin = user?.role === "ADMIN";

  const loadReports = useCallback(async () => {
    try { const d = await call("/api/admin/delay-reports"); const ids = new Set((d.reports as Report[]).map(r => String(r.report_id))); setReports(d.reports); setEdits(prev => Object.fromEntries(Object.entries(prev).filter(([k]) => ids.has(k)))); setRefreshed(new Date().toLocaleTimeString()); }
    catch (e) { setStatus((e as Error).message); }
  }, []);
  const loadSegments = useCallback(async () => {
    try { const d = await call("/api/admin/segments"); const ids = new Set((d.segments as Segment[]).map(s => s.id)); setSegments(d.segments); setSegEdits(prev => Object.fromEntries(Object.entries(prev).filter(([k]) => ids.has(k)))); }
    catch (e) { setSegStatus((e as Error).message); }
  }, []);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      setUser(d.user); setChecked(true);
      if (d.user && d.user.role !== "COMMUTER") {
        loadReports(); loadSegments();
        fetch("/api/stops").then(r => r.json()).then(s => setStops(s.stops || []));
      }
    }).catch(() => setChecked(true));
  }, [loadReports, loadSegments]);

  // Live refresh: changes made by other users (or in psql) appear within 5 seconds.
  useEffect(() => {
    if (!user || user.role === "COMMUTER") return;
    const t = setInterval(() => { loadReports(); loadSegments(); }, 5000);
    return () => clearInterval(t);
  }, [user, loadReports, loadSegments]);

  const dropEdit = (id: number | string) => setEdits(prev => { const n = { ...prev }; delete n[id as number]; return n; });

  async function saveReport(r: Report) {
    const e = edits[r.report_id]; if (!e) return;
    setStatus("");
    try {
      await call(`/api/admin/delay-reports/${r.report_id}`, { method: "PATCH", body: JSON.stringify({ delayMinutes: e.minutes, cause: e.cause }) });
      dropEdit(r.report_id); setStatus(`Report ${r.report_id} updated.`); loadReports();
    } catch (err) { setStatus((err as Error).message); loadReports(); }
  }
  async function deleteReport(r: Report) {
    setStatus("");
    try { await call(`/api/admin/delay-reports/${r.report_id}`, { method: "DELETE" }); dropEdit(r.report_id); setStatus(`Report ${r.report_id} deleted.`); loadReports(); }
    catch (err) { setStatus((err as Error).message); loadReports(); }
  }
  async function saveSegment(s: Segment) {
    const m = segEdits[s.id]; if (m === undefined) return;
    setSegStatus("");
    try { await call("/api/admin/segments", { method: "PATCH", body: JSON.stringify({ id: s.id, travelMinutes: m }) }); setSegEdits(prev => { const n = { ...prev }; delete n[s.id]; return n; }); setSegStatus(`${s.fromName} → ${s.toName} updated to ${m} min.`); loadSegments(); }
    catch (err) { setSegStatus((err as Error).message); }
  }
  async function deleteSegment(s: Segment) {
    setSegStatus("");
    try { await call(`/api/admin/segments?id=${encodeURIComponent(s.id)}`, { method: "DELETE" }); setSegStatus(`${s.fromName} → ${s.toName} (${s.routeCode}) deleted.`); loadSegments(); }
    catch (err) { setSegStatus((err as Error).message); }
  }
  async function addSegment(e: React.FormEvent) {
    e.preventDefault(); setSegStatus("");
    try { await call("/api/admin/segments", { method: "POST", body: JSON.stringify(newSeg) }); setSegStatus("Segment saved."); loadSegments(); }
    catch (err) { setSegStatus((err as Error).message); }
  }

  const header = <header className="top"><div><div className="brand">Route<span>Wise</span></div><div className="tag">Manage data</div></div><nav className="nav"><a href="/">Journey planner</a><a href="/dashboard">Delay dashboard</a><a href="/report-delay">Report a delay</a><a href="/admin">Manage</a><AuthLink /></nav></header>;

  if (!checked) return <main className="shell">{header}<p className="muted">Checking your session…</p></main>;
  if (!user || user.role === "COMMUTER") return <main className="shell">{header}<section className="card" style={{ maxWidth: 600 }}><h2>Staff only</h2><p className="muted">Sign in with a depot staff or admin account to manage delay reports and the route graph.</p><a className="btn" href="/login" style={{ textDecoration: "none", display: "inline-block" }}>Sign in</a></section></main>;

  return <main className="shell">{header}
    <section className="hero"><div className="eyebrow">Signed in as {user.name} · {user.role}</div><h1>Update and delete records.</h1><p className="live">Live · refreshes every 5 s · last {refreshed || "…"}</p><p>Delay reports live in PostgreSQL; route segments live in Neo4j. Depot staff can edit delay reports. Only admins can delete reports or change the route graph.</p></section>

    <section className="card" style={{ marginBottom: 18 }}>
      <h2>Delay reports <span className="muted">(PostgreSQL)</span></h2>
      <p className="muted">On save, a BEFORE trigger tidies the cause text and stamps the edit time. AFTER triggers then create an alert for delays of 15 minutes or more and write an audit row. Deleting a report also deletes its alert (ON DELETE CASCADE).</p>
      {status && <div className="status">{status}</div>}
      <div className="tablewrap"><table><thead><tr><th>ID</th><th>Route · trip</th><th>Stop</th><th>Delay (min)</th><th>Cause</th><th>Alert</th><th></th></tr></thead><tbody>
        {reports.map(r => { const e = edits[r.report_id] ?? { minutes: r.delay_minutes, cause: r.cause }; const dirty = !!edits[r.report_id];
          return <tr key={r.report_id}>
            <td>{r.report_id}</td>
            <td><strong>{r.route_code}</strong> · {r.trip_id}</td>
            <td>{r.stop_name}<br /><span className="muted">{r.reported_by ?? "seed data"}</span></td>
            <td><input aria-label="Delay minutes" type="number" min={0} max={240} value={e.minutes} style={{ width: 80 }} onChange={ev => setEdits({ ...edits, [r.report_id]: { ...e, minutes: Number(ev.target.value) } })} /></td>
            <td><input aria-label="Cause" value={e.cause} maxLength={200} onChange={ev => setEdits({ ...edits, [r.report_id]: { ...e, cause: ev.target.value } })} />{r.updated_at && <div className="muted" style={{ fontSize: 12 }}>edited {new Date(r.updated_at).toLocaleTimeString()}</div>}</td>
            <td>{r.has_alert ? <span className="chip">Alert</span> : "—"}</td>
            <td style={{ whiteSpace: "nowrap" }}>
              <button className="btn" disabled={!dirty} onClick={() => saveReport(r)}>Save</button>{" "}
              {isAdmin && <button className="btn" style={{ background: "#a52626" }} onClick={() => deleteReport(r)}>Delete</button>}
            </td></tr>; })}
      </tbody></table></div>
    </section>

    <section className="card">
      <h2>Route segments <span className="muted">(Neo4j)</span></h2>
      <p className="muted">Each row is a <code>(:Stop)-[:SEGMENT]-&gt;(:Stop)</code> relationship. The journey planner uses these, so changes show up in route search at once.</p>
      {segStatus && <div className="status">{segStatus}</div>}
      {isAdmin && <form onSubmit={addSegment} style={{ margin: "14px 0" }}><div className="formgrid">
        <div className="field"><label htmlFor="from">From stop</label><select id="from" required value={newSeg.fromId} onChange={e => setNewSeg({ ...newSeg, fromId: e.target.value })}><option value="">Choose…</option>{stops.map(s => <option key={s.stop_id} value={String(s.stop_id)}>{s.stop_name}</option>)}</select></div>
        <div className="field"><label htmlFor="to">To stop</label><select id="to" required value={newSeg.toId} onChange={e => setNewSeg({ ...newSeg, toId: e.target.value })}><option value="">Choose…</option>{stops.map(s => <option key={s.stop_id} value={String(s.stop_id)}>{s.stop_name}</option>)}</select></div>
        <div className="field"><label htmlFor="code">Route code</label><input id="code" required value={newSeg.routeCode} onChange={e => setNewSeg({ ...newSeg, routeCode: e.target.value })} /></div>
        <div className="field"><label htmlFor="mins">Travel minutes</label><input id="mins" type="number" min={1} max={180} required value={newSeg.travelMinutes} onChange={e => setNewSeg({ ...newSeg, travelMinutes: Number(e.target.value) })} /></div>
      </div><button className="btn">Add segment</button></form>}
      <div className="tablewrap"><table><thead><tr><th>Route</th><th>From</th><th>To</th><th>Minutes</th><th></th></tr></thead><tbody>
        {segments.map(s => { const m = segEdits[s.id] ?? s.travelMinutes;
          return <tr key={s.id}>
            <td><strong>{s.routeCode}</strong></td><td>{s.fromName}</td><td>{s.toName}</td>
            <td>{isAdmin ? <input aria-label="Travel minutes" type="number" min={1} max={180} value={m} style={{ width: 80 }} onChange={e => setSegEdits({ ...segEdits, [s.id]: Number(e.target.value) })} /> : m}</td>
            <td style={{ whiteSpace: "nowrap" }}>{isAdmin && <><button className="btn" disabled={segEdits[s.id] === undefined} onClick={() => saveSegment(s)}>Save</button>{" "}<button className="btn" style={{ background: "#a52626" }} onClick={() => deleteSegment(s)}>Delete</button></>}</td>
          </tr>; })}
      </tbody></table></div>
    </section>
    <p className="foot">RouteWise academic prototype · Sample data is illustrative</p>
  </main>;
}
