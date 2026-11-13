import type { ReactNode } from "react";
import { clinic, serviceById } from "@/data";
import { duration, fromKey, hm, mdw } from "@/lib/format";
import { useRoute } from "@/lib/nav";
import { ListSection, ListRow, cn } from "@/ui";
import { STEPS, STEP_SHORT, STEP_TITLE, priceLong, range, stepNo, type Draft, type Step } from "./booking";
import { PatientPage } from "./shell";
import { ClinicMark, CopyButton } from "./ui";

/** 予約の各手順の画面。戻る（前の手順）、進み具合（1 / 5）、広い画面では右に「ご予約内容」 */
export function BookingPage({ step, d, title, subtitle, eyebrow, footer, children }: {
  step: Step; d: Draft; title?: string; subtitle?: ReactNode; eyebrow?: ReactNode; footer?: ReactNode; children: ReactNode;
}) {
  const { go } = useRoute();
  const n = stepNo(step);
  const prev = step !== "done" && n > 0 ? STEPS[n - 1] : null;
  const back = step === "done" ? undefined : prev ? { label: STEP_SHORT[prev], onClick: () => go("book", prev) } : { label: "ホーム", onClick: () => go("home") };
  return (
    <PatientPage
      title={title ?? STEP_TITLE[step]}
      subtitle={subtitle}
      eyebrow={eyebrow}
      back={back}
      actions={
        step !== "done" ? (
          <span className="pr-2 text-[15px] text-label2 tnum md:pr-0" aria-label={`全${STEPS.length}ステップ中の${n + 1}番目`}>
            {n + 1} / {STEPS.length}
          </span>
        ) : undefined
      }
      side={<BookingSide step={step} d={d} />}
      footer={footer}
    >
      {children}
    </PatientPage>
  );
}

// ─── 広い画面の右の列 ───────────────────────────────────────────────────────
function SummaryRow({ label, value, sub, onEdit, empty = "未選択" }: { label: string; value?: string; sub?: string; onEdit?: () => void; empty?: string }) {
  return (
    <div className="group relative flex items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-footnote text-label2">{label}</div>
        <div className={cn("mt-0.5 text-[15px] leading-5 tnum", value ? "text-label" : "text-label3")}>{value ?? empty}</div>
        {sub && <div className="mt-0.5 text-footnote text-label2 tnum">{sub}</div>}
      </div>
      {onEdit && (
        <button onClick={onEdit} className="-mr-1 shrink-0 rounded-md px-1 py-0.5 text-[15px] text-accent transition-opacity hover:opacity-70">
          変更
        </button>
      )}
      <span aria-hidden className="pointer-events-none absolute bottom-0 left-4 right-0 h-px origin-bottom scale-y-50 bg-sep/30 group-last:hidden" />
    </div>
  );
}

function BookingSide({ step, d }: { step: Step; d: Draft }) {
  const { go } = useRoute();
  const n = stepNo(step);
  const sv = d.serviceId ? serviceById(d.serviceId) : undefined;
  const edit = (s: Step) => (step !== "done" && stepNo(s) < n ? () => go("book", s) : undefined);
  const when = d.date && d.start !== undefined && sv ? { value: `${mdw(fromKey(d.date))} ${hm(d.start)}`, sub: range(d.start, sv.minutes) } : undefined;
  return (
    <div>
      {step === "done" ? (
        <BringList first={d.visit === "first"} />
      ) : (
        <>
          <h2 className="mb-2.5 px-1 text-[17px] font-semibold">ご予約内容</h2>
          <div className="overflow-hidden rounded-cell bg-surface">
            <SummaryRow label="初診・再診" value={d.visit ? (d.visit === "first" ? "はじめての方（初診）" : "通院中の方（再診）") : undefined} onEdit={edit("type")} />
            <SummaryRow label="メニュー" value={sv?.name} sub={sv ? `${duration(sv.minutes)}・${priceLong(sv)}` : undefined} onEdit={edit("menu")} />
            <SummaryRow label="日時" value={when?.value} sub={when?.sub} onEdit={edit("time")} />
            <SummaryRow label="受診される方" value={n >= 4 && d.name ? `${d.name} さん` : undefined} onEdit={edit("info")} empty="未入力" />
          </div>
        </>
      )}
      <ClinicHelp />
    </div>
  );
}

/** 医院の連絡先（右の列の下） */
export function ClinicHelp({ className }: { className?: string }) {
  return (
    <div className={cn("mt-8", className)}>
      <div className="flex items-center gap-2.5 px-1">
        <ClinicMark size={28} />
        <div className="min-w-0 text-[15px] font-semibold">{clinic.name}</div>
      </div>
      <p className="mt-2 px-1 text-footnote leading-[1.6] text-label2">{clinic.access}</p>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-cell bg-surface px-4 py-3">
        <div className="min-w-0">
          <div className="text-footnote text-label2">お電話でのご相談</div>
          <div className="mt-0.5 text-[17px] tnum">{clinic.phone}</div>
        </div>
        <CopyButton text={clinic.phone} what="電話番号" />
      </div>
      <p className="mt-3 px-1 text-footnote leading-[1.6] text-label2">変更・キャンセルは、前日18時までにお願いします。</p>
    </div>
  );
}

/** ご来院のときにお持ちいただくもの */
export function BringList({ first, className }: { first: boolean; className?: string }) {
  const items = first
    ? ["マイナ保険証または保険証", "お薬手帳（服用中のお薬がある方）", "紹介状（お持ちの方）"]
    : ["診察券", "マイナ保険証または保険証", "お薬手帳（服用中のお薬がある方）"];
  return (
    <ListSection
      header="ご来院のときにお持ちください"
      footer={first ? "問診票をご記入いただくため、予約の10分前にお越しください。" : "保険証は月に一度確認しています。予約の5分前までにお越しください。"}
      className={cn("!mt-0", className)}
    >
      {items.map(t => (
        <ListRow key={t} title={<span className="whitespace-normal">{t}</span>} className="!py-2.5" />
      ))}
    </ListSection>
  );
}
