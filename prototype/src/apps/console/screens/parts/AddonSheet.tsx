// オプション1件のシート：料金の変更と、導入している医院
import { useRef, useState } from "react";
import { TODAY } from "@/lib/clock";
import { yen } from "@/lib/format";
import { IconTile, Sheet, cn, useToast } from "@/ui";
import { addonMeta } from "./addonMeta";
import { addonStats, signedYen } from "./model";
import { setAddonPrice, useConsole } from "./store";
import { ClinicMark, PlanTag, RowRule, SheetGroup } from "./ui";

function validate(text: string, value: number): string | null {
  if (!text.trim()) return "金額を入力してください";
  if (!/^\d+$/.test(text)) return "金額は数字で入力してください";
  if (value < 100) return "100円以上で入力してください";
  if (value > 50000) return "50,000円以下で入力してください";
  if (value % 10 !== 0) return "金額は10円単位で入力してください";
  return null;
}

export function AddonSheet({ addonKey, onClose }: { addonKey: string | null; onClose: () => void }) {
  const s = useConsole();
  const toast = useToast();
  // 閉じるアニメーションの間も中身を出しておくため、最後に開いたオプションを覚えておく
  const last = useRef<string | null>(null);
  if (addonKey) last.current = addonKey;
  const a = last.current ? s.addons.find(x => x.key === last.current) : undefined;
  const [text, setText] = useState("");
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  if (addonKey && openedFor !== addonKey && a) {
    setOpenedFor(addonKey);
    setText(String(a.price));
  }
  if (!addonKey && openedFor) setOpenedFor(null);
  if (!a) return null;

  const clean = text.replace(/[,，\s¥￥円]/g, "").replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xfee0));
  const value = Number(clean);
  const error = validate(clean, value);
  const st = addonStats(s, a.key);
  const paying = st.users.filter(c => c.active).length;
  const next = !error ? value : a.price;
  const meta = addonMeta(a.key);
  const month = (TODAY.getMonth() + 1) % 12 + 1;

  const save = () => {
    if (error || value === a.price) return;
    setAddonPrice(a.key, value);
    toast("料金を変更しました", { detail: `${a.name} · ${yen(a.price)} → ${yen(value)}` });
    onClose();
  };

  return (
    <Sheet open={!!addonKey} onOpenChange={o => !o && onClose()} title={a.name} cancelLabel="キャンセル" confirmLabel="保存" onConfirm={save} confirmDisabled={!!error || value === a.price}>
      <div className="flex items-center gap-3 px-1 pb-1 pt-1">
        <IconTile icon={meta.icon} tone={meta.tone} size={40} />
        <p className="min-w-0 text-[14px] leading-[1.6] text-label2">{a.description}{a.active ? "" : " · 提供を停止中"}</p>
      </div>

      <SheetGroup
        header="月額料金"
        footer={error ? <span className="text-red">{error}</span> : `導入中の${paying}医院には、${month}月分の請求から新しい料金を適用します。`}
      >
        <label className="flex min-h-[56px] items-center gap-2 px-4">
          <span className="text-[20px] font-semibold text-label2">¥</span>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && save()}
            inputMode="numeric"
            autoComplete="off"
            aria-label="月額料金"
            aria-invalid={!!error}
            className={cn("min-w-0 flex-1 bg-transparent text-[22px] font-semibold tnum outline-none", error && "text-red")}
          />
          <span className="shrink-0 text-[15px] text-label2">/ 月・1医院</span>
        </label>
      </SheetGroup>

      <SheetGroup header="売上の見込み">
        <div className="flex items-center justify-between gap-3 px-4 py-3 text-[15px] tnum">
          <span>
            <span className="text-label2">{yen(st.revenue)}</span>
            <span className="mx-1.5 text-label3">→</span>
            <span className="font-semibold">{yen(paying * next)}</span>
            <span className="ml-1 text-[13px] text-label2">/ 月</span>
          </span>
          <span className={cn("shrink-0 text-[14px] font-semibold", paying * next === st.revenue ? "text-label3" : paying * next > st.revenue ? "text-accent" : "text-label2")}>
            {paying * next === st.revenue ? "変更なし" : signedYen(paying * next - st.revenue)}
          </span>
        </div>
      </SheetGroup>

      <SheetGroup header={`導入している医院（${st.count}）`} footer="医院ごとの追加と解約は、医院の画面のオプションから行えます。">
        {st.users.length ? (
          st.users.map(c => (
            <div key={c.id} className="group relative flex min-h-[48px] items-center gap-3 px-4 py-2">
              <ClinicMark name={c.name} size={28} />
              <span className="min-w-0 flex-1 truncate text-[15px] md:text-[14px]">{c.name}</span>
              {!c.active && <span className="shrink-0 text-[12px] text-label3">停止中</span>}
              <PlanTag plan={c.plan} className="shrink-0" />
              <RowRule inset={56} />
            </div>
          ))
        ) : (
          <div className="px-4 py-4 text-[14px] text-label2">まだ導入している医院はありません。</div>
        )}
      </SheetGroup>
    </Sheet>
  );
}
