import type { Metadata } from "next";
import { Copy, Play } from "lucide-react";

import { getInstagramFeed, type InstagramPost } from "@/src/lib/instagram";

export const metadata: Metadata = {
  title: "Instagram · Yuku Barra",
  robots: { index: false, follow: false },
};

// Página pública pensada para embeberse como iframe en Wix.
// El dato ya viene cacheado 1 hora desde getInstagramFeed.
export const dynamic = "force-dynamic";

/** En móvil solo se muestran los primeros MOBILE_LIMIT posts (5 filas de 2). */
const MOBILE_LIMIT = 10;

function altFor(post: InstagramPost): string {
  if (!post.caption) {
    return "Publicación de Instagram";
  }
  const oneLine = post.caption.replace(/\s+/g, " ").trim();
  return oneLine.length > 120 ? `${oneLine.slice(0, 117)}…` : oneLine;
}

function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

export default async function InstagramWidgetPage() {
  const { username, posts } = await getInstagramFeed();
  const profileUrl = username
    ? `https://www.instagram.com/${username}/`
    : "https://www.instagram.com/";

  return (
    <main className="w-full px-1 py-1 font-sans">
      {/* Fondo transparente: el iframe deja ver la foto de fondo del sitio en Wix. */}
      <style>{`html, body { background: transparent !important; }`}</style>
      <div className="mx-auto w-full max-w-5xl">
        {posts.length === 0 ? (
          <p className="py-10 text-center text-sm text-neutral-400">
            No se pudieron cargar las publicaciones.{" "}
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Ver el perfil en Instagram
            </a>
          </p>
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {posts.map((post, index) => (
                <li
                  key={post.id}
                  className={`relative ${index >= MOBILE_LIMIT ? "hidden sm:block" : ""}`}
                >
                  <a
                    href={post.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={altFor(post)}
                    className="group block overflow-hidden bg-neutral-900/40"
                  >
                    <img
                      src={post.imageUrl}
                      alt={altFor(post)}
                      loading="lazy"
                      className="aspect-square w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                    {post.mediaType !== "IMAGE" ? (
                      <span className="absolute bottom-2 right-2 rounded-md bg-black/55 p-1.5">
                        {post.mediaType === "VIDEO" ? (
                          <Play
                            className="h-3.5 w-3.5 fill-white text-white"
                            aria-hidden
                          />
                        ) : (
                          <Copy className="h-3.5 w-3.5 text-white" aria-hidden />
                        )}
                      </span>
                    ) : null}
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition duration-300 group-hover:bg-black/35 group-hover:opacity-100">
                      <InstagramGlyph className="h-6 w-6 text-white" />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-center">
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs tracking-wide text-neutral-400 transition hover:text-neutral-200"
              >
                {username ? `@${username}` : "Instagram"}
              </a>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
