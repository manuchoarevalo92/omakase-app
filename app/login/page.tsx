"use client";

import { Suspense, FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { APP_USERS } from "@/src/lib/auth-users";
import { TemaToggle } from "@/app/components/tema-toggle";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch("/api/auth/me", { credentials: "include" });
          const data = (await res.json()) as { session: unknown };
          if (!cancelled && data.session) {
            router.replace(nextPath.startsWith("/") ? nextPath : "/");
          }
        } catch {
          /* seguir en login */
        } finally {
          if (!cancelled) {
            setChecking(false);
          }
        }
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [router, nextPath]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? "No se pudo iniciar sesión.");
        return;
      }
      router.replace(nextPath.startsWith("/") ? nextPath : "/");
      router.refresh();
    } catch {
      setError("Error de red. Intentá de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-ink-400" aria-label="Cargando" />
      </div>
    );
  }

  return (
    <section className="animate-fade-up w-full max-w-sm border border-ink-200 bg-ink-50/80 p-7 backdrop-blur-sm">
      <header className="text-center">
        <p className="font-display text-[1.65rem] leading-none tracking-[0.14em] text-ink">
          OMAKASE
        </p>
        <div className="mx-auto mt-3 h-px w-12 bg-seal/70" />
        <h1 className="mt-5 text-[0.7rem] uppercase tracking-[0.22em] text-ink-400">
          Iniciar sesión
        </h1>
        <p className="mt-2 text-sm text-ink-500">
          Elegí tu usuario y la contraseña del equipo.
        </p>
      </header>

      <form onSubmit={(e) => void onSubmit(e)} className="mt-7 space-y-4">
        <div>
          <label
            htmlFor="username"
            className="mb-1 block text-[0.65rem] font-medium uppercase tracking-[0.16em] text-ink-400"
          >
            Usuario
          </label>
          <select
            id="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full border border-ink-200 bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-seal/60"
          >
            <option value="">Seleccionar…</option>
            {APP_USERS.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-[0.65rem] font-medium uppercase tracking-[0.16em] text-ink-400"
          >
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-ink-200 bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-seal/60"
          />
        </div>

        {error ? (
          <p className="border border-seal/40 bg-seal/10 px-3 py-2 text-sm text-ink">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-2 bg-ink py-3.5 text-[0.7rem] tracking-[0.22em] text-paper transition hover:bg-seal disabled:opacity-60"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              ENTRANDO…
            </>
          ) : (
            "ENTRAR"
          )}
        </button>
      </form>
    </section>
  );
}

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10 text-ink">
      <div className="absolute right-4 top-[calc(env(safe-area-inset-top,0px)+1rem)]">
        <TemaToggle />
      </div>
      <Suspense
        fallback={
          <div className="flex min-h-[50vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-ink-400" aria-label="Cargando" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}
