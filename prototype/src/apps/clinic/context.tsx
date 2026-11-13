import { createContext, useContext } from "react";

/** 新規予約シートに最初から入れておく値 */
export interface NewPrefill {
  date?: string;
  start?: number;
  unitId?: string;
  staffId?: string;
  patientId?: string;
  serviceId?: string;
}

export interface ClinicUI {
  /** 予約の詳細シートを開く */
  openAppointment: (id: string) => void;
  /** 新規予約シートを開く */
  openNew: (prefill?: NewPrefill) => void;
  /** 全体検索（⌘K）を開く */
  openSearch: () => void;
  /** 同じアプリ内で画面を移動 */
  go: (screen: string, param?: string) => void;
  /** スマホで、その他タブの下にある画面のときの「戻る」 */
  back?: { label: string; onClick: () => void };
  phone: boolean;
}

export const ClinicUICtx = createContext<ClinicUI | null>(null);

export function useClinicUI(): ClinicUI {
  const v = useContext(ClinicUICtx);
  if (!v) throw new Error("ClinicUICtx がありません");
  return v;
}
