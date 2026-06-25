"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { presets, CATEGORIES } from "@/lib/presets";
import { SearchBar } from "@/components/ui";
import { GlassCategoryTabs } from "@/components/GlassCategoryTabs";

const PresetCard = dynamic(
  () => import("@/components/PresetCard").then((m) => m.PresetCard),
  { ssr: false },
);

export function LibrarySection({ onCopy }: { onCopy: (message: string) => void }) {
  const searchParams = useSearchParams();
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

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

  const syncUrl = useCallback((presetId: string | null, open: boolean) => {
    const url = new URL(window.location.href);
    if (open && presetId) {
      url.searchParams.set("preset", presetId);
    } else {
      url.searchParams.delete("preset");
    }
    window.history.pushState({}, "", url);
    setActivePresetId(open ? presetId : null);
  }, []);

  useEffect(() => {
    const presetParam = searchParams.get("preset");
    if (!presetParam) {
      setActivePresetId(null);
      return;
    }
    setActivePresetId(presetParam);
    requestAnimationFrame(() => {
      document.getElementById(`preset-${presetParam}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }, [searchParams]);

  useEffect(() => {
    const onPopState = () => {
      const id = new URL(window.location.href).searchParams.get("preset");
      setActivePresetId(id);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return (
    <>
      <div className="mb-6">
        <GlassCategoryTabs categories={CATEGORIES} active={category} onChange={setCategory} />
      </div>

      <div className="mb-6">
        <SearchBar value={search} onChange={setSearch} />
      </div>

      <p className="text-sm text-zinc-500 mb-6 glass-filter-enter">
        {filtered.length} glass effect{filtered.length !== 1 ? "s" : ""}
        {category !== "all" ? ` in ${CATEGORIES.find((c) => c.id === category)?.label}` : ""}
      </p>

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-zinc-600 glass-filter-enter">No patterns found.</div>
      ) : (
        <div
          key={`${category}-${search}`}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 glass-filter-enter"
        >
          {filtered.map((preset, index) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              onCopy={onCopy}
              forceOpen={activePresetId === preset.id}
              onOpenChange={(open) => syncUrl(preset.id, open)}
              revealIndex={index}
            />
          ))}
        </div>
      )}
    </>
  );
}
