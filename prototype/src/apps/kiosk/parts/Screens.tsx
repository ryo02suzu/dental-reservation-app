// 受付端末の各ステップの画面
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronRight, CreditCard, IdCard, Phone, QrCode, SearchX, BellRing, UserRound } from "lucide-react";
import { patientById, serviceById, staffById, type Appointment, type Patient } from "@/data";
import { minutesOfDay, now } from "@/lib/clock";
import { hm } from "@/lib/format";
import { useStore } from "@/lib/store";
import { IconTile, cn, springBouncy, tapSoft, Ring } from "@/ui";
import type { TileTone } from "@/data";
import type { LucideIcon } from "lucide-react";
import { DigitBoxes, KButton, KeyPad, KTitle } from "./ui";
import { demoNumber, nextForQr } from "./lookup";

/* ─── 受付の方法 ───────────────────────────────────────────── */
const METHODS: { k: "scan" | "number" | "phone"; title: string; body: string; icon: LucideIcon; tone: TileTone }[] = [
  { k: "scan", title: "診察券のQRコードで受付", body: "診察券の裏のQRコードをかざします", icon: QrCode, tone: "sand" },
  { k: "number", title: "診察券番号で受付", body: "6けたの診察券番号を入力します", icon: CreditCard, tone: "slate" },
  { k: "phone", title: "お電話番号で受付", body: "お電話番号の下4けたを入力します", icon: Phone, tone: "sage" },
];

export function Method({ onPick }: { onPick: (k: "scan" | "number" | "phone") => void }) {
  return (
    <div className="flex flex-col">
      <KTitle title="受付の方法を選んでください" lead="診察券をお持ちでない方は、お電話番号で受付できます。" />
      <div className="mt-8 grid gap-3 md:mt-10 md:gap-4 lg:mt-12 lg:grid-cols-3">
        {METHODS.map((m, i) => (
          <motion.button
            key={m.k}
            type="button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 34, delay: 0.04 + i * 0.05 } }}
            whileTap={tapSoft}
            onClick={() => onPick(m.k)}
            className="flex min-h-[112px] items-center gap-5 rounded-[24px] bg-surface p-5 text-left md:min-h-[136px] md:gap-6 md:p-7 lg:h-[min(340px,42vh)] lg:min-h-[260px] lg:flex-col lg:items-start lg:justify-between lg:p-7"
          >
            <IconTile icon={m.icon} tone={m.tone} size={56} />
            <div className="min-w-0 flex-1 lg:flex-none">
              <div className="text-[21px] font-semibold leading-[1.35] palt md:text-[24px]">{m.title}</div>
              <div className="mt-1.5 text-[15px] leading-[1.6] text-label2 md:text-[17px] lg:text-[16px]">{m.body}</div>
            </div>
            <ChevronRight className="h-7 w-7 shrink-0 text-label3 lg:hidden" strokeWidth={2.2} />
          </motion.button>
        ))}
      </div>
    </div>
  );
}

/* ─── QRコードの読み取り（デモ：約2秒で読み取ったことにする） ───────── */
export function Scan({ onResult, onUseNumber }: { onResult: (a: Appointment | undefined) => void; onUseNumber: () => void }) {
  const { appointments } = useStore();
  const [read, setRead] = useState(false);
  const cb = useRef(onResult);
  cb.current = onResult;
  const apptsRef = useRef(appointments);
  apptsRef.current = appointments;
  useEffect(() => {
    const t1 = setTimeout(() => setRead(true), 1900);
    const t2 = setTimeout(() => cb.current(nextForQr(apptsRef.current, minutesOfDay(now()))), 2600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div className="flex flex-col gap-8 md:gap-10 lg:flex-row lg:items-center lg:gap-16">
      <div className="lg:flex-1">
        <KTitle
          title={read ? "読み取りました" : "QRコードを枠に合わせてください"}
          lead={<>診察券の裏のQRコードを、<br />カメラに向けてかざしてください。</>}
        />
        <div className="mt-8 hidden lg:block">
          <KButton variant="secondary" size="md" icon={CreditCard} onClick={onUseNumber}>診察券番号で受付する</KButton>
        </div>
      </div>
      <div className="relative mx-auto aspect-square w-full max-w-[340px] overflow-hidden rounded-[32px] bg-black md:max-w-[420px] lg:mx-0 lg:w-[420px] lg:shrink-0">
        {/* カメラ映像の代わりの、かざされた診察券の影 */}
        <div className="absolute inset-[22%] rounded-[14px] bg-white/[0.06]" />
        <QrCode className="absolute left-1/2 top-1/2 h-[30%] w-[30%] -translate-x-1/2 -translate-y-1/2 text-white/20" strokeWidth={1.3} />
        {/* 四隅の枠 */}
        {(["left-[14%] top-[14%] border-l-[3px] border-t-[3px] rounded-tl-[18px]", "right-[14%] top-[14%] border-r-[3px] border-t-[3px] rounded-tr-[18px]",
          "left-[14%] bottom-[14%] border-l-[3px] border-b-[3px] rounded-bl-[18px]", "right-[14%] bottom-[14%] border-r-[3px] border-b-[3px] rounded-br-[18px]"] as const).map(c => (
          <span key={c} className={cn("absolute h-[18%] w-[18%] transition-colors duration-300", c, read ? "border-sand" : "border-white/85")} />
        ))}
        {/* 走査線（この画面だけ・最大2秒） */}
        {!read && (
          <motion.span
            className="absolute left-[16%] right-[16%] h-[2px] rounded-full bg-sand"
            initial={{ top: "18%", opacity: 0 }}
            animate={{ top: ["18%", "82%", "50%"], opacity: [0, 1, 1] }}
            transition={{ duration: 1.8, ease: "easeInOut", times: [0, 0.7, 1] }}
          />
        )}
        {read && (
          <motion.span
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={springBouncy}
            className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-sand text-onsand"
          >
            <Check className="h-10 w-10" strokeWidth={3} />
          </motion.span>
        )}
      </div>
      <div className="lg:hidden">
        <KButton variant="secondary" size="md" icon={CreditCard} onClick={onUseNumber} className="w-full">診察券番号で受付する</KButton>
      </div>
    </div>
  );
}

/* ─── 番号の入力（診察券番号6けた／電話番号の下4けた） ─────────────── */
export function Entry({ mode, onSubmit, error, onClearError }: {
  mode: "number" | "phone";
  onSubmit: (v: string) => void;
  error?: { message: string; key: number };
  onClearError: () => void;
}) {
  const len = mode === "number" ? 6 : 4;
  const [v, setV] = useState("");
  const { appointments, patients } = useStore();
  const demo = useMemo(() => {
    if (mode === "number") return demoNumber(appointments, patients, minutesOfDay(now()));
    const n = demoNumber(appointments, patients, minutesOfDay(now()));
    const p = patients.find(x => x.number === n);
    return p?.phone.replace(/\D/g, "").slice(-4);
  }, [appointments, patients, mode]);

  const add = (d: string) => { onClearError(); setV(x => (x.length < len ? x + d : x)); };
  const del = () => { onClearError(); setV(x => x.slice(0, -1)); };
  const full = v.length === len;

  // パソコンで試すとき用に、キーボードの数字・Backspace・Enter も受け付ける
  const ref = useRef({ add, del, full, v });
  ref.current = { add, del, full, v };
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) ref.current.add(e.key);
      else if (e.key === "Backspace") ref.current.del();
      else if (e.key === "Enter" && ref.current.full) onSubmit(ref.current.v);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [onSubmit]);
  // 間違えたときは入力を消して、もう一度最初から
  useEffect(() => { if (error) setV(""); }, [error]);

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-16">
      <div className="flex flex-col lg:flex-1">
        <KTitle
          title={mode === "number" ? "診察券番号を入力してください" : <>お電話番号の下4けたを<br />入力してください</>}
          lead={mode === "number" ? "診察券の表に書かれている、6けたの番号です。" : "ご予約のときにお知らせいただいた番号です。"}
        />
        <div className={cn("mt-8 md:mt-10", mode === "phone" && "md:max-w-[340px]")}>
          <DigitBoxes value={v} length={len} shakeKey={error?.key ?? 0} error={!!error} />
          <div className="mt-3 min-h-[28px] text-[16px] leading-[1.6] md:text-[18px]" aria-live="assertive">
            {error ? (
              <span className="block font-medium text-red">{error.message.split("\n").map((l, i) => <span key={i} className="block">{l}</span>)}</span>
            ) : demo ? (
              <button type="button" onClick={() => { onClearError(); setV(demo); }} className="text-label3 underline-offset-4 hover:underline">
                デモ用の番号 <span className="tnum">{demo}</span> を入れる
              </button>
            ) : null}
          </div>
        </div>
        <KButton disabled={!full} onClick={() => onSubmit(v)} className="mt-6 hidden w-full lg:mt-8 lg:inline-flex lg:max-w-[420px]">
          次へ
        </KButton>
      </div>
      <div className="w-full lg:w-[380px] lg:shrink-0">
        <KeyPad onDigit={add} onDelete={del} canDelete={v.length > 0} />
        <KButton disabled={!full} onClick={() => onSubmit(v)} className="mt-6 w-full lg:hidden">次へ</KButton>
      </div>
    </div>
  );
}

/* ─── 候補が複数のとき（電話番号の下4けたが同じ方） ─────────────── */
export function Choose({ candidates, onPick }: { candidates: { patient: Patient; appt: Appointment }[]; onPick: (apptId: string) => void }) {
  return (
    <div className="flex flex-col">
      <KTitle title="お名前を選んでください" lead="同じ番号でご登録の方が、ほかにもいらっしゃいます。" />
      <div className="mt-8 grid max-w-[720px] gap-3 md:mt-10">
        {candidates.map(c => (
          <motion.button key={c.appt.id} type="button" whileTap={tapSoft} onClick={() => onPick(c.appt.id)}
            className="flex min-h-[96px] items-center gap-5 rounded-[22px] bg-surface px-6 text-left">
            <UserRound className="h-8 w-8 shrink-0 text-label3" strokeWidth={1.8} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[24px] font-semibold palt">{c.patient.name} さま</div>
              <div className="mt-0.5 text-[17px] text-label2 tnum">ご予約 {hm(c.appt.start)}</div>
            </div>
            <ChevronRight className="h-7 w-7 shrink-0 text-label3" strokeWidth={2.2} />
          </motion.button>
        ))}
      </div>
    </div>
  );
}

/* ─── 予約の確認 ─────────────────────────────────────────── */
export function Confirm({ appt, onConfirm, onWrong }: { appt: Appointment; onConfirm: () => void; onWrong: () => void }) {
  const p = patientById(appt.patientId);
  const s = serviceById(appt.serviceId);
  const st = staffById(appt.staffId);
  const late = minutesOfDay(now()) > appt.start + 5;
  const rows: [string, string][] = [
    ["ご予約の時刻", `${hm(appt.start)}〜${hm(appt.end)}`],
    ["内容", s.name],
    ["担当", `${st.name}（${st.role === "院長" ? "院長・歯科医師" : st.role}）`],
  ];
  return (
    <div className="flex flex-col gap-8 md:gap-10 lg:flex-row lg:items-center lg:gap-16">
      <div className="lg:flex-1">
        <div className="text-[17px] text-label2 md:text-[20px]">{p.kana}</div>
        <h1 className="mt-1 text-[38px] font-bold leading-[1.2] tracking-[-0.01em] palt md:text-[52px]">
          {p.name}<span className="ml-2 text-[0.6em] font-semibold">さま</span>
        </h1>
        <p className="mt-4 text-[17px] leading-[1.7] text-label2 md:text-[20px]">本日のご予約の内容をご確認ください。</p>
      </div>
      <div className="w-full lg:w-[480px] lg:shrink-0">
        <div className="rounded-[24px] bg-surface px-6 md:px-7">
          {rows.map(([k, val], i) => (
            <div key={k} className={cn("flex min-h-[76px] flex-col justify-center gap-0.5 py-4 md:flex-row md:items-center md:justify-between md:gap-6", i > 0 && "hairline-t")}>
              <span className="shrink-0 text-[15px] text-label2 md:text-[18px]">{k}</span>
              <span className={cn("min-w-0 font-semibold palt md:text-right", i === 0 ? "text-[26px] tnum md:text-[30px]" : "text-[19px] md:text-[21px]")}>{val}</span>
            </div>
          ))}
        </div>
        {late && (
          <p className="mt-4 px-1 text-[16px] leading-[1.7] text-label2 md:text-[17px]">
            ご予約の時刻を過ぎています。順番はスタッフからご案内します。
          </p>
        )}
        <KButton onClick={onConfirm} icon={Check} className="mt-6 w-full">受付する</KButton>
        <KButton variant="plain" size="md" onClick={onWrong} className="mt-2 w-full">ご本人ではない場合</KButton>
      </div>
    </div>
  );
}

/* ─── 受付済み ───────────────────────────────────────────── */
export function Already({ appt, onHome }: { appt: Appointment; onHome: () => void }) {
  const p = patientById(appt.patientId);
  const at = appt.arrivedAt ?? appt.startedAt;
  return (
    <ResultLayout
      icon={<span className="flex h-20 w-20 items-center justify-center rounded-full bg-fill/12 text-label2"><Check className="h-10 w-10" strokeWidth={2.6} /></span>}
      title="受付はお済みです"
      lead={<>
        {p.name} さまは{at !== undefined ? <span className="tnum"> {hm(at)} に</span> : ""}受付が済んでいます。
        <br />
        お名前をお呼びするまで、待合室でお待ちください。
      </>}
    >
      <KButton onClick={onHome} className="w-full md:w-[360px]">最初にもどる</KButton>
    </ResultLayout>
  );
}

/* ─── 完了 ───────────────────────────────────────────────── */
export function Done({ appt, receipt, insurance, onHome }: { appt: Appointment; receipt: number; insurance: boolean; onHome: () => void }) {
  const p = patientById(appt.patientId);
  const TOTAL = 10;
  const [left, setLeft] = useState(TOTAL);
  const home = useRef(onHome);
  home.current = onHome;
  useEffect(() => {
    const id = setInterval(() => setLeft(x => x - 1), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { if (left <= 0) home.current(); }, [left]);

  return (
    <div className="flex flex-col gap-8 md:gap-10 lg:flex-row lg:items-center lg:gap-16">
      <div className="lg:flex-1">
        <motion.span
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ...springBouncy, delay: 0.08 }}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-sand text-onsand md:h-20 md:w-20"
        >
          <Check className="h-8 w-8 md:h-10 md:w-10" strokeWidth={3} />
        </motion.span>
        <h1 className="mt-6 text-[34px] font-bold leading-[1.25] palt md:text-[44px]">受付が完了しました</h1>
        <p className="mt-3 text-[18px] leading-[1.7] text-label2 md:text-[22px]">
          <span className="font-semibold text-label">{p.name} さま</span>
          <br />
          お名前をお呼びするまで、
          <br />
          待合室でお待ちください。
        </p>
        {insurance && (
          <div className="mt-6 flex items-start gap-4 rounded-[20px] bg-surface p-5 md:p-6">
            <IdCard className="mt-0.5 h-8 w-8 shrink-0 text-accent" strokeWidth={1.8} />
            <div>
              <div className="text-[19px] font-semibold leading-[1.5] palt md:text-[21px]">保険証（マイナ保険証）を<br />受付にお出しください</div>
              <div className="mt-1.5 text-[15px] leading-[1.6] text-label2 md:text-[17px]">{appt.firstVisit ? "はじめてのご来院のため、" : "今月はじめてのご来院のため、"}<br className="md:hidden" />確認いたします。</div>
            </div>
          </div>
        )}
      </div>
      <div className="flex w-full flex-col gap-5 lg:w-[360px] lg:shrink-0 xl:w-[400px]">
        <div className="rounded-[28px] bg-surface px-7 pb-7 pt-6 md:px-8">
          <div className="text-[17px] font-medium text-label2 md:text-[19px]">受付番号</div>
          <div className="mt-1 text-[96px] font-bold leading-none tracking-[-0.03em] tnum md:text-[128px]">{receipt}</div>
          <div className="mt-3 text-[15px] text-label3 md:text-[16px]">お会計のときに、この番号でお呼びします</div>
        </div>
        <div className="flex items-center gap-4">
          <Ring value={Math.max(0, left) / TOTAL} size={56} stroke={4} barClassName="text-label3" trackClassName="text-fill/12">
            <span className="text-[18px] font-semibold tnum text-label2">{Math.max(0, left)}</span>
          </Ring>
          <KButton variant="secondary" size="md" onClick={onHome} className="flex-1">最初にもどる</KButton>
        </div>
      </div>
    </div>
  );
}

/* ─── 見つからなかったとき ───────────────────────────────────── */
export function NotFound({ name, onRetry, retryLabel, onHelp }: { name?: string; onRetry: () => void; retryLabel: string; onHelp: () => void }) {
  return (
    <ResultLayout
      icon={<span className="flex h-20 w-20 items-center justify-center rounded-full bg-fill/12 text-label2"><SearchX className="h-9 w-9" strokeWidth={2} /></span>}
      title="本日のご予約が見つかりませんでした"
      lead={name
        ? <>{name} さま、ご予約の日にちが違うか、<br className="hidden md:inline" />ご予約が変更されている可能性があります。<br />受付でお調べします。</>
        : <>ご予約の日にちが違う場合や、ご予約のない方は、<br className="hidden md:inline" />受付でご案内します。</>}
    >
      <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
        <KButton onClick={onHelp} icon={BellRing} className="md:min-w-[300px]">受付に知らせる</KButton>
        <KButton variant="secondary" onClick={onRetry} className="md:min-w-[260px]">{retryLabel}</KButton>
      </div>
    </ResultLayout>
  );
}

/* ─── 受付にお声がけください ─────────────────────────────────── */
export function Help({ onCall, called, onHome }: { onCall: () => void; called: boolean; onHome: () => void }) {
  return (
    <ResultLayout
      icon={
        <motion.span
          key={String(called)}
          initial={called ? { scale: 0.5, opacity: 0 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={springBouncy}
          className={cn("flex h-20 w-20 items-center justify-center rounded-full", called ? "bg-sand text-onsand" : "bg-fill/12 text-label2")}
        >
          {called ? <Check className="h-10 w-10" strokeWidth={3} /> : <BellRing className="h-9 w-9" strokeWidth={2} />}
        </motion.span>
      }
      title={called ? "スタッフに知らせました" : "受付にお声がけください"}
      lead={
        called
          ? "スタッフがまいります。そのまま少しお待ちください。"
          : <>ご予約のない方、はじめての方、診察券をお忘れの方は、<br className="hidden md:inline" />受付のスタッフがご案内します。<br />カウンターが混み合っているときは、下のボタンでお呼びください。</>
      }
    >
      {called ? (
        <KButton variant="secondary" onClick={onHome} className="w-full md:w-[360px]">最初にもどる</KButton>
      ) : (
        <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
          <KButton onClick={onCall} icon={BellRing} className="md:min-w-[300px]">スタッフを呼ぶ</KButton>
          <KButton variant="secondary" onClick={onHome} className="md:min-w-[260px]">最初にもどる</KButton>
        </div>
      )}
    </ResultLayout>
  );
}

function ResultLayout({ icon, title, lead, children }: { icon: React.ReactNode; title: string; lead: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      {icon}
      <h1 className="mt-6 text-[30px] font-bold leading-[1.3] palt md:text-[40px]">{title}</h1>
      <p className="mt-3 text-[17px] leading-[1.75] text-label2 md:text-[20px]">{lead}</p>
      <div className="mt-8 md:mt-10">{children}</div>
    </div>
  );
}
