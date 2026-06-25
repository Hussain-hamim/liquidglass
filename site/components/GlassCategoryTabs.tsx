"use client";

export function GlassCategoryTabs({
  categories,
  active,
  onChange,
}: {
  categories: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((cat) => {
        const isActive = active === cat.id;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onChange(cat.id)}
            className={`glass-tab shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium ${
              isActive
                ? "glass-tab-active bg-primary text-primary-foreground"
                : "text-muted-foreground border border-border hover:text-foreground hover:border-border/80 bg-card/40"
            }`}
            aria-pressed={isActive}
          >
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}
