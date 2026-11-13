import { createContext, useCallback, useContext, useSyncExternalStore } from "react";

// 画面の場所はURLの # に「アプリ--画面--パラメータ--シート」の形で持つ。
//   例: #clinic--patients--p012 / #clinic--schedule----appt-a0012（パラメータなしでシートだけ）
// 公開先（Artifact）のリンクと受け渡しできる # は英数字とハイフンだけなので、区切りを「--」にしている。
export type AppId = "launcher" | "clinic" | "patient" | "console" | "login" | "kiosk";

export interface Route {
  app: AppId;
  screen: string;
  param?: string;
  sheet?: string;
}

const DEFAULT_SCREEN: Record<AppId, string> = {
  launcher: "home",
  clinic: "today",
  patient: "home",
  console: "overview",
  login: "login",
  kiosk: "checkin",
};
const APPS = Object.keys(DEFAULT_SCREEN) as AppId[];

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, "");
  // 旧形式（. 区切り）のリンクも読めるようにしておく
  const parts = raw.includes(".") && !raw.includes("--") ? raw.split(".") : raw.split("--");
  const app = (APPS.includes(parts[0] as AppId) ? parts[0] : "launcher") as AppId;
  const screen = parts[1] || DEFAULT_SCREEN[app];
  const param = parts[2] && parts[2] !== "_" ? parts[2] : undefined;
  const sheet = parts[3] || undefined;
  return { app, screen, param, sheet };
}

export function toHash(r: Route): string {
  const segs: string[] = [r.app];
  if (r.screen !== DEFAULT_SCREEN[r.app] || r.param || r.sheet) segs.push(r.screen);
  if (r.param || r.sheet) segs.push(r.param ?? "");
  if (r.sheet) segs.push(r.sheet);
  return `#${segs.join("--")}`;
}

const EVT = "arche:navigate";
function subscribe(cb: () => void) {
  window.addEventListener("hashchange", cb);
  window.addEventListener("popstate", cb);
  window.addEventListener(EVT, cb);
  return () => {
    window.removeEventListener("hashchange", cb);
    window.removeEventListener("popstate", cb);
    window.removeEventListener(EVT, cb);
  };
}
const getHash = () => window.location.hash;

export function navigate(r: Route, opts: { replace?: boolean } = {}) {
  const h = toHash(r);
  if (h === window.location.hash) return;
  if (opts.replace) {
    try {
      history.replaceState(null, "", h);
    } catch {
      window.location.replace(h);
    }
  } else {
    // hashchange が起きる方法で移動する（公開先のアドレス表示もこれに追従する）
    window.location.hash = h;
  }
  window.dispatchEvent(new Event(EVT));
}

/**
 * アプリを切り替えるアニメーションの間、画面から消えていくアプリには「消える前の場所」を見せ続ける。
 * （新しい # を読んで別の画面を描いたり、勝手に移動したりしないように）
 */
const FrozenCtx = createContext<Route | null>(null);
export const FrozenRoute = FrozenCtx.Provider;

/** 現在の場所と、移動用の関数。go は同じアプリ内の移動、goApp は別アプリへの移動 */
export function useRoute() {
  const frozen = useContext(FrozenCtx);
  const hash = useSyncExternalStore(subscribe, getHash, getHash);
  const route = frozen ?? parseHash(hash);
  const go = useCallback(
    (screen: string, param?: string, opts?: { replace?: boolean; sheet?: string }) => {
      if (frozen) return;
      navigate({ app: parseHash(window.location.hash).app, screen, param, sheet: opts?.sheet }, opts);
    },
    [frozen],
  );
  const setSheet = useCallback((sheet?: string) => {
    if (frozen) return;
    const cur = parseHash(window.location.hash);
    navigate({ ...cur, sheet }, { replace: true });
  }, [frozen]);
  const goApp = useCallback((app: AppId, screen?: string, param?: string) => {
    if (frozen) return;
    navigate({ app, screen: screen ?? DEFAULT_SCREEN[app], param });
  }, [frozen]);
  return { route, go, goApp, setSheet };
}
