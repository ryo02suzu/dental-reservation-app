import { Request } from "express";

export const INPUT_LIMITS = {
  name: 100,
  phone: 20,
  email: 254,
  password: 128,
  text: 1000,
  longText: 5000,
};

export interface PasswordValidationResult {
  valid: boolean;
  message?: string;
}

export function validatePassword(password: string): PasswordValidationResult {
  if (!password || typeof password !== "string") {
    return { valid: false, message: "パスワードを入力してください" };
  }
  if (password.length < 8) {
    return { valid: false, message: "パスワードは8文字以上で設定してください" };
  }
  if (password.length > INPUT_LIMITS.password) {
    return { valid: false, message: "パスワードが長すぎます" };
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, message: "パスワードにはアルファベットを含めてください" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "パスワードには数字を含めてください" };
  }
  return { valid: true };
}

export function sanitizeString(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}

export function stripSensitiveFields<T extends Record<string, any>>(obj: T): Omit<T, "password"> {
  const { password: _pw, ...safe } = obj;
  return safe as Omit<T, "password">;
}

export function logSecurityEvent(
  event: string,
  ip: string,
  details: Record<string, string | number | boolean> = {}
): void {
  const timestamp = new Date().toISOString();
  const safeDetails = Object.entries(details)
    .map(([k, v]) => `${k}=${String(v).slice(0, 80)}`)
    .join(" ");
  console.log(`[SECURITY] ${timestamp} event=${event} ip=${ip} ${safeDetails}`);
}
