// 新しい患者の入力欄。患者画面の「＋」と、新規予約の中の「新しい患者を登録」の両方で使う。
// 生年月日は自由入力（西暦・和暦）で必須、性別は最初は空で必須、保険は年齢から目安を出す。
import { ChevronsUpDown, Check } from "lucide-react";
import { TODAY } from "@/lib/clock";
import { age, toKatakana } from "@/lib/format";
import type { InsuranceType, Patient } from "@/data";
import { FieldRow, Menu, MenuItem } from "@/ui";
import { Chip } from "../../sheets/parts";

export const INSURANCES: InsuranceType[] = ["社保本人", "社保家族", "国保", "後期高齢者", "子ども医療証"];
const KANA = /^[ぁ-ゖァ-ヺー・\s　]+$/;

export interface PatientDraft {
  name: string;
  kana: string;
  tel: string;
  birth: string;
  sex: Patient["sex"] | null;
  /** null なら年齢からの目安 */
  insurance: InsuranceType | null;
}

/** 検索欄に入れていた文字を、氏名・ふりがな・電話番号のどれかに入れて始める */
export function emptyDraft(seed = ""): PatientDraft {
  const s = seed.trim();
  return {
    name: s && !KANA.test(s) && !/\d/.test(s) ? s : "",
    kana: s && KANA.test(s) ? s : "",
    tel: /^[\d\-\s]+$/.test(s) ? s : "",
    birth: "",
    sex: null,
    insurance: null,
  };
}

const suggestInsurance = (years: number | null): InsuranceType => (years !== null && years < 15 ? "子ども医療証" : years !== null && years >= 75 ? "後期高齢者" : "社保本人");
const normKana = (s: string) => toKatakana(s).replace(/[\s　・]/g, "");
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export interface DraftCheck {
  error: string | null;
  born: Date | null;
  insurance: InsuranceType;
  /** 同じ人かもしれない登録済みの患者 */
  dup?: { p: Patient; why: string };
  /** 登録できる形（error がないときだけ） */
  value?: Omit<Patient, "id" | "number">;
}

export function checkDraft(d: PatientDraft, patients: Patient[]): DraftCheck {
  const digits = d.tel.replace(/\D/g, "");
  const born = parseBirth(d.birth);
  const years = born ? age(born, TODAY) : null;
  const insurance = d.insurance ?? suggestInsurance(years);
  const error =
    !d.name.trim() ? "氏名を入力してください"
    : !d.kana.trim() ? "ふりがなを入力してください"
    : !KANA.test(d.kana.trim()) ? "ふりがなは、ひらがなかカタカナで入力してください"
    : !d.birth.trim() ? "生年月日を入力してください（例：1985/4/12、S60.4.12）"
    : !born ? "生年月日は「1985/4/12」か「S60.4.12」の形で入力してください"
    : !d.sex ? "性別を選んでください"
    : !digits ? "電話番号を入力してください"
    : /[^\d\-\s()－ー]/.test(d.tel) || digits.length < 10 || digits.length > 11 ? "電話番号は数字10〜11桁で入力してください"
    : null;
  const kq = normKana(d.kana);
  const byTel = digits.length >= 10 ? patients.find(p => p.phone.replace(/\D/g, "") === digits) : undefined;
  const byKana = !byTel && born && kq.length >= 2 ? patients.find(p => normKana(p.kana) === kq && sameDay(p.birth, born)) : undefined;
  const dup = byTel ? { p: byTel, why: "同じ電話番号の患者がいます" } : byKana ? { p: byKana, why: "同じふりがな・生年月日の患者がいます" } : undefined;
  const value: Omit<Patient, "id" | "number"> | undefined = error || !born || !d.sex ? undefined : {
    name: tidy(d.name), kana: tidy(toKatakana(d.kana)), sex: d.sex, birth: born, phone: formatTel(digits), insurance,
    firstVisit: TODAY, visits: 0, recallMonths: 3, cancellations: 0, noShows: 0, line: false, allergies: [], conditions: [], teeth: {},
  };
  return { error, born, insurance, dup, value };
}

/** 入力の行（入れ物は呼ぶ側で用意する：ListSection か Inset） */
export function NewPatientFields({ draft, onChange, check }: { draft: PatientDraft; onChange: (patch: Partial<PatientDraft>) => void; check: DraftCheck }) {
  const { born, insurance } = check;
  return (
    <>
      <FieldRow label="氏名" value={draft.name} onChange={v => onChange({ name: v })} placeholder="山田 花子" />
      <FieldRow label="ふりがな" value={draft.kana} onChange={v => onChange({ kana: v })} placeholder="やまだ はなこ" />
      <label className="group relative flex min-h-[48px] items-center gap-3 px-4">
        <span className="w-[6.5em] shrink-0 text-[16px] text-label md:text-[15px]">生年月日</span>
        <input
          value={draft.birth}
          inputMode="numeric"
          onChange={e => onChange({ birth: e.target.value })}
          placeholder="1985/4/12・S60.4.12"
          className="min-w-0 flex-1 bg-transparent py-3 text-[16px] tnum outline-none placeholder:text-label3 md:text-[15px]"
        />
        {born && <span className="shrink-0 text-[13px] font-medium text-label2 tnum">{age(born, TODAY)}歳</span>}
        <Sep />
      </label>
      <div className="group relative flex min-h-[52px] items-center gap-3 px-4 py-2">
        <span className="w-[6.5em] shrink-0 text-[16px] text-label md:text-[15px]">性別</span>
        <div className="flex gap-2">
          {(["女性", "男性"] as const).map(x => (
            <Chip key={x} selected={draft.sex === x} onClick={() => onChange({ sex: x })} className="min-w-[4.5rem]">{x}</Chip>
          ))}
        </div>
        <Sep />
      </div>
      <FieldRow label="電話番号" value={draft.tel} onChange={v => onChange({ tel: v })} placeholder="090-1234-5678" type="tel" inputMode="tel" />
      <div className="group relative flex min-h-[48px] items-center gap-3 px-4">
        <span className="w-[6.5em] shrink-0 text-[16px] text-label md:text-[15px]">保険</span>
        <Menu
          align="start"
          trigger={
            <button type="button" className="-ml-2 flex h-9 min-w-0 items-center gap-1 rounded-full px-2 text-[16px] text-label transition-colors hover:bg-fill/10 data-[state=open]:bg-fill/12 md:text-[15px]">
              <span className="truncate">{insurance}</span>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-label3" strokeWidth={2.4} />
            </button>
          }
        >
          {INSURANCES.map(x => (
            <MenuItem key={x} icon={x === insurance ? Check : undefined} onSelect={() => onChange({ insurance: x })}>{x}</MenuItem>
          ))}
        </Menu>
        {!draft.insurance && <span className="ml-auto shrink-0 text-[13px] text-label3">{born ? "年齢からの目安" : "目安"}</span>}
      </div>
    </>
  );
}

const Sep = () => <span aria-hidden className="pointer-events-none absolute bottom-0 left-4 right-0 h-px origin-bottom scale-y-50 bg-sep/30" />;

/** 和暦の元年の前の年（昭和・平成・令和） */
const ERAS: Record<string, number> = { S: 1925, 昭和: 1925, H: 1988, 平成: 1988, R: 2018, 令和: 2018 };

/** 生年月日の入力を読む。「1985/4/12」「1985-04-12」「19850412」「S60.4.12」「昭和60年4月12日」 */
export function parseBirth(input: string): Date | null {
  const s = input.trim().replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[／．－]/g, m => ({ "／": "/", "．": ".", "－": "-" })[m]!).toUpperCase();
  if (!s) return null;
  let y: number, m: number, d: number;
  const era = s.match(/^(S|H|R|昭和|平成|令和)\s*(\d{1,2}|元)[.\/\-年\s]\s*(\d{1,2})[.\/\-月\s]\s*(\d{1,2})日?$/);
  const west = s.match(/^(\d{4})[.\/\-年\s]\s*(\d{1,2})[.\/\-月\s]\s*(\d{1,2})日?$/);
  const packed = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (era) [y, m, d] = [ERAS[era[1]] + (era[2] === "元" ? 1 : +era[2]), +era[3], +era[4]];
  else if (west) [y, m, d] = [+west[1], +west[2], +west[3]];
  else if (packed) [y, m, d] = [+packed[1], +packed[2], +packed[3]];
  else return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getMonth() !== m - 1 || dt.getDate() !== d || dt > TODAY || y < 1900) return null;
  return dt;
}

const tidy = (s: string) => s.replace(/　/g, " ").replace(/\s+/g, " ").trim();
export function formatTel(d: string) {
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (/^0[36]/.test(d)) return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}
