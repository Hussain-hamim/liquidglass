/** Public site URL for metadata, sitemap, and Open Graph. */
export function getSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL;
  if (url) {
    return url.startsWith("http") ? url : `https://${url}`;
  }
  return "http://localhost:3000";
}

/** GitHub repo for this project (showcase site + library). */
export const GITHUB_REPO_URL = "https://github.com/Hussain-hamim/liquidglass";
