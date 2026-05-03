import { SignJWT, jwtVerify } from "jose";

export type SessionClaims = {
  sub: string;
  role: "admin" | "staff";
  name: string;
};

const COOKIE_NAME = "omakase_session";

export { COOKIE_NAME };

function getSecretKey(): Uint8Array | null {
  const raw = process.env.AUTH_SECRET;
  if (!raw || raw.length < 32) {
    return null;
  }
  return new TextEncoder().encode(raw);
}

export async function createSessionToken(claims: SessionClaims): Promise<string> {
  const secret = getSecretKey();
  if (!secret) {
    throw new Error(
      "AUTH_SECRET no configurado o tiene menos de 32 caracteres (revisá .env.local)."
    );
  }

  return await new SignJWT({
    role: claims.role,
    name: claims.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifySessionToken(
  token: string | undefined
): Promise<SessionClaims | null> {
  if (!token) {
    return null;
  }
  const secret = getSecretKey();
  if (!secret) {
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    const sub = typeof payload.sub === "string" ? payload.sub : "";
    const role = payload.role === "admin" || payload.role === "staff" ? payload.role : null;
    const name = typeof payload.name === "string" ? payload.name : "";
    if (!sub || !role) {
      return null;
    }
    return { sub, role, name };
  } catch {
    return null;
  }
}
