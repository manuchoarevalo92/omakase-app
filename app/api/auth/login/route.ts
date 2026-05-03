import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { findAppUser, getExpectedPassword } from "@/src/lib/auth-users";
import { createSessionToken } from "@/src/lib/auth-session";

function safeEqualPassword(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, "utf8");
    const bufB = Buffer.from(b, "utf8");
    if (bufA.length !== bufB.length) {
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
    };
    const username = body.username ?? "";
    const password = body.password ?? "";

    const user = findAppUser(username);
    if (!user) {
      return NextResponse.json(
        { error: "Usuario o contraseña incorrectos." },
        { status: 401 }
      );
    }

    const expected = getExpectedPassword(user);
    if (!expected || !safeEqualPassword(password, expected)) {
      return NextResponse.json(
        { error: "Usuario o contraseña incorrectos." },
        { status: 401 }
      );
    }

    const token = await createSessionToken({
      sub: user.id,
      role: user.role,
      name: user.displayName,
    });

    const res = NextResponse.json({ ok: true, role: user.role });
    res.cookies.set("omakase_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error al iniciar sesión.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
