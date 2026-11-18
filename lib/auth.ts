import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { pgPool } from "@/lib/db";
export type UserRole = "ADMIN" | "DEPOT_STAFF" | "COMMUTER";
export type SessionUser = { userId: number; name: string; email: string; role: UserRole };
const cookieName = "routewise_session";
function secret(){const value=process.env.SESSION_SECRET;if(!value||value.length<32)throw new Error("SESSION_SECRET must be set to at least 32 characters");return new TextEncoder().encode(value);}
export async function createSession(user:SessionUser){return new SignJWT(user).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime("8h").sign(secret());}
export async function readSession():Promise<SessionUser|null>{try{const token=cookies().get(cookieName)?.value;if(!token)return null;const {payload}=await jwtVerify(token,secret());if(typeof payload.userId!=="number"||typeof payload.role!=="string")return null;return {userId:payload.userId,name:String(payload.name||""),email:String(payload.email||""),role:payload.role as UserRole};}catch{return null;}}
export const sessionCookieName=cookieName;
// The signed-in user, re-checked against the users table. A deleted account gets null
// even if its session cookie has not expired yet; the role is always the current one.
export async function currentUser():Promise<SessionUser|null>{
  const session=await readSession(); if(!session) return null;
  const r=await pgPool.query("SELECT user_id, full_name, email, role FROM users WHERE user_id = $1",[session.userId]);
  if(!r.rowCount) return null;
  const u=r.rows[0];
  return {userId:Number(u.user_id),name:u.full_name,email:u.email,role:u.role as UserRole};
}
// Returns the signed-in user if their role is allowed, otherwise null.
export async function requireRole(...roles:UserRole[]):Promise<SessionUser|null>{const user=await currentUser();return user&&roles.includes(user.role)?user:null;}
