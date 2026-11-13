// 動きの共通値。Appleのアプリに近い「速く出て、ふわっと止まる」バネを基本にする。
export const spring = { type: "spring", stiffness: 520, damping: 42, mass: 1 } as const;
export const springSoft = { type: "spring", stiffness: 300, damping: 34, mass: 1 } as const;
export const springBouncy = { type: "spring", stiffness: 420, damping: 26, mass: 0.9 } as const;
export const springPush = { type: "spring", stiffness: 380, damping: 40, mass: 1 } as const;
export const easeOut = [0.22, 1, 0.36, 1] as const;

/** 押したときの手応え（ボタン・カード共通） */
export const tap = { scale: 0.97 } as const;
export const tapSoft = { scale: 0.985 } as const;

/** 一覧の項目を少しずつずらして出す */
export const listItem = {
  hidden: { opacity: 0, y: 6 },
  show: (i: number = 0) => ({ opacity: 1, y: 0, transition: { ...springSoft, delay: Math.min(i, 12) * 0.025 } }),
};
