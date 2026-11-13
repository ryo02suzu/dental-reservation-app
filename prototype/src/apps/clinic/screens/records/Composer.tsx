import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { TODAY, TODAY_KEY } from "@/lib/clock";
import { age, hm, matchesPatient } from "@/lib/format";
import { useIsPhone } from "@/lib/media";
import { serviceById, staff, staffById, type Memo } from "@/data";
import { Avatar, Menu, MenuItem, STATUS, SearchField, cn, springSoft } from "@/ui";
import { ToothGrid } from "./ToothGrid";
import { PHRASES, appendPhrase, sortTeeth, toothName, type Dentition, type PermanentKey, type ToothKey } from "./util";

export type ComposerState = ReturnType<typeof useComposer>;

/** 書きかけのメモ。PCの右ペインとスマホのシートで同じものを使う */
export function useComposer() {
  // 書く人は、ログインしている本人から始める（受付の人なら、患者を選んだときに担当者へ切り替える）
  const { currentStaffId } = useStore();
  const [patientId, setPatientId] = useState<string | undefined>();
  const [apptId, setApptId] = useState<string | undefined>();
  const [staffId, setStaffId] = useState(currentStaffId);
  const [dentition, setDentition] = useState<Dentition>("permanent");
  const [teeth, setTeeth] = useState<ToothKey[]>([]);
  const [body, setBody] = useState("");
  const [next, setNext] = useState("");
  const ready = !!patientId && !!body.trim();
  const toggleTooth = (k: ToothKey) => setTeeth(t => (t.includes(k) ? t.filter(x => x !== k) : [...t, k]));
  const reset = () => {
    setPatientId(undefined);
    setApptId(undefined);
    setTeeth([]);
    setDentition("permanent");
    setBody("");
    setNext("");
  };
  const toMemo = (): Omit<Memo, "id" | "date" | "at"> => ({
    patientId: patientId!,
    apptId,
    staffId,
    body: body.trim(),
    // 乳歯（A〜E）は共有の型にないが、表示は toothName で読めるのでそのまま渡す
    teeth: teeth.length ? (sortTeeth(teeth) as PermanentKey[]) : undefined,
    next: next.trim() || undefined,
  });
  return { patientId, setPatientId, apptId, setApptId, staffId, setStaffId, dentition, setDentition, teeth, toggleTooth, body, setBody, next, setNext, ready, reset, toMemo };
}

function Label({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex min-h-[20px] items-end justify-between gap-3 px-1 pb-1.5">
      <span className="text-footnote font-medium text-label2">{children}</span>
      {aside}
    </div>
  );
}

/** メモの入力欄（患者・書く人・歯・本文・次回） */
export function ComposerFields({ c }: { c: ComposerState }) {
  const phone = useIsPhone();
  return (
    <div className="space-y-5">
      <PatientPicker c={c} />
      <div>
        <Label>書く人</Label>
        <AuthorPicker c={c} />
      </div>
      <div>
        <Label aside={c.teeth.length > 0 ? <span className="truncate text-footnote text-label2">{sortTeeth(c.teeth).map(toothName).join("・")}</span> : undefined}>歯</Label>
        <div className="rounded-cell bg-fill/8 px-2 py-2">
          <ToothGrid value={c.teeth} onToggle={c.toggleTooth} dentition={c.dentition} onDentition={c.setDentition} />
        </div>
      </div>
      <div>
        <Label>内容</Label>
        <textarea
          value={c.body}
          onChange={e => c.setBody(e.target.value)}
          rows={phone ? 4 : 5}
          placeholder="処置の内容、患者さんの様子、次の人への申し送り"
          aria-label="内容"
          className="block w-full resize-none rounded-cell bg-fill/8 px-3.5 py-3 text-[16px] leading-[1.65] text-label outline-none placeholder:text-label3 focus:shadow-[inset_0_0_0_1.5px_rgb(var(--accent)/0.45)] md:text-[14px]"
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PHRASES.map(ph => (
            <motion.button
              key={ph}
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => c.setBody(appendPhrase(c.body, ph))}
              className="h-8 rounded-full bg-fill/12 px-3 text-[13px] font-medium text-label transition-colors hover:bg-fill/16 md:h-7 md:text-[12px]"
            >
              {ph}
            </motion.button>
          ))}
        </div>
      </div>
      <div>
        <Label>次回</Label>
        <input
          value={c.next}
          onChange={e => c.setNext(e.target.value)}
          placeholder="例：左下5番 CR・30分"
          aria-label="次回"
          className="h-11 w-full rounded-cell bg-fill/8 px-3.5 text-[16px] text-label outline-none placeholder:text-label3 focus:shadow-[inset_0_0_0_1.5px_rgb(var(--accent)/0.45)] md:h-10 md:text-[14px]"
        />
      </div>
    </div>
  );
}

function PatientPicker({ c }: { c: ComposerState }) {
  const { appointments, patients } = useStore();
  const [q, setQ] = useState("");
  // 今日の患者：診療中を先に、そのあと終わった順（新しいものから）
  const todays = useMemo(() => {
    const seen = new Set<string>();
    return appointments
      .filter(a => a.date === TODAY_KEY && (a.status === "in_progress" || a.status === "completed"))
      .sort((a, b) => (a.status === b.status ? b.start - a.start : a.status === "in_progress" ? -1 : 1))
      .filter(a => (seen.has(a.patientId) ? false : (seen.add(a.patientId), true)));
  }, [appointments]);
  const results = q.trim() ? patients.filter(p => matchesPatient(p, q)).slice(0, 5) : [];
  const chosen = c.patientId ? patients.find(p => p.id === c.patientId) : undefined;
  const chosenAppt = c.apptId ? appointments.find(a => a.id === c.apptId) : undefined;
  const pick = (patientId: string, apptId?: string) => {
    c.setPatientId(patientId);
    c.setApptId(apptId);
    setQ("");
    // 受付・歯科助手がメモを開いたときは、その予約の担当（歯科医師・歯科衛生士）を書く人にする
    const appt = apptId ? appointments.find(a => a.id === apptId) : undefined;
    const role = staffById(c.staffId).role;
    if (appt && (role === "受付" || role === "歯科助手")) c.setStaffId(appt.staffId);
    // 6歳未満は乳歯の歯式から始める
    const p = patients.find(x => x.id === patientId);
    c.setDentition(p && age(p.birth, TODAY) < 6 ? "primary" : "permanent");
  };

  return (
    <div>
      <Label aside={!chosen && todays.some(a => a.status === "in_progress") ? (
        <span className="flex items-center gap-1.5 text-footnote text-label3"><span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />診療中</span>
      ) : undefined}>患者</Label>
      <AnimatePresence mode="wait" initial={false}>
        {chosen ? (
          <motion.div key="chosen" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={springSoft} className="flex items-center gap-3 rounded-cell bg-fill/8 py-2 pl-3 pr-1.5">
            <Avatar name={chosen.name} size={34} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[16px] font-semibold leading-[21px] md:text-[15px] md:leading-5">{chosen.name}</div>
              <div className="truncate text-[12px] text-label2 tnum">
                {chosenAppt ? `今日 ${hm(chosenAppt.start)}・${serviceById(chosenAppt.serviceId).short}・${STATUS[chosenAppt.status].label}` : `${chosen.kana}・診察券 ${chosen.number}`}
              </div>
            </div>
            <button type="button" onClick={() => { c.setPatientId(undefined); c.setApptId(undefined); }} aria-label="患者を選び直す" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-label3 transition-colors hover:bg-fill/12">
              <X className="h-[17px] w-[17px]" strokeWidth={2.2} />
            </button>
          </motion.div>
        ) : (
          <motion.div key="pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
            {todays.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {todays.slice(0, 8).map(a => {
                  const p = patients.find(x => x.id === a.patientId)!;
                  return (
                    <motion.button
                      key={a.id}
                      type="button"
                      whileTap={{ scale: 0.95 }}
                      onClick={() => pick(p.id, a.id)}
                      title={`${hm(a.start)} ${serviceById(a.serviceId).name}`}
                      className="flex h-9 items-center gap-1.5 rounded-full bg-fill/12 pl-1 pr-3 text-[14px] text-label transition-colors hover:bg-fill/16 md:h-8 md:text-[13px]"
                    >
                      <Avatar name={p.name} size={26} className="md:!h-6 md:!w-6" />
                      <span className="whitespace-nowrap">{p.name}</span>
                      {a.status === "in_progress" && <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-label="診療中" />}
                    </motion.button>
                  );
                })}
              </div>
            )}
            <SearchField value={q} onChange={setQ} placeholder="ほかの患者を検索" />
            {results.length > 0 && (
              <div className="mt-2 overflow-hidden rounded-cell bg-fill/8">
                {results.map(p => (
                  <button key={p.id} type="button" onClick={() => pick(p.id)} className="group relative flex min-h-[44px] w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-fill/8 active:bg-fill/12">
                    <Avatar name={p.name} size={28} />
                    <span className="min-w-0 flex-1 truncate text-[15px] md:text-[14px]">{p.name}</span>
                    <span className="shrink-0 text-[12px] text-label3 tnum">{p.number}</span>
                    <span aria-hidden className="pointer-events-none absolute bottom-0 left-[50px] right-0 h-px origin-bottom scale-y-50 bg-sep/30 group-last:hidden" />
                  </button>
                ))}
              </div>
            )}
            {q.trim() && results.length === 0 && (
              <p className="px-1 pt-2 text-footnote text-label2">「{q.trim()}」に一致する患者さんはいません</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AuthorPicker({ c }: { c: ComposerState }) {
  const s = staffById(c.staffId);
  return (
    <Menu
      align="start"
      trigger={
        <button type="button" className="flex h-11 w-full items-center gap-2.5 rounded-cell bg-fill/8 pl-2.5 pr-3 text-left transition-colors hover:bg-fill/12 md:h-10">
          <Avatar name={s.name} tone={s.tone} size={26} />
          <span className="truncate text-[16px] md:text-[14px]">{s.name}</span>
          <span className="shrink-0 text-[13px] text-label2 md:text-[12px]">{s.role}</span>
          <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-label3" strokeWidth={2.4} />
        </button>
      }
    >
      {staff.map(x => (
        <MenuItem key={x.id} icon={x.id === c.staffId ? Check : undefined} onSelect={() => c.setStaffId(x.id)}>
          <span className={cn(x.id === c.staffId && "font-semibold")}>{x.name}</span>
          <span className="ml-2 text-[13px] text-label2">{x.role}</span>
        </MenuItem>
      ))}
    </Menu>
  );
}
