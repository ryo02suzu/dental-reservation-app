import { useEffect, useLayoutEffect, useRef } from "react";
import { Copy } from "lucide-react";
import { clinic, serviceById, staffById } from "@/data";
import { fromKey, hm, mdw } from "@/lib/format";
import { useIsPhone, useIsWide } from "@/lib/media";
import { useRoute } from "@/lib/nav";
import { useStore } from "@/lib/store";
import { Button, StatusPill, useToast } from "@/ui";
import { BookingPage, BringList } from "./BookingPage";
import {
  REMIND_LABEL, assignUnit, commitBooking, pastDeadline, range, receiptOf, roleOf, toHalf, useBooking, willBePending, type Draft,
} from "./booking";
import { DoneMark } from "./ui";
import { useNotify } from "./session";

/**
 * 6. 完了。入ったときに一度だけ予約を登録する（初診は患者を登録して仮予約）。
 * この画面を離れたら（画面が消えたら）入力途中の内容を空にする。ブラウザの「戻る」で手順の画面に
 * 戻ってきたときは、Booking が確定済みの下書きを見つけてホームへ送る（二重予約を防ぐ）。
 */
export function StepDone({ d }: { d: Draft }) {
  const { go } = useRoute();
  const { setDraft, reset } = useBooking();
  const store = useStore();
  const phone = useIsPhone();
  const wide = useIsWide();
  const notify = useNotify();
  const toast = useToast();

  const committed = useRef(false);
  useLayoutEffect(() => {
    if (d.apptId || committed.current) return;
    committed.current = true;
    const r = commitBooking(d, store);
    setDraft({ apptId: r.appt.id, receipt: r.receipt });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const resetRef = useRef(reset);
  resetRef.current = reset;
  useEffect(() => () => resetRef.current(), []);

  const first = d.visit === "first";
  const sv = serviceById(d.serviceId!);
  const day = fromKey(d.date!);
  const appt = d.apptId ? store.appointments.find(a => a.id === d.apptId) : undefined;
  const pending = appt ? appt.status === "pending" : willBePending(d, store.patients);
  const closed = pastDeadline(d.date!);
  const staffId = appt?.staffId ?? assignUnit(d.date!, d.start!, d.start! + sv.minutes, sv, store.appointments).staffId;
  const staff = staffById(staffId);
  const receipt = d.receipt ?? (appt ? receiptOf(appt) : "");
  const email = toHalf(d.email).trim();

  return (
    <BookingPage
      step="done"
      d={d}
      title={pending ? "仮予約を受け付けました" : "ご予約を承りました"}
      subtitle={
        pending ? (
          first ? "医院で内容を確認したあと、メールで確定をお知らせします。" : "診察券番号を医院で確認したあと、確定をお知らせします。"
        ) : (
          <span className="tnum">{`${mdw(day)} ${hm(d.start!)}に、お待ちしております。`}</span>
        )
      }
      eyebrow={<DoneMark size={56} className="mb-4" />}
    >
      <section className="overflow-hidden rounded-card bg-surface">
        <div className="flex items-center justify-between gap-3 px-4 py-3.5 md:px-5">
          <span className="text-footnote font-medium text-label2">予約番号</span>
          <span className="text-[17px] font-semibold tnum">{receipt}</span>
        </div>
        <div className="hairline-t px-4 pb-4 pt-3.5 md:px-5">
          <div className="text-title2 tnum palt">{mdw(day)}</div>
          <div className="mt-0.5 text-[20px] font-semibold leading-[26px] tnum">{range(d.start!, sv.minutes)}</div>
          <div className="mt-3 text-[16px] leading-[22px]">{sv.name}</div>
          <div className="mt-0.5 text-footnote text-label2">
            {pending ? `担当 ${roleOf(sv)}` : `担当 ${staff.name}（${staff.role}）`}・{clinic.name}
          </div>
          {pending && (
            <div className="mt-3 flex items-center gap-2">
              <StatusPill status="pending" />
              <span className="text-footnote text-label2">医院の確認待ち</span>
            </div>
          )}
        </div>
      </section>

      <p className="mt-4 px-1 text-footnote leading-[1.65] text-label2">
        {pending
          ? email
            ? `確定のお知らせは ${email} にお送りします。`
            : notify.line
              ? "確定のお知らせはLINEでお送りします。"
              : "確定のお知らせはお電話でご連絡します。"
          : closed
            ? `${notify.line ? "LINEにも予約内容をお送りしました。" : ""}このご予約の変更・キャンセルは、お電話（${clinic.phone}）でお願いします。`
            : notify.line
              ? `LINEにも予約内容をお送りしました。${notify.remind ? `${REMIND_LABEL}にリマインドが届きます。` : ""}`
              : notify.remind
                ? `${REMIND_LABEL}に、SMSでリマインドをお送りします。`
                : "変更・キャンセルは、前日18時までにお願いします。"}
      </p>

      {!wide && <BringList first={first} className="!mt-8" />}

      <div className={phone ? "mt-8 grid gap-3 pb-2" : "mt-10 flex items-center gap-3"}>
        {first ? (
          <>
            {/* 初診（ほかの方の仮予約）は、ログイン中の方の「予約の確認」へは送らない */}
            <Button size="lg" full={phone} className={phone ? undefined : "min-w-[200px]"} onClick={() => go("home")}>
              ホームへ
            </Button>
            <Button
              size="lg"
              variant="gray"
              icon={Copy}
              full={phone}
              className={phone ? undefined : "min-w-[200px]"}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(receipt);
                  toast("予約番号をコピーしました", { detail: receipt });
                } catch {
                  toast("コピーできませんでした", { detail: `予約番号 ${receipt}` });
                }
              }}
            >
              予約番号をコピー
            </Button>
          </>
        ) : (
          <>
            <Button size="lg" full={phone} className={phone ? undefined : "min-w-[200px]"} onClick={() => go("mine")}>
              予約の確認へ
            </Button>
            <Button size="lg" variant="gray" full={phone} className={phone ? undefined : "min-w-[160px]"} onClick={() => go("home")}>
              ホームへ
            </Button>
          </>
        )}
      </div>
    </BookingPage>
  );
}
