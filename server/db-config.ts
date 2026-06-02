import { Pool, type PoolConfig } from "pg";

// PostgreSQL接続設定を一元化する。
//
// Supabase など、マネージドなPostgresはSSL接続が必須。一方でローカル開発の
// Postgres はSSL非対応のことが多い。そこで接続先がローカルでない場合のみ
// SSLを有効化する（証明書チェーンの検証はマネージド環境では一般的に
// rejectUnauthorized:false で運用する）。
//
// 明示的に制御したい場合は環境変数 PGSSL で上書きできる:
//   PGSSL=require  → 常にSSLを有効化
//   PGSSL=disable  → 常にSSLを無効化
export function buildPoolConfig(): PoolConfig {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Please configure the PostgreSQL connection string.");
  }

  const pgssl = (process.env.PGSSL || "").toLowerCase();
  const isLocal = /(@|\/\/)(localhost|127\.0\.0\.1|\[::1\])(:|\/)/.test(connectionString);

  let useSsl: boolean;
  if (pgssl === "require" || pgssl === "true") useSsl = true;
  else if (pgssl === "disable" || pgssl === "false") useSsl = false;
  else useSsl = !isLocal; // 既定: ローカル以外はSSL有効

  return {
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  };
}

export function createPool(): Pool {
  return new Pool(buildPoolConfig());
}
