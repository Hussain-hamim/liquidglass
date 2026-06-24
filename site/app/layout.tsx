import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { BRAND } from "@/lib/brand";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

const siteUrl = getSiteUrl();
const title = "LiquidGlass — WebGL Glass Effects for the Web";
const description =
  "Browse, preview, and copy ready-to-use React components for realistic liquid glass effects.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  icons: {
    icon: [
      { url: BRAND.favicon, sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-48.png", sizes: "48x48", type: "image/png" },
    ],
    apple: BRAND.appleTouchIcon,
  },
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="layout-content">{children}</div>
      </body>
    </html>
  );
}
