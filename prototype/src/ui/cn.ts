import { clsx, type ClassValue } from "clsx";

/** クラス名の結合（このプロトタイプでは色名が独自なので tailwind-merge は使わない） */
export const cn = (...v: ClassValue[]) => clsx(v);
