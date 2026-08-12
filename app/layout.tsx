import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { MainNav } from "./components/main-nav";
import { RegisterServiceWorker } from "./components/register-service-worker";

const display = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const body = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

/** Base pública para URLs del manifest e íconos; en Vercel suele inferirse, aquí lo fijamos explícito si hay env. */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: "Omakase App",
  description: "Gestión diaria de menú, platos e ingredientes.",
  applicationName: "Omakase App",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Omakase",
  },
  /**
   * Refuerzo para modo "app" (standalone): Chrome/Android histórico lee mobile-web-app-capable;
   * Apple sigue usando apple-mobile-web-app-capable (lo genera appleWebApp arriba).
   */
  other: {
    "mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0e0d0b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${display.variable} ${body.variable} ${mono.variable} h-full max-w-full overflow-x-clip antialiased`}
    >
      <body className="relative flex min-h-full min-w-0 max-w-full flex-col overflow-x-clip bg-paper text-ink pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        <div className="pointer-events-none fixed inset-0 washi-bg opacity-70" aria-hidden />
        <div className="relative z-10 flex min-h-full min-w-0 w-full max-w-full flex-1 flex-col">
          <RegisterServiceWorker />
          <MainNav />
          <div className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
