"use client";

import { Suspense, FormEvent, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CircleAlert } from "lucide-react";

import { APP_USERS } from "@/src/lib/auth-users";
import { TemaToggle } from "@/app/components/tema-toggle";
import { Boton, Campo, Esqueleto, cx, vibrar } from "@/app/ui";

/** Marca: OMAKASE en Cormorant con la línea roja del sello. */
function Marca() {
  return (
    <header className="text-center">
      <p className="font-display text-[2.6rem] font-semibold leading-none tracking-[0.14em] text-label">
        OMAKASE
      </p>
      <span
        className="mx-auto mt-4 block h-[3px] w-10 rounded-full bg-accent"
        aria-hidden
      />
      <h1 className="mt-4 text-[0.8rem] font-semibold uppercase tracking-[0.18em] text-label-3">
        Iniciar sesión
      </h1>
    </header>
  );
}

/** Mientras se verifica la sesión: la marca y el formulario en esqueleto. */
function LoginCargando() {
  return (
    <div role="status" aria-label="Cargando" className="w-full max-w-sm">
      <Marca />
      <div className="mt-8 space-y-5">
        <Esqueleto className="h-12 w-full" />
        <Esqueleto className="h-12 w-full" />
        <Esqueleto className="h-[3.25rem] w-full" />
      </div>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);
  const botonRef = useRef<HTMLButtonElement>(null);

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

  /** Con el teclado abierto en el celular, que el botón Entrar quede a la vista. */
  const mostrarBoton = () => {
    window.setTimeout(() => {
      botonRef.current?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }, 300);
  };

  if (checking) {
    return <LoginCargando />;
  }

  return (
    <div className="animate-fade-up w-full max-w-sm">
      <Marca />

      <form onSubmit={(e) => void onSubmit(e)} className="mt-8 space-y-5">
        <fieldset className="min-w-0">
          <legend className="mb-1.5 block pl-1 text-[0.82rem] font-medium text-label-2">
            Usuario
          </legend>
          <div
            role="radiogroup"
            aria-label="Usuario"
            className="grid grid-cols-3 gap-2"
          >
            {APP_USERS.map((u) => {
              const activo = username === u.id;
              return (
                <button
                  key={u.id}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  onClick={() => {
                    if (!activo) vibrar();
                    setUsername(u.id);
                  }}
                  className={cx(
                    "inline-flex min-h-12 min-w-0 items-center justify-center truncate rounded-control px-2 text-[1rem] transition active:scale-[0.97]",
                    activo
                      ? "bg-accent font-semibold text-on-accent"
                      : "bg-fill text-label hover:bg-fill-strong",
                  )}
                >
                  {u.displayName}
                </button>
              );
            })}
          </div>
        </fieldset>

        <Campo
          id="password"
          label="Contraseña"
          type="password"
          required
          autoComplete="current-password"
          enterKeyHint="go"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onFocus={mostrarBoton}
        />

        {error ? (
          <div
            role="alert"
            className="flex gap-3 rounded-card bg-danger-soft px-4 py-3 text-[0.94rem] text-danger"
          >
            <CircleAlert
              className="mt-0.5 h-[18px] w-[18px] shrink-0"
              aria-hidden
            />
            <p className="min-w-0 flex-1">{error}</p>
          </div>
        ) : null}

        <Boton
          ref={botonRef}
          type="submit"
          tamano="grande"
          ancho
          cargando={isSubmitting}
          disabled={!username}
          className="scroll-mb-4"
        >
          {isSubmitting ? "Entrando…" : "Entrar"}
        </Boton>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="relative flex flex-1 flex-col items-center px-5 pb-10 pt-14 text-label sm:justify-center sm:pt-10">
      <div className="absolute right-3 top-3">
        <TemaToggle />
      </div>
      <Suspense fallback={<LoginCargando />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
