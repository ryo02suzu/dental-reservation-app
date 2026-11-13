import { forwardRef } from "react";
import { motion } from "framer-motion";
import type { Notice } from "@/data";
import { IconTile, cn, springSoft } from "@/ui";
import { KIND, noticeTime } from "./util";

/** お知らせ1件の行（通知センター風：アイコン・件名・本文2行・相対時刻・未読の点） */
export const NoticeRow = forwardRef<HTMLButtonElement, {
  n: Notice;
  now: Date;
  selected?: boolean;
  onClick: () => void;
}>(function NoticeRow({ n, now, selected, onClick }, ref) {
  const k = KIND[n.kind];
  return (
    <motion.button
      ref={ref}
      layout="position"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={springSoft}
      onClick={onClick}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "group relative flex w-full items-start gap-3 py-3 pl-4 pr-4 text-left transition-colors duration-100",
        selected ? "bg-sand/20" : "hover:bg-fill/[0.06] active:bg-fill/14",
      )}
    >
      {!n.read && (
        <span aria-label="未読" className="absolute left-[5px] top-[22px] h-[7px] w-[7px] rounded-full bg-accent" />
      )}
      <span className="mt-px"><IconTile icon={k.icon} tone={k.tone} size={30} /></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className={cn("min-w-0 flex-1 truncate text-[16px] leading-[21px] md:text-[15px] md:leading-5", n.read ? "text-label" : "font-semibold text-label")}>
            {n.title}
          </span>
          <span className={cn("shrink-0 text-[13px] tnum md:text-[12px]", n.read ? "text-label3" : "text-label2")}>{noticeTime(n.at, now)}</span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-[14px] [word-break:auto-phrase] leading-[20px] text-label2 md:text-[13px] md:leading-[19px]">{n.body}</p>
      </div>
      <span aria-hidden className="pointer-events-none absolute bottom-0 left-[58px] right-0 h-px origin-bottom scale-y-50 bg-sep/30 group-last:hidden" />
    </motion.button>
  );
});
