"use client";
import { useEffect, useState } from "react";

// Shows "Sign in" when signed out, or the user's name and a Sign out button when signed in.
export default function AuthLink() {
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  useEffect(() => { fetch("/api/auth/me").then(r => r.json()).then(d => setUser(d.user ?? null)).catch(() => {}); }, []);
  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }
  if (!user) return <a href="/login">Sign in</a>;
  return <>
    {user.role === "ADMIN" && <a href="/admin/database">Database</a>}
    <span className="who">{user.name} · {user.role}</span>
    <button type="button" className="signout" onClick={signOut}>Sign out</button>
  </>;
}
