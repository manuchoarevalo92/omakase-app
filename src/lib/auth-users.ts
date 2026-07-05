export type UserRole = "admin" | "staff";

export type AppUser = {
  id: string;
  displayName: string;
  role: UserRole;
  /** Nombre de variable en .env (ej. AUTH_PASSWORD_MANU) */
  passwordEnv: string;
};

/** Manu = todo; Javi y Santi = menú, MEP, ingredientes, pedidos, etc. */
export const APP_USERS: AppUser[] = [
  {
    id: "manu",
    displayName: "Manu",
    role: "admin",
    passwordEnv: "AUTH_PASSWORD_MANU",
  },
  {
    id: "javi",
    displayName: "Javi",
    role: "staff",
    passwordEnv: "AUTH_PASSWORD_JAVI",
  },
  {
    id: "santi",
    displayName: "Santi",
    role: "staff",
    passwordEnv: "AUTH_PASSWORD_SANTI",
  },
];

export function findAppUser(username: string): AppUser | undefined {
  const key = username.trim().toLowerCase();
  return APP_USERS.find((u) => u.id === key);
}

export function getExpectedPassword(user: AppUser): string | undefined {
  const raw = process.env[user.passwordEnv];
  return typeof raw === "string" && raw.length > 0 ? raw : undefined;
}
