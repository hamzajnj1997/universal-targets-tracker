import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Real-Time Work Ownership Tracker",
    template: "%s | Real-Time Work Ownership Tracker",
  },
  description:
    "A focused live board for team target ownership, claims, blockers, completion, notes, and audit history.",
  applicationName: "Real-Time Work Ownership Tracker",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/app-icon.svg",
    shortcut: "/app-icon.svg",
  },
  openGraph: {
    title: "Real-Time Work Ownership Tracker",
    description:
      "Track available, claimed, blocked, and completed team targets with a clear audit trail.",
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
