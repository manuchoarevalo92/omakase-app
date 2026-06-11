import type { Metadata } from "next";

import { getInstagramFeed } from "@/src/lib/instagram";
import { FeedCarousel } from "./feed-carousel";

export const metadata: Metadata = {
  title: "Instagram · Yuku Barra",
  robots: { index: false, follow: false },
};

// Página pública pensada para embeberse como iframe en Wix.
// El dato ya viene cacheado 1 hora desde getInstagramFeed.
export const dynamic = "force-dynamic";

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
            <FeedCarousel posts={posts} />
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
