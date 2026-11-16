import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
export type UserRole = "ADMIN" | "DEPOT_STAFF" | "COMMUTER";
export type SessionUser = { userId: number; name: string; email: string; role: UserRole };
const cookieName = "routewise_session";
function secret(){const value=process.env.SESSION_SECRET;if(!value||value.length<32)throw new Error("SESSION_SECRET must be set to at least 32 characters");return new TextEncoder().encode(value);}
export async function createSession(user:SessionUser){return new SignJWT(user).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime("8h").sign(secret());}
export async function readSession():Promise<SessionUser|null>{try{const token=cookies().get(cookieName)?.value;if(!token)return null;const {payload}=await jwtVerify(token,secret());if(typeof payload.userId!=="number"||typeof payload.role!=="string")return null;return {userId:payload.userId,name:String(payload.name||""),email:String(payload.email||""),role:payload.role as UserRole};}catch{return null;}}
export const sessionCookieName=cookieName;
// Returns the signed-in user if their role is allowed, otherwise null.
export async function requireRole(...roles:UserRole[]):Promise<SessionUser|null>{const user=await readSession();return user&&roles.includes(user.role)?user:null;}
