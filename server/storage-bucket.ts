// Supabase Storage への同意書PDF保存ヘルパー。
// 環境変数（SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY）が設定されていれば
// Storage に保存し署名URLを返す。未設定の場合は null を返し、呼び出し側で
// DB(base64) フォールバックに切り替える。これにより設定なしでも動作し、
// 本番でキーを入れれば自動で商用グレードの保存に切り替わる。
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "consent-forms";
const SIGNED_URL_TTL = 60 * 60 * 24 * 365; // 1年

let client: SupabaseClient | null = null;
let initialized = false;

function getClient(): SupabaseClient | null {
  if (initialized) return client;
  initialized = true;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    client = createClient(url, key, { auth: { persistSession: false } });
    console.log("[Storage] Supabase Storage 有効（同意書PDFをバケットに保存）");
  } else {
    console.log("[Storage] Supabase Storage 未設定。同意書PDFはDBに保存します（SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY で有効化）");
  }
  return client;
}

export function isStorageEnabled(): boolean {
  return getClient() !== null;
}

/** PDFバイト列を保存し { path, url } を返す。Storage未設定なら null。 */
export async function uploadConsentPdf(
  clinicId: string,
  consentId: string,
  pdf: Buffer,
): Promise<{ path: string; url: string } | null> {
  const c = getClient();
  if (!c) return null;
  const path = `${clinicId}/${consentId}.pdf`;
  const { error } = await c.storage.from(BUCKET).upload(path, pdf, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (error) {
    console.error("[Storage] アップロード失敗:", error.message);
    return null;
  }
  const { data, error: signErr } = await c.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
  if (signErr || !data) {
    console.error("[Storage] 署名URL生成失敗:", signErr?.message);
    return { path, url: "" };
  }
  return { path, url: data.signedUrl };
}

/** 保存済みPDFの新しい署名URLを発行（期限切れ対策）。 */
export async function refreshConsentPdfUrl(path: string): Promise<string | null> {
  const c = getClient();
  if (!c) return null;
  const { data, error } = await c.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
  if (error || !data) return null;
  return data.signedUrl;
}
