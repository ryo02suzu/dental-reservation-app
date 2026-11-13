import { useEffect, useState, type ReactNode } from "react";
import { Check, UserPlus, UserRoundPen } from "lucide-react";
import { useStore } from "@/lib/store";
import { TODAY } from "@/lib/clock";
import { age, toKatakana } from "@/lib/format";
import type { InsuranceType, Patient } from "@/data";
import { Button, FieldRow, ListRow, ListSection, Sheet, Switch, useToast } from "@/ui";
import { Chip } from "../../sheets/parts";
import { INSURANCES, NewPatientFields, checkDraft, emptyDraft, parseBirth, type PatientDraft } from "./NewPatientFields";

const ymdSlash = (d: Date) => `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
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
  const [name, setName] = useState(p.name);
  const [kana, setKana] = useState(p.kana);
  const [birth, setBirth] = useState(ymdSlash(p.birth));
  const [sex, setSex] = useState<Patient["sex"]>(p.sex);
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
    setName(p.name);
    setKana(p.kana);
    setBirth(ymdSlash(p.birth));
    setSex(p.sex);
    setPhone(p.phone);
    setEmail(p.email ?? "");
    setLine(p.line);
    setInsurance(p.insurance);
    setAllergies(p.allergies);
    setConditions(p.conditions);
    setMemo(p.memo ?? "");
    setError(null);
  }, [open, p]);

  const born = parseBirth(birth);
  const save = () => {
    const nm = name.replace(/　/g, " ").replace(/\s+/g, " ").trim();
    const kn = toKatakana(kana).replace(/　/g, " ").replace(/\s+/g, " ").trim();
    if (!nm) return setError("氏名を入力してください");
    if (!kn || !/^[ァ-ヺー ・]+$/.test(kn)) return setError("ふりがなは、ひらがなかカタカナで入力してください");
    if (!born) return setError("生年月日は「1985/4/12」か「S60.4.12」の形で入力してください");
    const ph = half(phone).trim();
    if (!PHONE.test(ph)) return setError("電話番号は数字とハイフンで入力してください（例：090-1234-5678）");
    const em = email.trim();
    if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return setError("メールアドレスの形式を確認してください（例：name@example.jp）");
    updatePatient(p.id, { name: nm, kana: kn, birth: born, sex, phone: ph, email: em || undefined, line, insurance, allergies, conditions, memo: memo.trim() || undefined });
    toast("患者情報を更新しました", { icon: UserRoundPen, detail: `${nm}さん` });
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) onClose(); }} title="患者情報を編集" cancelLabel="キャンセル" confirmLabel="保存" onConfirm={save} size="lg">
      <Form>
        <ListSection header="氏名・ふりがな">
          <FieldRow label="氏名" value={name} onChange={v => { setName(v); setError(null); }} />
          <FieldRow label="ふりがな" value={kana} onChange={v => { setKana(v); setError(null); }} />
        </ListSection>
        <ListSection header="生年月日・性別">
          <label className="group relative flex min-h-[48px] items-center gap-3 px-4">
            <span className="w-[6.5em] shrink-0 text-[16px] md:text-[15px]">生年月日</span>
            <input
              value={birth}
              inputMode="numeric"
              onChange={e => { setBirth(e.target.value); setError(null); }}
              placeholder="1985/4/12・S60.4.12"
              className="min-w-0 flex-1 bg-transparent py-3 text-[16px] tnum outline-none placeholder:text-label3 md:text-[15px]"
            />
            {born && <span className="shrink-0 text-[13px] font-medium text-label2 tnum">{age(born, TODAY)}歳</span>}
            <span aria-hidden className="pointer-events-none absolute bottom-0 left-4 right-0 h-px origin-bottom scale-y-50 bg-sep/30" />
          </label>
          <div className="flex min-h-[52px] items-center gap-3 px-4 py-2">
            <span className="w-[6.5em] shrink-0 text-[16px] md:text-[15px]">性別</span>
            <div className="flex gap-2">
              {(["女性", "男性"] as const).map(x => (
                <Chip key={x} selected={sex === x} onClick={() => setSex(x)} className="min-w-[4.5rem]">{x}</Chip>
              ))}
            </div>
          </div>
        </ListSection>
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
export function AddPatientSheet({ open, onClose, onAdded, onPickExisting }: {
  open: boolean; onClose: () => void; onAdded: (p: Patient) => void; onPickExisting?: (id: string) => void;
}) {
  const { addPatient, patients } = useStore();
  const toast = useToast();
  const [draft, setDraft] = useState<PatientDraft>(emptyDraft);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(emptyDraft());
    setTried(false);
  }, [open]);

  const check = checkDraft(draft, patients);
  const save = () => {
    setTried(true);
    if (!check.value) return;
    const p = addPatient(check.value);
    toast("患者を登録しました", { icon: UserPlus, detail: `${p.name}さん・診察券 ${p.number}` });
    onAdded(p);
  };

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) onClose(); }} title="新しい患者を登録" cancelLabel="キャンセル" confirmLabel="登録" onConfirm={save} confirmDisabled={!draft.name.trim() || !draft.kana.trim()}>
      <Form>
        <ListSection footer="診察券番号は登録すると自動で付きます。保険は生年月日からの目安です。保険証で確認してください。">
          <NewPatientFields draft={draft} onChange={x => { setDraft(d => ({ ...d, ...x })); setTried(false); }} check={check} />
        </ListSection>
        {check.dup && (
          <div className="mt-3 flex items-center gap-3 rounded-card bg-sand/20 px-4 py-3">
            <p className="min-w-0 flex-1 text-footnote leading-[1.6] text-label">
              {check.dup.why}：<span className="font-semibold">{check.dup.p.name}</span>（診察券 {check.dup.p.number}）
            </p>
            {onPickExisting && <Button size="sm" variant="tinted" onClick={() => onPickExisting(check.dup!.p.id)}>この患者を開く</Button>}
          </div>
        )}
        <Error text={tried ? check.error : null} />
      </Form>
    </Sheet>
  );
}
