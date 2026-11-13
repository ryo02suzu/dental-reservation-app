import type { TileTone } from "@/data";
import { cn } from "./cn";

const TONES: TileTone[] = ["sand", "slate", "sage", "clay", "plum", "ocean", "amber", "graphite"];
const BG: Record<TileTone, string> = {
  sand: "bg-tile-sand/20 text-tile-sand",
  graphite: "bg-fill/14 text-label2",
  slate: "bg-tile-slate/18 text-tile-slate",
  sage: "bg-tile-sage/18 text-tile-sage",
  clay: "bg-tile-clay/16 text-tile-clay",
  plum: "bg-tile-plum/18 text-tile-plum",
  ocean: "bg-tile-ocean/18 text-tile-ocean",
  amber: "bg-tile-amber/18 text-tile-amber",
};

/** 名前から決まる色（同じ人はいつも同じ色） */
export function toneOf(name: string): TileTone {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0;
  return TONES[Math.abs(h) % TONES.length];
}

/** 姓の1文字目を丸に入れたアバター */
export function Avatar({ name, tone, size = 36, className }: { name: string; tone?: TileTone; size?: number; className?: string }) {
  const t = tone ?? toneOf(name);
  return (
    <span
      className={cn("inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold", BG[t], className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      aria-hidden
    >
      {name.trim().charAt(0)}
    </span>
  );
}
