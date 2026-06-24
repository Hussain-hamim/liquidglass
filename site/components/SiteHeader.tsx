import Link from "next/link";
import { GITHUB_REPO_URL } from "@/lib/site-url";

export function SiteHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06] bg-black/70 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="text-sm font-semibold text-zinc-100 tracking-tight">
          LiquidGlass
        </Link>
        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          GitHub
        </a>
      </div>
    </header>
  );
}
