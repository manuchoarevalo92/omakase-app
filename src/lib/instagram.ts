import { unstable_cache } from "next/cache";

import { supabase } from "@/src/lib/supabase";

const GRAPH_BASE = "https://graph.instagram.com";
/** El token de larga duración vive 60 días; lo renovamos cuando supera los 7. */
const REFRESH_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
/** 12 posts: desktop muestra 4 filas de 3; móvil oculta los 2 últimos (5 filas de 2). */
const POSTS_LIMIT = 12;

export type InstagramPost = {
  id: string;
  caption: string | null;
  mediaType: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  imageUrl: string;
  permalink: string;
  timestamp: string;
};

export type InstagramFeed = {
  username: string | null;
  posts: InstagramPost[];
};

type TokenRow = {
  access_token: string;
  refreshed_at: string;
};

type MediaItem = {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
};

async function getAccessToken(): Promise<string | null> {
  const { data, error } = await supabase
    .from("instagram_token")
    .select("access_token, refreshed_at")
    .eq("id", 1)
    .maybeSingle<TokenRow>();

  if (error || !data) {
    console.error("[instagram] no se pudo leer el token:", error?.message ?? "fila inexistente");
    return null;
  }

  const ageMs = Date.now() - new Date(data.refreshed_at).getTime();
  if (ageMs < REFRESH_AFTER_MS) {
    return data.access_token;
  }

  // Si la renovación falla seguimos usando el token actual mientras siga vivo.
  try {
    const url = new URL(`${GRAPH_BASE}/refresh_access_token`);
    url.searchParams.set("grant_type", "ig_refresh_token");
    url.searchParams.set("access_token", data.access_token);

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.error("[instagram] refresh falló:", res.status, await res.text());
      return data.access_token;
    }
    const json = (await res.json()) as { access_token?: string };
    if (!json.access_token) {
      return data.access_token;
    }

    await supabase
      .from("instagram_token")
      .update({
        access_token: json.access_token,
        refreshed_at: new Date().toISOString(),
      })
      .eq("id", 1);

    return json.access_token;
  } catch {
    return data.access_token;
  }
}

async function fetchFeed(): Promise<InstagramFeed> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("[instagram] token no disponible en Supabase");
  }

  const profileUrl = new URL(`${GRAPH_BASE}/me`);
  profileUrl.searchParams.set("fields", "username");
  profileUrl.searchParams.set("access_token", token);

  const mediaUrl = new URL(`${GRAPH_BASE}/me/media`);
  mediaUrl.searchParams.set(
    "fields",
    "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp"
  );
  mediaUrl.searchParams.set("limit", String(POSTS_LIMIT));
  mediaUrl.searchParams.set("access_token", token);

  const [profileRes, mediaRes] = await Promise.all([
    fetch(profileUrl, { cache: "no-store" }),
    fetch(mediaUrl, { cache: "no-store" }),
  ]);

  let username: string | null = null;
  if (profileRes.ok) {
    const profile = (await profileRes.json()) as { username?: string };
    username = profile.username ?? null;
  } else {
    const body = await profileRes.text();
    console.error("[instagram] error al pedir perfil:", profileRes.status, body);
    throw new Error(`[instagram] perfil ${profileRes.status}: ${body}`);
  }

  if (!mediaRes.ok) {
    const body = await mediaRes.text();
    console.error("[instagram] error al pedir media:", mediaRes.status, body);
    throw new Error(`[instagram] media ${mediaRes.status}: ${body}`);
  }

  const media = (await mediaRes.json()) as { data?: MediaItem[] };
  const posts = (media.data ?? [])
    .flatMap<InstagramPost>((item) => {
      // Los videos exponen su portada en thumbnail_url; el resto en media_url.
      const imageUrl =
        item.media_type === "VIDEO" ? item.thumbnail_url : item.media_url;
      if (!imageUrl) {
        return [];
      }
      return [
        {
          id: item.id,
          caption: item.caption ?? null,
          mediaType: item.media_type,
          imageUrl,
          permalink: item.permalink,
          timestamp: item.timestamp,
        },
      ];
    })
    .slice(0, POSTS_LIMIT);

  return { username, posts };
}

/**
 * Cacheado 1 hora: las visitas al widget embebido en Wix no golpean la API de Meta
 * en cada carga (límite de ~200 llamadas/hora) y las URLs firmadas del CDN de
 * Instagram se refrescan antes de caducar.
 */
export const getInstagramFeed = unstable_cache(
  fetchFeed,
  ["instagram-feed", String(POSTS_LIMIT)],
  { revalidate: 3600 }
);
