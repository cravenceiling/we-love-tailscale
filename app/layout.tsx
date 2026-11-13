import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const archivo = localFont({ src: "./archivo.ttf", variable: "--font-archivo", weight: "100 900", display: "swap" });

export const metadata: Metadata = {
  title: "Tailscale love",
  description: "Public posts from people who got a little emotional about networking software. An unofficial fan page.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={archivo.variable}>
      <body>{children}</body>
    </html>
  );
}
