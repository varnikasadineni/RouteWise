"use client";
import AuthLink from "@/app/AuthLink";
import { useState } from "react";
export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Registration failed");
      setMessage("Account created. You can now sign in.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Registration failed");
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
          <div className="tag">Create a commuter account</div>
        </div>
        <nav className="nav">
          <a href="/">Journey planner</a>
          <AuthLink />
        </nav>
      </header>
      <section className="card" style={{ maxWidth: 520, margin: "30px auto" }}>
        <h1>Create account</h1>
        <p className="muted">
          Public registration creates a COMMUTER account only. Admin and depot staff roles must be assigned
          securely by the project team.
        </p>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="name">Full name</label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={2}
              maxLength={120}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password (minimum 8 characters)</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <button className="btn" disabled={busy}>
            {busy ? "Creating…" : "Create commuter account"}
          </button>
        </form>
        {message && <div className="status">{message}</div>}
      </section>
    </main>
  );
}
