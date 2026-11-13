import { useState } from "react";
import { useIsPhone } from "@/lib/media";
import { Segmented, cn } from "@/ui";
import { LOWER, LOWER_P, UPPER, UPPER_P, toothName, type Dentition, type ToothKey } from "./util";

/**
 * 小さな歯式。押した歯を選ぶ／外す。永久歯（1〜8）と乳歯（A〜E）を切り替えられる。
 * PC・iPad：上下2段の歯式（右上8→1｜左上1→8）。
 * スマホ：1列16本では押しにくいので、上の歯／下の歯を切り替え、右と左を2段に分けて大きく出す。
 */
export function ToothGrid({ value, onToggle, dentition, onDentition }: {
  value: ToothKey[];
  onToggle: (k: ToothKey) => void;
  dentition: Dentition;
  onDentition: (d: Dentition) => void;
}) {
  const phone = useIsPhone();
  const [jaw, setJaw] = useState<"upper" | "lower">("upper");
  const on = new Set(value);
  const primary = dentition === "primary";
  const upper = primary ? UPPER_P : UPPER;
  const lower = primary ? LOWER_P : LOWER;
  const n = upper.length / 2;
  const count = (keys: ToothKey[]) => keys.filter(k => on.has(k)).length;

  const cell = (k: ToothKey, big?: boolean) => {
    const sel = on.has(k);
    return (
      <button
        key={k}
        type="button"
        aria-pressed={sel}
        aria-label={toothName(k)}
        title={toothName(k)}
        onClick={() => onToggle(k)}
        className={cn(
          "flex min-w-0 flex-1 items-center justify-center rounded-[8px] tnum transition-colors duration-100",
          big ? "h-11 text-[16px]" : "h-8 rounded-[6px] text-[13px]",
          sel ? "bg-accent font-semibold text-surface" : "text-label2 hover:bg-fill/12 active:bg-fill/16",
        )}
      >
        {k.slice(2)}
      </button>
    );
  };

  const controls = (
    <div className="mb-2 flex items-center gap-2">
      {phone && (
        <Segmented
          value={jaw}
          onChange={setJaw}
          className="flex-1"
          full
          options={[
            { value: "upper", label: <>上の歯{count([...upper]) ? <span className="tnum opacity-55">{count([...upper])}</span> : null}</> },
            { value: "lower", label: <>下の歯{count([...lower]) ? <span className="tnum opacity-55">{count([...lower])}</span> : null}</> },
          ]}
        />
      )}
      <Segmented
        size={phone ? "md" : "sm"}
        value={dentition}
        onChange={onDentition}
        className={phone ? "w-[132px] shrink-0" : "ml-auto w-[160px]"}
        full
        options={[{ value: "permanent", label: "永久歯" }, { value: "primary", label: "乳歯" }]}
      />
    </div>
  );

  if (phone) {
    const keys = jaw === "upper" ? upper : lower;
    // 右：中央（1・A）から奥へ、左：中央から奥へ。どちらも同じ向きに並べて、番号で迷わないようにする
    const right = keys.slice(0, n).reverse();
    const left = keys.slice(n);
    const side = (label: string, ks: ToothKey[]) => (
      <div className="flex items-center gap-2">
        <span className="w-8 shrink-0 text-[12px] font-medium text-label2">{label}</span>
        <div className="flex min-w-0 flex-1 gap-1">{ks.map(k => cell(k, true))}</div>
      </div>
    );
    return (
      <div>
        {controls}
        <div className="space-y-1">
          {side(jaw === "upper" ? "右上" : "右下", right)}
          <div className="ml-10 h-px bg-sep/30" aria-hidden />
          {side(jaw === "upper" ? "左上" : "左下", left)}
        </div>
      </div>
    );
  }

  const half = (keys: ToothKey[]) => <div className="flex min-w-0 flex-1 gap-px">{keys.map(k => cell(k))}</div>;
  return (
    <div>
      {controls}
      <div className="flex items-center gap-1.5">
        <span className="w-3 shrink-0 text-center text-[11px] text-label3" aria-hidden>右</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-stretch">
            {half(upper.slice(0, n))}
            <span className="mx-0.5 w-px shrink-0 bg-sep/40" aria-hidden />
            {half(upper.slice(n))}
          </div>
          <div className="my-0.5 h-px bg-sep/40" aria-hidden />
          <div className="flex items-stretch">
            {half(lower.slice(0, n))}
            <span className="mx-0.5 w-px shrink-0 bg-sep/40" aria-hidden />
            {half(lower.slice(n))}
          </div>
        </div>
        <span className="w-3 shrink-0 text-center text-[11px] text-label3" aria-hidden>左</span>
      </div>
    </div>
  );
}
