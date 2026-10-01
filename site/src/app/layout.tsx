import type { Metadata } from "next";
import { Azeret_Mono, Figtree } from "next/font/google";

import { SITE, SITE_URL } from "@/data/site";

import "./globals.css";

const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });
const azeretMono = Azeret_Mono({ variable: "--font-azeret-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE.title,
  description: SITE.description,
  alternates: { canonical: "/" },
  openGraph: { title: SITE.title, description: SITE.description, type: "website", url: "/" },
  robots: { index: true, follow: true, "max-snippet": -1 },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${figtree.variable} ${azeretMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
