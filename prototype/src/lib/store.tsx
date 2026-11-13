import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from "react";
import { initialAppointments, initialMemos, notices as initialNotices, patients as patientRegistry, recalls as initialRecalls } from "@/data";
import type { Appointment, ApptStatus, Memo, Notice, Patient, RecallItem } from "@/data";
import { TODAY_KEY, minutesOfDay, now } from "./clock";

// 画面操作でサンプルデータが実際に変わるようにするための小さなストア（保存はしない）。
// 医院アプリ・患者アプリ・受付端末で同じストアを共有するので、患者さんがWeb予約すると
// 医院側の「今日」や「お知らせ」にそのまま現れる。
interface State {
  appointments: Appointment[];
  recalls: RecallItem[];
  notices: Notice[];
  patients: Patient[];
  memos: Memo[];
}

type Action =
  | { type: "status"; id: string; status: ApptStatus }
  | { type: "add"; appt: Appointment }
  | { type: "update"; id: string; patch: Partial<Appointment> }
  | { type: "remove"; id: string }
  | { type: "recall"; patientId: string; status: RecallItem["status"] }
  | { type: "readAll" }
  | { type: "read"; id: string }
  | { type: "notice"; notice: Notice }
  | { type: "patients"; patients: Patient[] }
  | { type: "memoAdd"; memo: Memo }
  | { type: "memoUpdate"; id: string; patch: Partial<Memo> }
  | { type: "memoRemove"; id: string };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "status": {
      const m = minutesOfDay(now());
      return {
        ...s,
        appointments: s.appointments.map(x => {
          if (x.id !== a.id) return x;
          const patch: Partial<Appointment> = { status: a.status };
          if (a.status === "arrived") patch.arrivedAt = m;
          if (a.status === "in_progress") { patch.startedAt = m; patch.arrivedAt = x.arrivedAt ?? m; }
          if (a.status === "confirmed") { patch.arrivedAt = undefined; patch.startedAt = undefined; }
          return { ...x, ...patch };
        }),
      };
    }
    case "add":
      return { ...s, appointments: [...s.appointments, a.appt] };
    case "update":
      return { ...s, appointments: s.appointments.map(x => (x.id === a.id ? { ...x, ...a.patch } : x)) };
    case "remove":
      return { ...s, appointments: s.appointments.filter(x => x.id !== a.id) };
    case "recall":
      return { ...s, recalls: s.recalls.map(r => (r.patientId === a.patientId ? { ...r, status: a.status, sentAt: a.status === "送信済み" ? now() : r.sentAt } : r)) };
    case "readAll":
      return { ...s, notices: s.notices.map(n => ({ ...n, read: true })) };
    case "read":
      return { ...s, notices: s.notices.map(n => (n.id === a.id ? { ...n, read: true } : n)) };
    case "notice":
      return { ...s, notices: [a.notice, ...s.notices] };
    case "patients":
      return { ...s, patients: a.patients };
    case "memoAdd":
      return { ...s, memos: [a.memo, ...s.memos] };
    case "memoUpdate":
      return { ...s, memos: s.memos.map(m => (m.id === a.id ? { ...m, ...a.patch } : m)) };
    case "memoRemove":
      return { ...s, memos: s.memos.filter(m => m.id !== a.id) };
  }
}

interface Store extends State {
  setStatus: (id: string, status: ApptStatus) => void;
  addAppointment: (appt: Omit<Appointment, "id">) => Appointment;
  updateAppointment: (id: string, patch: Partial<Appointment>) => void;
  removeAppointment: (id: string) => void;
  setRecall: (patientId: string, status: RecallItem["status"]) => void;
  readNotice: (id: string) => void;
  readAllNotices: () => void;
  /** お知らせを1件追加（先頭に入る。at=今、未読） */
  addNotice: (n: Omit<Notice, "id" | "at" | "read">) => Notice;
  /** 新しい患者を登録（id と診察券番号は自動）。patientById でも引けるようになる */
  addPatient: (p: Omit<Patient, "id" | "number">) => Patient;
  updatePatient: (id: string, patch: Partial<Patient>) => void;
  /** 診療メモを追加（id・日付・時刻は省略すると自動） */
  addMemo: (m: Omit<Memo, "id" | "date" | "at"> & Partial<Pick<Memo, "date" | "at">>) => Memo;
  updateMemo: (id: string, patch: Partial<Memo>) => void;
  removeMemo: (id: string) => void;
}

const Ctx = createContext<Store | null>(null);
let seq = 0;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    appointments: initialAppointments,
    recalls: initialRecalls,
    notices: initialNotices,
    patients: [...patientRegistry],
    memos: initialMemos,
  });
  const setStatus = useCallback((id: string, status: ApptStatus) => dispatch({ type: "status", id, status }), []);
  const addAppointment = useCallback((appt: Omit<Appointment, "id">) => {
    const full = { ...appt, id: `new-${++seq}` };
    dispatch({ type: "add", appt: full });
    return full;
  }, []);
  const updateAppointment = useCallback((id: string, patch: Partial<Appointment>) => dispatch({ type: "update", id, patch }), []);
  const removeAppointment = useCallback((id: string) => dispatch({ type: "remove", id }), []);
  const setRecall = useCallback((patientId: string, status: RecallItem["status"]) => dispatch({ type: "recall", patientId, status }), []);
  const readNotice = useCallback((id: string) => dispatch({ type: "read", id }), []);
  const readAllNotices = useCallback(() => dispatch({ type: "readAll" }), []);
  const addNotice = useCallback((n: Omit<Notice, "id" | "at" | "read">) => {
    const full: Notice = { ...n, id: `n-new-${++seq}`, at: now(), read: false };
    dispatch({ type: "notice", notice: full });
    return full;
  }, []);
  // 患者は data の patients 配列（patientById が引く台帳）とストアの両方に反映する
  const addPatient = useCallback((p: Omit<Patient, "id" | "number">) => {
    const n = patientRegistry.length;
    const full: Patient = { ...p, id: `p-new-${++seq}`, number: String(1040 + n * 17).padStart(6, "0") };
    patientRegistry.push(full);
    dispatch({ type: "patients", patients: [...patientRegistry] });
    return full;
  }, []);
  const updatePatient = useCallback((id: string, patch: Partial<Patient>) => {
    const i = patientRegistry.findIndex(p => p.id === id);
    if (i < 0) return;
    patientRegistry[i] = { ...patientRegistry[i], ...patch };
    dispatch({ type: "patients", patients: [...patientRegistry] });
  }, []);
  const addMemo = useCallback((m: Omit<Memo, "id" | "date" | "at"> & Partial<Pick<Memo, "date" | "at">>) => {
    const full: Memo = { date: TODAY_KEY, at: minutesOfDay(now()), ...m, id: `m-new-${++seq}` };
    dispatch({ type: "memoAdd", memo: full });
    return full;
  }, []);
  const updateMemo = useCallback((id: string, patch: Partial<Memo>) => dispatch({ type: "memoUpdate", id, patch }), []);
  const removeMemo = useCallback((id: string) => dispatch({ type: "memoRemove", id }), []);
  const value = useMemo(
    () => ({
      ...state, setStatus, addAppointment, updateAppointment, removeAppointment, setRecall, readNotice, readAllNotices,
      addNotice, addPatient, updatePatient, addMemo, updateMemo, removeMemo,
    }),
    [state, setStatus, addAppointment, updateAppointment, removeAppointment, setRecall, readNotice, readAllNotices,
      addNotice, addPatient, updatePatient, addMemo, updateMemo, removeMemo],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("StoreProvider がありません");
  return s;
}
