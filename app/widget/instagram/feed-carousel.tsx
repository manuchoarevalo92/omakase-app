"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight, Copy, Play } from "lucide-react";

import type { InstagramPost } from "@/src/lib/instagram";

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

export function FeedCarousel({ posts }: { posts: InstagramPost[] }) {
  const scrollerRef = useRef<HTMLUListElement>(null);

  const scrollByViewport = (direction: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) {
      return;
    }
    el.scrollBy({ left: direction * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="group/carousel relative">
      <ul
        ref={scrollerRef}
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {posts.map((post) => (
          <li
            key={post.id}
            className="relative w-[calc((100%-0.5rem)/2)] flex-none snap-start sm:w-[calc((100%-1rem)/3)]"
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
                    <Play className="h-3.5 w-3.5 fill-white text-white" aria-hidden />
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

      <button
        type="button"
        onClick={() => scrollByViewport(-1)}
        aria-label="Anteriores"
        className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-black/35 p-1.5 text-white/80 opacity-0 transition hover:bg-black/60 hover:text-white group-hover/carousel:opacity-100"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => scrollByViewport(1)}
        aria-label="Siguientes"
        className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-black/35 p-1.5 text-white/80 opacity-0 transition hover:bg-black/60 hover:text-white group-hover/carousel:opacity-100"
      >
        <ChevronRight className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );
}
