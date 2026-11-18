import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { pgPool } from "@/lib/db";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const name = String(body.name || "").trim();
  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const password = String(body.password || "");
  if (name.length < 2 || name.length > 120 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8)
    return NextResponse.json(
      { error: "Enter a name, valid email, and password of at least 8 characters." },
      { status: 400 },
    );
  try {
    const hash = await bcrypt.hash(password, 12);
    const result = await pgPool.query(
      "INSERT INTO users(full_name,email,password_hash,role) VALUES($1,$2,$3,'COMMUTER') RETURNING user_id,full_name,email,role",
      [name, email, hash],
    );
    return NextResponse.json(
      { ok: true, message: "Commuter account created. You can now log in.", user: result.rows[0] },
      { status: 201 },
    );
  } catch (e) {
    if ((e as { code?: string }).code === "23505")
      return NextResponse.json({ error: "That email is already registered." }, { status: 409 });
    console.error(e);
    return NextResponse.json({ error: "Could not create account." }, { status: 500 });
  }
}
