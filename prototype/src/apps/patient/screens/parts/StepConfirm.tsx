import { clinic, serviceById } from "@/data";
import { TODAY } from "@/lib/clock";
import { duration, fromKey, hm, mdw, relDay } from "@/lib/format";
import { useIsPhone } from "@/lib/media";
import { useRoute } from "@/lib/nav";
import { Button, ListSection } from "@/ui";
import { BookingPage } from "./BookingPage";
import { birthLabel, digitsOf, formatPhone, priceLong, range, roleOf, type Draft } from "./booking";
import { useNotify } from "./session";
import { ActionBar } from "./shell";
import { KVRow } from "./ui";

function EditLink({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="-mb-0.5 rounded-md px-1 text-[15px] text-accent transition-opacity hover:opacity-70 md:text-[14px]">
      変更
    </button>
  );
}

/** 5. 確認（まだ確定していないことをはっきり伝える） */
export function StepConfirm({ d }: { d: Draft }) {
  const { go } = useRoute();
  const phone = useIsPhone();
  const notify = useNotify();
  const sv = serviceById(d.serviceId!);
  const day = fromKey(d.date!);
  const first = d.visit === "first";
  const number = digitsOf(d.number);
  const rel = relDay(day, TODAY);
  const near = rel === "今日" || rel === "明日" || rel === "明後日" ? rel : undefined;

  return (
    <BookingPage
      step="confirm"
      d={d}
      subtitle="まだ予約は確定していません。内容をご確認のうえ、下のボタンを押してください。"
      footer={
        <ActionBar note={`${mdw(day)} ${hm(d.start!)}・${sv.name}`}>
          <Button size="lg" full={phone} className={phone ? undefined : "min-w-[220px]"} onClick={() => go("book", "done")}>
            予約を確定する
          </Button>
        </ActionBar>
      }
    >
      {/* 日時とメニュー（いちばん大事なところを大きく） */}
      <section className="rounded-card bg-surface">
        <div className="flex items-start justify-between gap-3 px-4 pb-4 pt-4">
          <div className="min-w-0">
            <div className="text-footnote font-medium text-label2">日時</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-title2 tnum palt">{mdw(day)}</span>
              {near && <span className="text-subhead text-label2">{near}</span>}
            </div>
            <div className="mt-0.5 text-[20px] font-semibold leading-[26px] tnum">{range(d.start!, sv.minutes)}</div>
          </div>
          <EditLink onClick={() => go("book", "time")} />
        </div>
        <div className="hairline-t flex items-start justify-between gap-3 px-4 py-3.5">
          <div className="min-w-0">
            <div className="text-[16px] leading-[22px]">{sv.name}</div>
            <div className="mt-0.5 text-footnote text-label2 tnum">
              {duration(sv.minutes)}・{priceLong(sv)}・担当 {roleOf(sv)}
            </div>
          </div>
          <EditLink onClick={() => go("book", "menu")} />
        </div>
      </section>

      <ListSection header="受診される方" aside={<EditLink onClick={() => go("book", "info")} />} className="!mt-8">
        <KVRow label="お名前">{d.name}</KVRow>
        <KVRow label="ふりがな">{d.kana}</KVRow>
        {first && d.birth && <KVRow label="生年月日">{birthLabel(d.birth)}</KVRow>}
        {first && d.sex && <KVRow label="性別">{d.sex}</KVRow>}
        {!first && <KVRow label="診察券番号">{number ? <span className="tnum">{number}</span> : <span className="text-label3">未入力</span>}</KVRow>}
        <KVRow label="初診・再診">{first ? "はじめて（初診）" : "通院中（再診）"}</KVRow>
      </ListSection>

      <ListSection header="ご連絡先" aside={<EditLink onClick={() => go("book", "info")} />}>
        <KVRow label="電話番号">
          <span className="tnum">{formatPhone(d.phone)}</span>
        </KVRow>
        {d.email ? <KVRow label="メール">{d.email}</KVRow> : null}
        {!first && notify.line && <KVRow label="お知らせ">LINE（連携済み）</KVRow>}
      </ListSection>

      {d.note.trim() && (
        <ListSection header="ご要望・症状" aside={<EditLink onClick={() => go("book", "info")} />}>
          <p className="whitespace-pre-wrap break-words px-4 py-3 text-[16px] leading-[1.65] text-label md:text-[15px]">{d.note.trim()}</p>
        </ListSection>
      )}

      <section className="mt-8 rounded-cell bg-surface px-4 py-4">
        <h3 className="text-[15px] font-semibold">変更・キャンセルについて</h3>
        <p className="mt-1.5 text-footnote leading-[1.65] text-label2">
          変更・キャンセルは前日18時までにお願いします。それ以降は、お電話（<span className="tnum">{clinic.phone}</span>）でご連絡ください。
        </p>
        {first && (
          <>
            <h3 className="mt-4 text-[15px] font-semibold">初診のご予約について</h3>
            <p className="mt-1.5 text-footnote leading-[1.65] text-label2">
              医院で内容を確認したあとに確定し、メールでお知らせします。確定までは「仮予約」として表示されます。
            </p>
          </>
        )}
      </section>
    </BookingPage>
  );
}
