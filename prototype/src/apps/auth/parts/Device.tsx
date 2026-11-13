// サインインの2段目：受付の共用iPadで「この端末を使う人」を選び、4けたのPINで本人を確かめる
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { Check, Delete } from "lucide-react";
import { staff, type Staff } from "@/data";
import { Avatar, cn, spring, springBouncy, tapSoft } from "@/ui";

const PIN = "1234";
/** 前回この端末を使った人（受付の石井さん） */
const LAST_USED = "s6";

// 前回この端末を使った人を先頭に
const ordered = [...staff].sort((a, b) => Number(b.id === LAST_USED) - Number(a.id === LAST_USED));

export function StaffPicker({ onPick, onOther }: { onPick: (s: Staff) => void; onOther: () => void }) {
  return (
    <div className="flex flex-col">
      <h1 className="text-[24px] font-bold leading-[1.35] tracking-[-0.01em] palt">この端末を使う人を<br />選んでください</h1>
      <p className="mt-2 text-[15px] leading-[1.7] text-label2">ひだまり歯科クリニック・受付の共用端末</p>
      <div className="mt-7 grid grid-cols-3 gap-x-2 gap-y-3">
        {ordered.map((s, i) => (
          <motion.button
            key={s.id}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 34, delay: i * 0.03 } }}
            whileTap={tapSoft}
            onClick={() => onPick(s)}
            className="flex flex-col items-center rounded-card px-1 pb-3 pt-4 transition-colors hover:bg-fill/8 active:bg-fill/12"
          >
            <Avatar name={s.name} tone={s.tone} size={64} className={s.id === LAST_USED ? "ring-2 ring-accent/45 ring-offset-2 ring-offset-bg" : undefined} />
            <span className="mt-2.5 w-full truncate text-[14px] font-semibold">{s.name}</span>
            <span className="mt-0.5 text-[12px] text-label2">{s.role}{s.id === LAST_USED && <span className="font-medium text-accent">・前回</span>}</span>
          </motion.button>
        ))}
      </div>
      <button type="button" onClick={onOther} className="mt-6 h-11 self-center px-2 text-[14px] font-medium text-accent">
        別のアカウントでサインイン
      </button>
    </div>
  );
}

export function PinPad({ who, onSuccess, onCancel }: { who: Staff; onSuccess: () => void; onCancel: () => void }) {
  const [pin, setPin] = useState("");
  const [wrong, setWrong] = useState(false);
  const [ok, setOk] = useState(false);
  const shake = useAnimationControls();
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);

  const press = (d: string) => {
    if (ok || pin.length >= 4) return;
    const next = pin + d;
    setWrong(false);
    setPin(next);
    if (next.length === 4) {
      timer.current = setTimeout(() => {
        if (next === PIN) {
          setOk(true);
          timer.current = setTimeout(onSuccess, 520);
        } else {
          setWrong(true);
          shake.start({ x: [0, -14, 14, -9, 9, -3, 0], transition: { duration: 0.44 } }).then(() => setPin(""));
        }
      }, 140);
    }
  };
  const del = () => { if (!ok) setPin(p => p.slice(0, -1)); };

  // パソコンではキーボードの数字でも入力できる
  const ref = useRef({ press, del });
  ref.current = { press, del };
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) ref.current.press(e.key);
      else if (e.key === "Backspace") ref.current.del();
      else if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [onCancel]);

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  const key = "flex h-[76px] w-[76px] items-center justify-center rounded-full select-none transition-colors duration-150";
  const num = "text-[32px] font-normal tnum bg-fill/12 active:bg-fill/28";

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <Avatar name={who.name} tone={who.tone} size={64} />
        <AnimatePresence>
          {ok && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={springBouncy}
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-surface ring-[3px] ring-surface">
              <Check className="h-4 w-4" strokeWidth={3.2} />
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <div className="mt-3 text-[19px] font-semibold palt">{who.name}</div>
      <div className="mt-0.5 text-[13px] text-label2">{ok ? "サインインしています…" : "PINを入力してください"}</div>

      <motion.div animate={shake} className="mt-6 flex h-4 items-center gap-5" aria-live="polite" aria-label={`${pin.length}けた入力済み`}>
        {Array.from({ length: 4 }, (_, i) => {
          const filled = i < pin.length;
          return (
            <span key={i} className={cn("relative h-[13px] w-[13px] rounded-full shadow-[inset_0_0_0_1.5px_rgb(var(--label)/0.55)]", wrong && "shadow-[inset_0_0_0_1.5px_rgb(var(--red))]")}>
              <motion.span
                className={cn("absolute inset-0 rounded-full", wrong ? "bg-red" : "bg-label")}
                initial={false}
                animate={{ scale: filled ? 1 : 0 }}
                transition={filled ? springBouncy : { duration: 0.12 }}
              />
            </span>
          );
        })}
      </motion.div>
      <div className="mt-3 h-5 text-[13px]" aria-live="assertive">
        {wrong ? <span className="font-medium text-red">PINが違います。もう一度入力してください</span> : <span className="text-label3">デモのPINは 1234</span>}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-x-6 gap-y-3.5">
        {keys.map(k => (
          <motion.button key={k} type="button" whileTap={{ scale: 0.92 }} transition={spring} onClick={() => press(k)} aria-label={k}
            className={cn(key, num)}>
            {k}
          </motion.button>
        ))}
        <button type="button" onClick={onCancel} className={cn(key, "text-[15px] font-medium text-accent")}>キャンセル</button>
        <motion.button type="button" whileTap={{ scale: 0.92 }} transition={spring} onClick={() => press("0")} aria-label="0" className={cn(key, num)}>
          0
        </motion.button>
        <button type="button" onClick={del} disabled={!pin.length} aria-label="1文字削除" className={cn(key, "text-label2 disabled:opacity-0")}>
          <Delete className="h-6 w-6" strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}
