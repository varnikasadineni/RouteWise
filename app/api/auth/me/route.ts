import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const user = await currentUser();
    return NextResponse.json({ user });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ user: null });
  }
}
