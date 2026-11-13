import type { ColumnMode, View } from "./model";

/** 画面を離れて戻ってきても、表示の選び方（日・週・月、列、絞り込み）は覚えておく。保存はしない */
export const scheduleMemory: { view: View; mode: ColumnMode; cancelled: boolean; unit: string } = {
  view: "day",
  mode: "unit",
  cancelled: false,
  unit: "all",
};
