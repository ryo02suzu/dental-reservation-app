import { useEffect, useState, type ReactNode } from "react";
import { Check, UserPlus, UserRoundPen } from "lucide-react";
import { parse, isValid } from "date-fns";
import { useStore } from "@/lib/store";
import { TODAY } from "@/lib/clock";
import { age, toKatakana } from "@/lib/format";
import type { InsuranceType, Patient } from "@/data";
import { FieldRow, ListRow, ListSection, Segmented, Sheet, Switch, useToast } from "@/ui";

const INSURANCES: InsuranceType[] = ["社保本人", "社保家族", "国保", "後期高齢者", "子ども医療証"];
const ALLERGY_OPTIONS = ["ペニシリン系", "ラテックス", "局所麻酔（リドカイン）", "金属（ニッケル）", "アスピリン"];
const CONDITION_OPTIONS = ["抗凝固薬（ワーファリン）服用中", "骨粗しょう症（BP製剤服用中）", "心疾患（ペースメーカー）", "妊娠中", "高血圧", "糖尿病", "喘息"];

const has = (list: string[], opt: string) => list.some(c => c === opt || c.startsWith(opt));
const toggle = (list: string[], opt: string, on: boolean) => (on ? (has(list, opt) ? list : [...list, opt]) : list.filter(c => !(c === opt || c.startsWith(opt))));
/** 全角の数字・ハイフンを半角に */
const half = (s: string) => s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[－ー―‐]/g, "-");
const PHONE = /^0\d{1,4}-?\d{1,4}-?\d{3,4}$/;

/** シートの中を、iOSのフォームと同じ灰色の地にする（白いまとまりが見えるように） */
function Form({ children }: { children: ReactNode }) {
  return <div className="-mx-4 min-h-full bg-bg px-4 pb-4 pt-1 md:-mx-5 md:px-5">{children}</div>;
}

function Error({ text }: { text: string | null }) {
  if (!text) return null;
  return <p role="alert" className="mt-3 px-4 text-footnote font-medium text-red">{text}</p>;
}

// ─── 患者情報を編集 ───────────────────────────────────────────────────────
export function EditPatientSheet({ p, open, onClose }: { p: Patient; open: boolean; onClose: () => void }) {
  const { updatePatient } = useStore();
  const toast = useToast();
  const [phone, setPhone] = useState(p.phone);
  const [email, setEmail] = useState(p.email ?? "");
  const [line, setLine] = useState(p.line);
  const [insurance, setInsurance] = useState<InsuranceType>(p.insurance);
  const [allergies, setAllergies] = useState(p.allergies);
  const [conditions, setConditions] = useState(p.conditions);
  const [memo, setMemo] = useState(p.memo ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPhone(p.phone);
    setEmail(p.email ?? "");
    setLine(p.line);
    setInsurance(p.insurance);
    setAllergies(p.allergies);
    setConditions(p.conditions);
    setMemo(p.memo ?? "");
    setError(null);
  }, [open, p]);

  const save = () => {
    const ph = half(phone).trim();
    if (!PHONE.test(ph)) return setError("電話番号は数字とハイフンで入力してください（例：090-1234-5678）");
    const em = email.trim();
    if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return setError("メールアドレスの形式を確認してください（例：name@example.jp）");
    updatePatient(p.id, { phone: ph, email: em || undefined, line, insurance, allergies, conditions, memo: memo.trim() || undefined });
    toast("患者情報を更新しました", { icon: UserRoundPen, detail: `${p.name}さん` });
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) onClose(); }} title="患者情報を編集" cancelLabel="キャンセル" confirmLabel="保存" onConfirm={save} size="lg">
      <Form>
        <ListSection header="連絡先">
          <FieldRow label="電話番号" value={phone} onChange={v => { setPhone(v); setError(null); }} type="tel" inputMode="tel" />
          <FieldRow label="メール" value={email} onChange={v => { setEmail(v); setError(null); }} type="email" inputMode="email" placeholder="登録なし" />
          <ListRow title="LINE連携" trailing={<Switch checked={line} onChange={setLine} label="LINE連携" />} />
        </ListSection>
        <Error text={error} />
        <ListSection header="保険">
          {INSURANCES.map(x => (
            <ListRow key={x} title={x} onClick={() => setInsurance(x)} trailing={insurance === x ? <Check className="h-[18px] w-[18px] text-accent" strokeWidth={2.6} /> : undefined} />
          ))}
        </ListSection>
        <ListSection header="アレルギー" footer="オンにした項目は、患者詳細のいちばん上に赤で表示されます。">
          {ALLERGY_OPTIONS.map(x => (
            <ListRow key={x} title={x} trailing={<Switch checked={has(allergies, x)} onChange={v => setAllergies(a => toggle(a, x, v))} label={x} />} />
          ))}
        </ListSection>
        <ListSection header="既往歴・服薬">
          {CONDITION_OPTIONS.map(x => (
            <ListRow key={x} title={x} trailing={<Switch checked={has(conditions, x)} onChange={v => setConditions(c => toggle(c, x, v))} label={x} />} />
          ))}
        </ListSection>
        <ListSection header="申し送り" footer="対応の希望や配慮してほしいことを、短く書いておきます。">
          <FieldRow label="内容" value={memo} onChange={setMemo} placeholder="例：嘔吐反射が強め" />
        </ListSection>
      </Form>
    </Sheet>
  );
}

// ─── 新しい患者を登録 ─────────────────────────────────────────────────────
export function AddPatientSheet({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (p: Patient) => void }) {
  const { addPatient } = useStore();
  const toast = useToast();
  const [name, setName] = useState("");
  const [kana, setKana] = useState("");
  const [birth, setBirth] = useState("");
  const [sex, setSex] = useState<Patient["sex"]>("女性");
  const [phone, setPhone] = useState("");
  const [insurance, setInsurance] = useState<InsuranceType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(""); setKana(""); setBirth(""); setSex("女性"); setPhone(""); setInsurance(null); setError(null);
  }, [open]);

  const birthDate = birth ? parse(birth, "yyyy-MM-dd", new Date()) : null;
  const years = birthDate && isValid(birthDate) ? age(birthDate, TODAY) : null;
  const suggested: InsuranceType = years !== null && years < 15 ? "子ども医療証" : years !== null && years >= 75 ? "後期高齢者" : "社保本人";
  const ins = insurance ?? suggested;

  const save = () => {
    const nm = name.replace(/　/g, " ").replace(/\s+/g, " ").trim();
    const kn = toKatakana(kana).replace(/　/g, " ").replace(/\s+/g, " ").trim();
    const ph = half(phone).trim();
    if (!nm) return setError("氏名を入力してください");
    if (!kn || !/^[ァ-ヶー ]+$/.test(kn)) return setError("ふりがなは、ひらがなかカタカナで入力してください");
    if (!birthDate || !isValid(birthDate) || birthDate > TODAY) return setError("生年月日を入力してください");
    if (!PHONE.test(ph)) return setError("電話番号は数字とハイフンで入力してください（例：090-1234-5678）");
    const p = addPatient({
      name: nm, kana: kn, sex, birth: birthDate, phone: ph, insurance: ins, firstVisit: TODAY, visits: 0, recallMonths: 3,
      cancellations: 0, noShows: 0, line: false, allergies: [], conditions: [], teeth: {},
    });
    toast("患者を登録しました", { icon: UserPlus, detail: `${p.name}さん・診察券番号 ${p.number}` });
    onAdded(p);
  };

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) onClose(); }} title="新しい患者" cancelLabel="キャンセル" confirmLabel="登録" onConfirm={save} confirmDisabled={!name.trim() || !kana.trim()}>
      <Form>
        <ListSection header="氏名">
          <FieldRow label="氏名" value={name} onChange={v => { setName(v); setError(null); }} placeholder="山田 花子" />
          <FieldRow label="ふりがな" value={kana} onChange={v => { setKana(v); setError(null); }} placeholder="やまだ はなこ" />
        </ListSection>
        <ListSection header="生年月日・性別">
          <FieldRow label="生年月日" value={birth} onChange={v => { setBirth(v); setError(null); }} type="date" />
          <div className="flex min-h-[48px] items-center gap-3 px-4">
            <span className="w-[6.5em] shrink-0 text-[16px] md:text-[15px]">性別</span>
            <Segmented value={sex} onChange={setSex} options={[{ value: "女性", label: "女性" }, { value: "男性", label: "男性" }]} size="sm" />
          </div>
        </ListSection>
        <ListSection header="連絡先" footer="診察券番号は登録すると自動で付きます。">
          <FieldRow label="電話番号" value={phone} onChange={v => { setPhone(v); setError(null); }} type="tel" inputMode="tel" placeholder="090-1234-5678" />
        </ListSection>
        <Error text={error} />
        <ListSection header="保険" footer={insurance ? undefined : "生年月日から目安を選んでいます。保険証で確認してください。"}>
          {INSURANCES.map(x => (
            <ListRow key={x} title={x} onClick={() => setInsurance(x)} trailing={ins === x ? <Check className="h-[18px] w-[18px] text-accent" strokeWidth={2.6} /> : undefined} />
          ))}
        </ListSection>
      </Form>
    </Sheet>
  );
}
