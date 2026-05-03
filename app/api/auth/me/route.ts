import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { verifySessionToken } from "@/src/lib/auth-session";

export async function GET() {
  const token = (await cookies()).get("omakase_session")?.value;
  const session = await verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ session: null });
  }
  return NextResponse.json({
    session: {
      id: session.sub,
      name: session.name,
      role: session.role,
    },
  });
}
