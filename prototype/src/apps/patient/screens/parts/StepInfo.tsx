import { useState, type ReactNode } from "react";
import { useIsPhone } from "@/lib/media";
import { useRoute } from "@/lib/nav";
import { Button, ListSection } from "@/ui";
import { BookingPage } from "./BookingPage";
import {
  FIELD_ORDER, NOTE_MAX, asksProfile, cleanSpaces, digitsOf, emailRequired, formatPhone, isMe, toHalf, toHiragana, useBooking, validate,
  type Draft, type FieldKey, type Sex,
} from "./booking";
import { BirthInput, Choice, Field, TextArea, TextInput, fieldId } from "./form";
import { useNotify } from "./session";
import { ActionBar } from "./shell";
import { KVRow } from "./ui";

function EditLink({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="-mb-0.5 rounded-md px-1 text-[15px] text-accent transition-opacity hover:opacity-70 md:text-[14px]">
      {on ? "完了" : "変更"}
    </button>
  );
}

function Group({ title, optional, children }: { title: string; optional?: boolean; children: ReactNode }) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="mb-4 flex items-baseline gap-2 px-1 text-title3 palt">
        {title}
        {optional && <span className="text-[13px] font-normal text-label3">任意</span>}
      </h2>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

/** 4. お名前とご連絡先（離れたときと「確認へ進む」で入力をチェック） */
export function StepInfo({ d }: { d: Draft }) {
  const { go } = useRoute();
  const { setDraft } = useBooking();
  const phone = useIsPhone();
  const notify = useNotify();
  const first = d.visit === "first";
  const me = isMe(d);
  const profile = asksProfile(d);
  const [editContact, setEditContact] = useState(false);
  const [touched, setTouched] = useState<Set<FieldKey>>(() => new Set());
  const [tried, setTried] = useState(false);
  const errors = validate(d);
  const err = (k: FieldKey) => (tried || touched.has(k) ? errors[k] : undefined);
  const touch = (k: FieldKey, patch?: Partial<Draft>) => {
    if (patch) setDraft(patch);
    setTouched(s => (s.has(k) ? s : new Set(s).add(k)));
  };
  const shown = FIELD_ORDER.filter(k => errors[k]);
  // 赤い枠は、いちばん上の誤りの欄だけ（ほかの欄は赤い一文だけにして、画面が赤で埋まらないように）
  const firstErr = FIELD_ORDER.find(k => err(k));
  const bad = (k: FieldKey) => firstErr === k;
  // 本人の予約で連絡先に不備があるときは、入力欄を開いて見せる
  const contactOpen = editContact || (me && tried && (!!errors.phone || !!errors.email));

  const submit = () => {
    if (shown.length === 0) {
      go("book", "confirm");
      return;
    }
    setTried(true);
    if (me) setEditContact(true);
    const el = document.getElementById(fieldId(shown[0]));
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    window.setTimeout(() => el?.focus({ preventScroll: true }), 350);
  };

  const contact = (
    <>
      <Field k="phone" label="電話番号" error={err("phone")} hint="当日のご連絡に使います。つながりやすい番号をご入力ください。">
        <TextInput k="phone" type="tel" inputMode="tel" autoComplete="tel" value={d.phone} placeholder="090-1234-5678" invalid={bad("phone")} onChange={v => setDraft({ phone: v })} onBlur={() => touch("phone", { phone: formatPhone(d.phone) })} />
      </Field>
      <Field
        k="email"
        label="メールアドレス"
        optional={!emailRequired(d)}
        error={err("email")}
        hint={first ? "仮予約が確定したら、メールでお知らせします。" : notify.line ? "予約の確認はLINEでもお送りします。" : "予約の確認をメールでお送りします。"}
      >
        <TextInput k="email" type="email" inputMode="email" autoComplete="email" value={d.email} placeholder="hanako@example.jp" invalid={bad("email")} onChange={v => setDraft({ email: v })} onBlur={() => touch("email", { email: toHalf(d.email).trim() })} />
      </Field>
    </>
  );

  return (
    <BookingPage
      step="info"
      d={d}
      title={me ? "ご連絡先とご要望" : undefined}
      subtitle={
        first
          ? "当日の受付がスムーズになるよう、マイナ保険証と同じお名前・生年月日でご入力ください。"
          : me
            ? "ご登録の内容で予約します。連絡先を変えるときは「変更」を押してください。"
            : "ご家族の診察券の登録と同じお名前・生年月日でご入力ください。"
      }
      footer={
        <ActionBar error={tried && shown.length > 0 ? `入力内容をご確認ください（${shown.length}か所）` : undefined}>
          <Button size="lg" full={phone} className={phone ? undefined : "min-w-[200px]"} onClick={submit}>
            確認へ進む
          </Button>
        </ActionBar>
      }
    >
      {me ? (
        <>
          <ListSection header="受診される方" className="!mt-0">
            <KVRow label="お名前">{d.name}</KVRow>
            <KVRow label="診察券番号">
              <span className="tnum">{digitsOf(d.number)}</span>
            </KVRow>
          </ListSection>
          {contactOpen ? (
            <section className="mt-7">
              <div className="flex items-end justify-between gap-3 px-4 pb-1.5">
                <h3 className="text-footnote font-medium text-label2">ご連絡先</h3>
                <EditLink on onClick={() => setEditContact(false)} />
              </div>
              <div className="space-y-5">{contact}</div>
            </section>
          ) : (
            <ListSection header="ご連絡先" aside={<EditLink on={false} onClick={() => setEditContact(true)} />}>
              <KVRow label="電話番号">
                <span className="tnum">{formatPhone(d.phone)}</span>
              </KVRow>
              <KVRow label="メール">{d.email || <span className="text-label3">未登録</span>}</KVRow>
            </ListSection>
          )}
        </>
      ) : (
        <>
          <Group title="受診される方">
            <Field k="name" label="お名前" error={err("name")}>
              <TextInput k="name" value={d.name} autoComplete="name" placeholder="山田 花子" invalid={bad("name")} onChange={v => setDraft({ name: v })} onBlur={() => touch("name", { name: cleanSpaces(d.name) })} />
            </Field>
            <Field k="kana" label="ふりがな" error={err("kana")}>
              <TextInput k="kana" value={d.kana} placeholder="やまだ はなこ" invalid={bad("kana")} onChange={v => setDraft({ kana: v })} onBlur={() => touch("kana", { kana: cleanSpaces(toHiragana(d.kana)) })} />
            </Field>
            {profile && (
              <>
                <Field k="birth" label="生年月日" error={err("birth")}>
                  <BirthInput k="birth" value={d.birth} invalid={bad("birth")} onChange={v => setDraft({ birth: v })} onBlur={() => d.birth && touch("birth")} />
                </Field>
                <Field k="sex" label="性別" error={err("sex")}>
                  <Choice<Sex> k="sex" value={d.sex} options={["女性", "男性"]} invalid={bad("sex")} onChange={v => touch("sex", { sex: v })} />
                </Field>
              </>
            )}
            {!first && (
              <Field k="number" label="診察券番号" optional error={err("number")} hint="診察券の表面にある6桁の番号です。わからなければ空欄で構いません（医院で確認します）。">
                <TextInput k="number" value={d.number} inputMode="numeric" placeholder="001234" maxLength={8} invalid={bad("number")} onChange={v => setDraft({ number: v })} onBlur={() => touch("number", { number: digitsOf(d.number) })} />
              </Field>
            )}
          </Group>

          <Group title="ご連絡先">{contact}</Group>
        </>
      )}

      <Group title="ご要望・症状" optional>
        <Field k="note" label="ご要望・症状" hideLabel error={err("note")} hint={first ? "いつから・どこが・どのように、がわかると診察がスムーズです。" : "担当者のご希望なども、こちらにお書きください。"}>
          <TextArea
            k="note"
            value={d.note}
            max={NOTE_MAX}
            invalid={bad("note")}
            placeholder={first ? "例：右下の奥歯が、冷たいものでしみる" : "例：左上の詰め物が取れかけている"}
            onChange={v => setDraft({ note: v })}
            onBlur={() => touch("note")}
          />
        </Field>
      </Group>
    </BookingPage>
  );
}
