import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Universal Targets Tracker",
    template: "%s | Universal Targets Tracker",
  },
  description:
    "A customizable target-debt tracker for recurring goals, backlog, progress, members, and catch-up planning.",
  applicationName: "Universal Targets Tracker",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/app-icon.svg",
    shortcut: "/app-icon.svg",
  },
  openGraph: {
    title: "Universal Targets Tracker",
    description:
      "Track recurring targets, missed work, backlog, progress, members, and catch-up status.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#020617",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
