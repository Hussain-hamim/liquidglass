"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { presets, CATEGORIES } from "@/lib/presets";
import { SearchBar, Toast } from "@/components/ui";
import { SiteHeader } from "@/components/SiteHeader";
import { GlassCategoryTabs } from "@/components/GlassCategoryTabs";

const PresetCard = dynamic(
  () => import("@/components/PresetCard").then((m) => m.PresetCard),
  { ssr: false }
);

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
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState({ message: "", visible: false });

  const filtered = useMemo(() => {
    return presets.filter((p) => {
      const matchCat = category === "all" || p.category === category;
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.category.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [category, search]);

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message: "", visible: false }), 2500);
  };

  return (
    <div className="min-h-screen w-full relative text-zinc-50">
      <SiteHeader />

      {/* Hero */}
      <section className="relative pt-14 overflow-hidden">
        {/* Ambient glow */}
        <div
          className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px]"
          style={{
            background:
              "radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.12) 0%, rgba(99,102,241,0.04) 40%, transparent 70%)",
          }}
        />

        <div className="relative max-w-5xl mx-auto px-6 pt-8 pb-10 sm:pt-10 sm:pb-14 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/[0.08] bg-white/[0.04] mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span className="text-xs font-medium text-zinc-400 tracking-wide">
              {presets.length} ready-to-use patterns
            </span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-5">
            <span className="text-white">Liquid Glass</span>
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-zinc-400 via-zinc-300 to-zinc-500">
              for the modern web
            </span>
          </h1>

          {/* Sub */}
          <p className="text-base sm:text-lg text-zinc-500 leading-relaxed max-w-xl mx-auto mb-8">
            Browse, preview, and copy beautiful glass effects into your React project.
            Powered by WebGL — works everywhere.
          </p>

          {/* Glass demo — hero showcase */}
          <div className="relative max-w-2xl mx-auto mb-10">
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
          <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
            <a
              href="#library"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white text-zinc-950 text-sm font-semibold hover:bg-zinc-200 transition-colors"
            >
              Browse Library
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </a>
            <a
              href="https://github.com/ybouane/liquidglass"
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

          {/* Install command */}
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-3 px-5 py-2.5 rounded-xl bg-zinc-900/60 border border-white/[0.06]">
              <span className="text-emerald-400 text-xs font-mono">$</span>
              <code className="text-[13px] text-zinc-300 font-mono">
                npm i @ybouane/liquidglass
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText("npm i @ybouane/liquidglass");
                  showToast("Copied install command!");
                }}
                className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-colors"
                title="Copy"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Section divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
      </section>

      {/* Library */}
      <main id="library" className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-50 mb-1 tracking-tight">Library</h2>
          <p className="text-zinc-500 text-sm">
            Hover to preview or copy. Controls &amp; media cards are interactive — click or drag.
          </p>
        </div>

        <div className="mb-6">
          <GlassCategoryTabs categories={CATEGORIES} active={category} onChange={setCategory} />
        </div>

        <div className="mb-6">
          <SearchBar value={search} onChange={setSearch} />
        </div>

        <p className="text-sm text-zinc-500 mb-6">
          {filtered.length} pattern{filtered.length !== 1 ? "s" : ""}
          {category !== "all" ? ` in ${CATEGORIES.find((c) => c.id === category)?.label}` : ""}
        </p>

        {filtered.length === 0 ? (
          <div className="text-center py-20 text-zinc-600">No patterns found.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((preset) => (
              <PresetCard key={preset.id} preset={preset} onCopy={showToast} />
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-white/[0.06] py-8 text-center text-xs text-zinc-600">
        LiquidGlass · MIT License
      </footer>

      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
}
