import Image from "next/image";
import { BRAND } from "@/lib/brand";

type SiteLogoProps = {
  variant?: "header" | "hero" | "icon" | "full";
  className?: string;
  priority?: boolean;
};

export function SiteLogo({
  variant = "header",
  className = "",
  priority = false,
}: SiteLogoProps) {
  if (variant === "icon") {
    return (
      <Image
        src={BRAND.logoIcon}
        alt=""
        width={32}
        height={32}
        className={className}
        priority={priority}
        aria-hidden
      />
    );
  }

  if (variant === "full" || variant === "hero") {
    return (
      <Image
        src={BRAND.logoTransparent}
        alt={`${BRAND.name} — ${BRAND.tagline}`}
        width={1254}
        height={1254}
        className={`w-full h-auto ${className}`}
        priority={priority}
      />
    );
  }

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Image
        src={BRAND.logoIcon}
        alt=""
        width={28}
        height={28}
        className="shrink-0"
        priority={priority}
        aria-hidden
      />
      <span className="text-sm font-semibold text-zinc-100 tracking-wide">
        {BRAND.name}
      </span>
    </span>
  );
}
