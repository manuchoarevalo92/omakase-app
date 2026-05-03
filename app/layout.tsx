import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { MainNav } from "./components/main-nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Omakase App",
  description: "Gestión diaria de menú, platos e ingredientes.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full max-w-full overflow-x-clip antialiased`}
    >
      <body className="flex min-h-full min-w-0 max-w-full flex-col overflow-x-clip bg-zinc-950 pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        <MainNav />
        <div className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
