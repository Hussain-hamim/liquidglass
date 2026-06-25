"use client";

import { Suspense, useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import { presets } from "@/lib/presets";
import { Toast } from "@/components/ui";
import { SiteHeader } from "@/components/SiteHeader";
import { LibrarySection } from "@/components/LibrarySection";
import { GITHUB_REPO_URL } from "@/lib/site-url";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";

const HeroGlassDemo = dynamic(
  () => import("@/components/GlassNavDemo").then((m) => m.GlassNavDemo),
  {
    ssr: false,
    loading: () => (
      <div className="w-full aspect-[16/10] rounded-2xl bg-zinc-900/50 border border-white/[0.06] animate-pulse" />
    ),
  }
);

export function HomePage() {
  const [toast, setToast] = useState({ message: "", visible: false });
  const reducedMotion = usePrefersReducedMotion();

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message: "", visible: false }), 2500);
  };

  return (
    <div className="min-h-screen w-full relative text-foreground glass-page-enter">
      <SiteHeader />

      {/* Hero */}
      <section className="relative pt-14 overflow-hidden">
        {/* Ambient glow */}
        <div
          className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px]"
          style={{
            background:
              "radial-gradient(ellipse at 50% 0%, color-mix(in oklch, var(--primary) 14%, transparent) 0%, color-mix(in oklch, var(--chart-1) 6%, transparent) 40%, transparent 70%)",
          }}
        />

        <div className="relative max-w-5xl mx-auto px-6 pt-8 pb-10 sm:pt-10 sm:pb-14 text-center">
          {/* Heading */}
          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-5 glass-reveal"
            style={{ "--reveal-delay": "0ms" } as CSSProperties}
          >
            <span className="text-white">Liquid Glass</span>
            <br />
            <span
              className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-primary/80 to-chart-1"
            >
              for the modern web
            </span>
          </h1>

          {/* Sub */}
          <p
            className="text-base sm:text-lg text-zinc-500 leading-relaxed max-w-xl mx-auto mb-8 glass-reveal"
            style={{ "--reveal-delay": "80ms" } as CSSProperties}
          >
            Browse, preview, and copy beautiful glass effects into your React project.
            Powered by WebGL — works everywhere.
          </p>

          {/* Glass demo — hero showcase */}
          <div
            className="relative max-w-2xl mx-auto mb-10 glass-reveal"
            style={{ "--reveal-delay": "160ms" } as CSSProperties}
          >
            {/* Glow behind demo */}
            <div
              className="absolute -inset-8 -z-10 rounded-[40px] opacity-60"
              style={{
                background:
                  "radial-gradient(ellipse at 50% 50%, rgba(99,102,241,0.08), rgba(168,85,247,0.05) 40%, transparent 70%)",
              }}
            />
            <div className="w-full aspect-[16/10] rounded-2xl overflow-hidden border border-white/[0.1] shadow-2xl shadow-black/60 ring-1 ring-white/[0.04]">
              <HeroGlassDemo glassEngine="ybouane" />
            </div>
            <p className="text-center text-xs text-zinc-600 mt-4">
              Hover a nav item to interact with the glass dropdown
            </p>
          </div>

          {/* CTAs */}
          <div
            className="flex flex-wrap items-center justify-center gap-3 glass-reveal"
            style={{ "--reveal-delay": "240ms" } as CSSProperties}
          >
            <a
              href="#library"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/85 transition-colors"
            >
              Browse Library
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </a>
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium text-zinc-300 border border-white/[0.1] hover:border-white/[0.2] hover:text-white bg-white/[0.03] transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              GitHub
            </a>
          </div>

          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-card/50 mt-4 glass-reveal"
            style={{ "--reveal-delay": "320ms" } as CSSProperties}
          >
            <span className="relative flex h-2 w-2">
              {!reducedMotion && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 motion-reduce:animate-none" />
              )}
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            <span className="text-xs font-medium text-muted-foreground tracking-wide">
              {presets.length} glass effects ready to copy
            </span>
          </div>

        </div>

        {/* Section divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
      </section>

      {/* Library */}
      <main id="library" className="max-w-6xl mx-auto px-6 py-12">
        <div
          className="mb-8 glass-reveal"
          style={{ "--reveal-delay": "400ms" } as CSSProperties}
        >
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-50 mb-1 tracking-tight">Library</h2>
          <p className="text-zinc-500 text-sm">
            Hover to preview or copy. Controls &amp; media cards are interactive — click or drag.
          </p>
        </div>

        <Suspense
          fallback={
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-2xl bg-zinc-900/50 animate-pulse motion-reduce:animate-none" />
              ))}
            </div>
          }
        >
          <LibrarySection onCopy={showToast} />
        </Suspense>
      </main>

      <footer
        className="border-t border-white/[0.06] py-8 text-center text-xs text-zinc-600 glass-reveal"
        style={{ "--reveal-delay": "480ms" } as CSSProperties}
      >
        LiquidGlass · MIT License
      </footer>

      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
}
