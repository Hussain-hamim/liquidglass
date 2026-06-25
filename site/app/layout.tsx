import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { BRAND } from "@/lib/brand";
import { getSiteUrl } from "@/lib/site-url";
import { cn } from "@/lib/utils";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
});

const siteUrl = getSiteUrl();
const title = "LiquidGlass — WebGL Glass Effects for the Web";
const description =
  "Browse, preview, and copy ready-to-use React components for realistic liquid glass effects.";

export const viewport: Viewport = {
  themeColor: "#18181b",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  alternates: {
    canonical: siteUrl,
  },
  icons: {
    icon: [
      { url: BRAND.favicon, sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title,
    description,
    url: siteUrl,
    siteName: "LiquidGlass",
    images: [{ url: "/banner.jpg", width: 1200, height: 630, alt: "LiquidGlass" }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/banner.jpg"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "LiquidGlass",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web",
  description,
  url: siteUrl,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("dark", outfit.variable)}>
      <body className={cn("min-h-screen font-sans")}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <div className="layout-content">{children}</div>
        <Analytics />
      </body>
    </html>
  );
}
