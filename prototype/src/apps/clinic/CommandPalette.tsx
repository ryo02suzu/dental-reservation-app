import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import { Drawer } from "vaul";
import {
  BarChart3, Bell, BellRing, CalendarClock, CalendarDays, CalendarPlus, CircleX, CornerDownLeft, NotebookPen, Plus, Search, Settings, Sun, Users,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useRoute } from "@/lib/nav";
import { useIsPhone } from "@/lib/media";
import { TODAY_KEY, minutesOfDay, useNow } from "@/lib/clock";
import { hm, matchesPatient, toKatakana } from "@/lib/format";
import { serviceById, staffById, unitById, type Appointment, type Patient } from "@/data";
import { Avatar, SearchField, StatusPill, cn, spring } from "@/ui";
import { useClinicUI } from "./context";
import { statusOf } from "./helpers";
import { ageOf, pushRecentPatient, useRecentPatients, visitLabel } from "./sheets/logic";
import type { LucideIcon } from "lucide-react";

// ─── 検索の対象 ───────────────────────────────────────────────────────────────
const SCREENS: { id: string; title: string; icon: LucideIcon; words: string[] }[] = [
  { id: "today", title: "今日", icon: Sun, words: ["きょう", "today", "受付", "うけつけ", "ほんじつ"] },
  { id: "schedule", title: "予約台帳", icon: CalendarDays, words: ["よやく", "だいちょう", "台帳", "カレンダー", "schedule"] },
  { id: "patients", title: "患者", icon: Users, words: ["かんじゃ", "患者一覧", "patients"] },
  { id: "notifications", title: "お知らせ", icon: Bell, words: ["おしらせ", "通知", "つうち"] },
  { id: "records", title: "診療メモ", icon: NotebookPen, words: ["しんりょう", "メモ", "申し送り", "もうしおくり"] },
  { id: "recall", title: "リコール", icon: BellRing, words: ["りこーる", "定期検診", "ていきけんしん"] },
  { id: "reports", title: "レポート", icon: BarChart3, words: ["れぽーと", "分析", "売上", "うりあげ"] },
  { id: "staff", title: "シフト・勤怠", icon: CalendarClock, words: ["しふと", "きんたい", "出勤", "しゅっきん", "スタッフ"] },
  { id: "settings", title: "設定", icon: Settings, words: ["せってい", "診療時間", "メニュー"] },
];
const NEW_WORDS = ["新規予約", "しんきよやく", "よやくをとる", "予約を取る", "予約を登録", "new", "追加"];
const norm = (s: string) => toKatakana(s.toLowerCase()).replace(/[\s・]/g, "");

type Item =
  | { kind: "patient"; key: string; p: Patient }
  | { kind: "appt"; key: string; a: Appointment }
  | { kind: "screen"; key: string; screen: (typeof SCREENS)[number] }
  | { kind: "new"; key: string; p?: Patient };
interface Group { title: string; items: Item[] }

/** 全体検索（⌘K）。PCは画面上部に浮かぶパネル、スマホは全画面のシート */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const phone = useIsPhone();
  const ui = useClinicUI();
  const { route } = useRoute();
  const store = useStore();
  const nowD = useNow(30_000);
  const recentIds = useRecentPatients();
  const [q, setQ] = useState("");
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setQ("");
  }

  // 患者の画面を開いたら「最近見た患者」に入れる
  useEffect(() => {
    if (route.screen === "patients" && route.param && store.patients.some(p => p.id === route.param)) pushRecentPatient(route.param);
  }, [route.screen, route.param]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo<Group[]>(() => {
    const nowMin = minutesOfDay(nowD);
    const today = store.appointments.filter(a => a.date === TODAY_KEY).sort((x, y) => x.start - y.start || x.unitId.localeCompare(y.unitId));
    const query = q.trim();
    if (!query) {
      // 最近見た患者（足りない分は、今日診た患者さん）
      const seenToday = today
        .filter(a => a.status === "completed" || a.status === "in_progress")
        .sort((x, y) => y.start - x.start)
        .map(a => a.patientId);
      const ids = [...new Set([...recentIds, ...seenToday])].slice(0, 4);
      const next = today.filter(a => (a.status === "confirmed" || a.status === "pending" || a.status === "arrived") && a.end > nowMin).slice(0, 5);
      return [
        { title: "最近見た患者", items: ids.map(id => store.patients.find(p => p.id === id)).filter((p): p is Patient => !!p).map(p => ({ kind: "patient" as const, key: `p-${p.id}`, p })) },
        { title: "今日の次の予約", items: next.map(a => ({ kind: "appt" as const, key: `a-${a.id}`, a })) },
        { title: "操作", items: [{ kind: "new" as const, key: "new" }] },
      ].filter(g => g.items.length);
    }
    const nq = norm(query);
    const kq = toKatakana(query).replace(/\s/g, "");
    const plain = query.replace(/\s/g, "");
    const rank = (p: Patient) => (p.name.replace(/\s/g, "").startsWith(plain) || p.kana.replace(/\s/g, "").startsWith(kq) ? 0 : 1);
    const pats = store.patients.filter(p => matchesPatient(p, query)).sort((a, b) => rank(a) - rank(b) || a.kana.localeCompare(b.kana, "ja")).slice(0, 5);
    const digits = query.replace(/\D/g, "");
    const appts = today
      .filter(a => {
        const p = store.patients.find(x => x.id === a.patientId);
        const sv = serviceById(a.serviceId);
        const st = staffById(a.staffId);
        return (p && matchesPatient(p, query)) || norm(sv.name).includes(nq) || norm(st.name).includes(nq) || hm(a.start).startsWith(query) || (digits.length >= 3 && hm(a.start).replace(":", "") === digits);
      })
      .slice(0, 5);
    const screens = SCREENS.filter(s => [s.title, ...s.words].some(w => norm(w).includes(nq)));
    const actions: Item[] = [];
    if (pats[0]) actions.push({ kind: "new", key: `new-${pats[0].id}`, p: pats[0] });
    if (NEW_WORDS.some(w => norm(w).includes(nq)) || (!pats.length && !appts.length && !screens.length)) actions.push({ kind: "new", key: "new" });
    return [
      { title: "患者", items: pats.map(p => ({ kind: "patient" as const, key: `p-${p.id}`, p })) },
      { title: "今日の予約", items: appts.map(a => ({ kind: "appt" as const, key: `a-${a.id}`, a })) },
      { title: "移動", items: screens.map(s => ({ kind: "screen" as const, key: `s-${s.id}`, screen: s })) },
      { title: "操作", items: actions },
    ].filter(g => g.items.length);
  }, [q, store.appointments, store.patients, recentIds, nowD]);

  const flat = useMemo(() => groups.flatMap(g => g.items), [groups]);
  const run = (it: Item) => {
    if (it.kind === "patient") { pushRecentPatient(it.p.id); ui.go("patients", it.p.id); }
    else if (it.kind === "appt") ui.openAppointment(it.a.id);
    else if (it.kind === "screen") ui.go(it.screen.id);
    else ui.openNew(it.p ? { patientId: it.p.id } : undefined);
  };
  const noResults = q.trim() !== "" && flat.length === 0;

  return phone ? (
    <PhoneSheet open={open} onClose={onClose} q={q} setQ={setQ} groups={groups} run={run} nowD={nowD} empty={noResults} />
  ) : (
    <Panel open={open} onClose={onClose} q={q} setQ={setQ} groups={groups} flat={flat} run={run} nowD={nowD} empty={noResults} />
  );
}

// ─── PC：上部に浮かぶパネル ─────────────────────────────────────────────────
function Panel({ open, onClose, q, setQ, groups, flat, run, nowD, empty }: {
  open: boolean; onClose: () => void; q: string; setQ: (v: string) => void; groups: Group[]; flat: Item[]; run: (it: Item) => void; nowD: Date; empty: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const hl = useId();
  const [active, setActive] = useState(0);
  const byKey = useRef(false);
  const composing = useRef(false);
  // 文字が変わったら先頭を選ぶ
  useEffect(() => setActive(0), [q, open]);
  const idx = Math.min(active, Math.max(0, flat.length - 1));
  useEffect(() => {
    if (!byKey.current) return;
    byKey.current = false;
    list.current?.querySelector(`[data-idx="${idx}"]`)?.scrollIntoView({ block: "nearest" });
  }, [idx]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return; // 変換中の矢印・Enterは日本語入力のためのもの
    const n = flat.length;
    const down = e.key === "ArrowDown" || (e.ctrlKey && e.key === "n");
    const up = e.key === "ArrowUp" || (e.ctrlKey && e.key === "p");
    if ((down || up) && n) {
      e.preventDefault();
      byKey.current = true;
      setActive((idx + (down ? 1 : -1) + n) % n);
    } else if (e.key === "Enter" && n) {
      e.preventDefault();
      run(flat[idx]);
    }
  };
  const current = flat[idx];
  const hint = !current ? "" : current.kind === "patient" ? "患者を開く" : current.kind === "appt" ? "予約を開く" : current.kind === "screen" ? "移動" : "新規予約";
  let n = -1;

  return (
    <Dialog.Root open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-[60] bg-black/15" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }} />
            </Dialog.Overlay>
            <Dialog.Content
              asChild
              forceMount
              aria-describedby={undefined}
              onOpenAutoFocus={e => { e.preventDefault(); input.current?.focus(); }}
              onEscapeKeyDown={e => { if (e.isComposing || composing.current) e.preventDefault(); }}
            >
              <motion.div
                className="material-thick fixed inset-x-0 top-[12vh] z-[61] mx-auto flex w-[min(660px,calc(100vw-48px))] flex-col overflow-hidden rounded-card shadow-pop outline-none"
                initial={{ opacity: 0, scale: 0.97, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: -4, transition: { duration: 0.12 } }}
                transition={spring}
              >
                <Dialog.Title className="sr-only">検索</Dialog.Title>
                <div className="hairline-b flex h-[60px] shrink-0 items-center gap-3 px-5">
                  <Search className="h-[21px] w-[21px] shrink-0 text-label2" strokeWidth={2.1} />
                  <input
                    ref={input}
                    value={q}
                    onChange={e => setQ(e.target.value)}
                    onKeyDown={onKeyDown}
                    onCompositionStart={() => { composing.current = true; }}
                    onCompositionEnd={() => { composing.current = false; }}
                    placeholder="患者・今日の予約・画面を検索"
                    role="combobox"
                    aria-expanded
                    aria-controls={`${hl}-list`}
                    aria-activedescendant={current ? `${hl}-${idx}` : undefined}
                    aria-autocomplete="list"
                    className="h-full min-w-0 flex-1 bg-transparent text-[20px] outline-none placeholder:text-label3"
                  />
                  {q && (
                    <button aria-label="消去" onClick={() => { setQ(""); input.current?.focus(); }} className="shrink-0 text-label3 transition-colors hover:text-label2">
                      <CircleX className="h-[18px] w-[18px]" strokeWidth={2} />
                    </button>
                  )}
                  <Kbd>esc</Kbd>
                </div>

                <motion.div ref={list} layoutScroll id={`${hl}-list`} role="listbox" aria-label="検索結果" className="h-[min(440px,56vh)] overflow-y-auto overscroll-contain px-2 pb-2">
                  {empty ? (
                    <div className="flex h-full flex-col items-center justify-center px-8 pb-6 text-center">
                      <div className="text-[15px] font-semibold">「{q.trim()}」に一致する項目はありません</div>
                      <p className="mt-1 text-[13px] text-label2">氏名・ふりがな・診察券番号・電話番号・画面の名前で探せます。</p>
                    </div>
                  ) : (
                    groups.map(g => (
                      <div key={g.title} role="group" aria-label={g.title}>
                        <div className="px-3 pb-1 pt-3 text-[12px] font-medium text-label2">{g.title}</div>
                        {g.items.map(it => {
                          n++;
                          const i = n;
                          const on = i === idx;
                          return (
                            <div
                              key={it.key}
                              id={`${hl}-${i}`}
                              data-idx={i}
                              role="option"
                              aria-selected={on}
                              onMouseMove={() => { if (i !== idx) setActive(i); }}
                              onClick={() => run(it)}
                              className="relative flex h-11 cursor-default select-none items-center gap-3 rounded-[10px] px-3"
                            >
                              {on && <motion.div layoutId={`${hl}-hl`} className="absolute inset-0 rounded-[10px] bg-sand/28" transition={{ type: "spring", stiffness: 700, damping: 46 }} />}
                              <ItemBody it={it} q={q} nowD={nowD} />
                            </div>
                          );
                        })}
                      </div>
                    ))
                  )}
                </motion.div>

                <div className="hairline-t flex h-10 shrink-0 items-center gap-4 px-4 text-[12px] text-label2">
                  <span className="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd>選ぶ</span>
                  <span className="flex items-center gap-1.5"><Kbd><CornerDownLeft className="h-3 w-3" strokeWidth={2.4} /></Kbd>{hint || "開く"}</span>
                  <span className="ml-auto flex items-center gap-1.5"><Kbd>esc</Kbd>閉じる</span>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

const Kbd = ({ children }: { children: ReactNode }) => (
  <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] bg-fill/12 px-1.5 font-sans text-[11px] font-medium text-label2">{children}</kbd>
);

/** 1行の中身（PC） */
function ItemBody({ it, q, nowD }: { it: Item; q: string; nowD: Date }) {
  const store = useStore();
  if (it.kind === "patient") {
    const p = it.p;
    const age = ageOf(p);
    const by = matchBy(p, q);
    return (
      <div className="relative flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={p.name} size={28} />
        <span className="shrink-0 text-[15px] font-medium"><Mark text={p.name} q={q} kind={by === "name" ? "name" : null} /></span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-label2 tnum">
          {by === "kana" ? <Mark text={p.kana} q={q} kind="kana" /> : by === "number" ? <>診察券 <Mark text={p.number} q={q} kind="digits" /></> : by === "phone" ? <Mark text={p.phone} q={q} kind="digits" /> : p.kana}
        </span>
        <span className="w-10 shrink-0 text-right text-[13px] text-label2 tnum">{age !== null ? `${age}歳` : ""}</span>
        <span className="w-[13.5rem] shrink-0 truncate text-[13px] text-label2 tnum">{visitLabel(store.appointments, p, minutesOfDay(nowD))}</span>
      </div>
    );
  }
  if (it.kind === "appt") {
    const a = it.a;
    const p = store.patients.find(x => x.id === a.patientId)!;
    const sv = serviceById(a.serviceId);
    const st = staffById(a.staffId);
    return (
      <div className="relative flex min-w-0 flex-1 items-center gap-3">
        <span className="w-11 shrink-0 text-[15px] font-semibold tnum">{hm(a.start)}</span>
        <span className="shrink-0 text-[15px] font-medium"><Mark text={p.name} q={q} kind={matchBy(p, q) === "name" ? "name" : null} /></span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-label2">{sv.name}・{st.short}・{unitById(a.unitId).short}</span>
        <StatusPill status={statusOf(a, nowD)} compact />
      </div>
    );
  }
  if (it.kind === "screen") {
    const Icon = it.screen.icon;
    return (
      <div className="relative flex min-w-0 flex-1 items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] bg-fill/12 text-label2">
          <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
        <span className="text-[15px] font-medium"><Mark text={it.screen.title} q={q} kind="name" /></span>
        <span className="ml-auto text-[12px] text-label3">画面</span>
      </div>
    );
  }
  return (
    <div className="relative flex min-w-0 flex-1 items-center gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] bg-sand/30 text-accent">
        {it.p ? <CalendarPlus className="h-4 w-4" strokeWidth={2.1} /> : <Plus className="h-4 w-4" strokeWidth={2.3} />}
      </span>
      <span className="truncate text-[15px] font-medium">{it.p ? `${it.p.name}さんの予約を取る` : "新規予約"}</span>
    </div>
  );
}

// ─── スマホ：全画面のシート ─────────────────────────────────────────────────
function PhoneSheet({ open, onClose, q, setQ, groups, run, nowD, empty }: {
  open: boolean; onClose: () => void; q: string; setQ: (v: string) => void; groups: Group[]; run: (it: Item) => void; nowD: Date; empty: boolean;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={o => { if (!o) onClose(); }} shouldScaleBackground>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/40" />
        <Drawer.Content aria-describedby={undefined} className="fixed inset-x-0 bottom-0 z-[61] flex h-[94dvh] flex-col rounded-t-sheet bg-elevated outline-none">
          <div className="mx-auto mt-[7px] h-[5px] w-9 shrink-0 rounded-full bg-label4" />
          <Drawer.Title className="sr-only">検索</Drawer.Title>
          <div className="flex shrink-0 items-center gap-3 px-4 pb-2 pt-3">
            <SearchField value={q} onChange={setQ} placeholder="患者・予約・画面を検索" className="flex-1" autoFocus />
            <button onClick={onClose} className="shrink-0 text-[17px] text-accent transition-opacity active:opacity-40">キャンセル</button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(env(safe-area-inset-bottom)+24px)]" data-vaul-no-drag="">
            {empty ? (
              <div className="px-8 pt-16 text-center">
                <div className="text-[17px] font-semibold">「{q.trim()}」に一致する項目はありません</div>
                <p className="mt-1.5 text-[14px] leading-[1.6] text-label2">氏名・ふりがな・診察券番号・電話番号・画面の名前で探せます。</p>
              </div>
            ) : (
              groups.map(g => (
                <section key={g.title}>
                  <h3 className="px-4 pb-1.5 pt-5 text-footnote font-medium text-label2">{g.title}</h3>
                  <div>
                    {g.items.map(it => (
                      <button key={it.key} onClick={() => run(it)} className="group relative flex min-h-[48px] w-full items-center gap-3 px-4 py-2 text-left transition-colors active:bg-fill/12">
                        <PhoneItem it={it} q={q} nowD={nowD} />
                        <span aria-hidden className="pointer-events-none absolute bottom-0 right-0 h-px origin-bottom scale-y-50 bg-sep/30 group-last:hidden" style={{ left: it.kind === "appt" ? 76 : 60 }} />
                      </button>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function PhoneItem({ it, q, nowD }: { it: Item; q: string; nowD: Date }) {
  const store = useStore();
  if (it.kind === "patient") {
    const p = it.p;
    const age = ageOf(p);
    const by = matchBy(p, q);
    return (
      <>
        <Avatar name={p.name} size={32} />
        <div className="min-w-0 flex-1 py-0.5">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="truncate text-[17px] leading-[22px]"><Mark text={p.name} q={q} kind={by === "name" ? "name" : null} /></span>
            {age !== null && <span className="shrink-0 text-[13px] text-label2 tnum">{age}歳</span>}
          </div>
          <div className="truncate text-[13px] leading-[18px] text-label2 tnum">
            {by === "kana" ? <Mark text={p.kana} q={q} kind="kana" /> : by === "number" ? <>診察券 <Mark text={p.number} q={q} kind="digits" /></> : by === "phone" ? <Mark text={p.phone} q={q} kind="digits" /> : p.kana}
            <span className="text-label4">・</span>
            {visitLabel(store.appointments, p, minutesOfDay(nowD), true)}
          </div>
        </div>
      </>
    );
  }
  if (it.kind === "appt") {
    const a = it.a;
    const p = store.patients.find(x => x.id === a.patientId)!;
    return (
      <>
        <span className="w-12 shrink-0 text-[15px] font-semibold tnum">{hm(a.start)}</span>
        <div className="min-w-0 flex-1 py-0.5">
          <div className="truncate text-[17px] leading-[22px]"><Mark text={p.name} q={q} kind={matchBy(p, q) === "name" ? "name" : null} /></div>
          <div className="truncate text-[13px] leading-[18px] text-label2">{serviceById(a.serviceId).name}・{staffById(a.staffId).short}</div>
        </div>
        <StatusPill status={statusOf(a, nowD)} compact />
      </>
    );
  }
  if (it.kind === "screen") {
    const Icon = it.screen.icon;
    return (
      <>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-fill/12 text-label2">
          <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
        </span>
        <span className="flex-1 text-[17px]"><Mark text={it.screen.title} q={q} kind="name" /></span>
      </>
    );
  }
  return (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-sand/30 text-accent">
        {it.p ? <CalendarPlus className="h-[18px] w-[18px]" strokeWidth={2.1} /> : <Plus className="h-[18px] w-[18px]" strokeWidth={2.3} />}
      </span>
      <span className="min-w-0 flex-1 truncate text-[17px] text-accent">{it.p ? `${it.p.name}さんの予約を取る` : "新規予約"}</span>
    </>
  );
}

// ─── 補助 ────────────────────────────────────────────────────────────────────
/** どの項目で当たったか（強調する場所を決める） */
function matchBy(p: Patient, q: string): "name" | "kana" | "number" | "phone" | null {
  const s = q.trim();
  if (!s) return null;
  if (p.name.replace(/\s/g, "").includes(s.replace(/\s/g, ""))) return "name";
  if (p.kana.replace(/\s/g, "").includes(toKatakana(s).replace(/\s/g, ""))) return "kana";
  const d = s.replace(/\D/g, "");
  if (d.length >= 2 && p.number.includes(d)) return "number";
  if (d.length >= 2 && p.phone.replace(/\D/g, "").includes(d)) return "phone";
  return null;
}

/** 当たった文字を強調（空白・ハイフンを無視して探す） */
function Mark({ text, q, kind }: { text: string; q: string; kind: "name" | "kana" | "digits" | null }) {
  const s = q.trim();
  if (!kind || !s) return <>{text}</>;
  const needle = kind === "digits" ? s.replace(/\D/g, "") : kind === "kana" ? toKatakana(s).replace(/\s/g, "") : norm(s);
  if (!needle) return <>{text}</>;
  const keep = (c: string) => (kind === "digits" ? /\d/.test(c) : !/[\s・]/.test(c));
  const map: number[] = [];
  let flat = "";
  for (let i = 0; i < text.length; i++) {
    if (!keep(text[i])) continue;
    map.push(i);
    flat += kind === "name" ? norm(text[i]) : text[i];
  }
  const at = flat.indexOf(needle);
  if (at < 0) return <>{text}</>;
  const from = map[at];
  const to = map[at + needle.length - 1] + 1;
  return (
    <>
      {text.slice(0, from)}
      <span className="font-semibold text-accent">{text.slice(from, to)}</span>
      {text.slice(to)}
    </>
  );
}
