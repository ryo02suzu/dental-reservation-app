import { BellRing, ClipboardList, Hourglass, MessageCircle, MessageSquareText, Puzzle } from "lucide-react";
import type { TileTone } from "@/data";
import type { LucideIcon } from "lucide-react";

/** オプションごとのアイコン・色・表の見出し用の短い名前 */
export const ADDON_META: Record<string, { icon: LucideIcon; tone: TileTone; short: string }> = {
  line_reminder: { icon: MessageCircle, tone: "sage", short: "LINE" },
  sms_pack: { icon: MessageSquareText, tone: "ocean", short: "SMS" },
  recall: { icon: BellRing, tone: "clay", short: "リコール" },
  waitlist: { icon: Hourglass, tone: "amber", short: "キャンセル待ち" },
  questionnaire: { icon: ClipboardList, tone: "slate", short: "問診票" },
};
export const addonMeta = (key: string) => ADDON_META[key] ?? { icon: Puzzle, tone: "graphite" as TileTone, short: key };
