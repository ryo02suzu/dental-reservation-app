import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

// Supabase等のマネージドPostgresはSSL必須。ローカル以外はSSLを有効化する
// （PGSSL=require/disable で明示的に上書き可能）。
const isLocal = /(@|\/\/)(localhost|127\.0\.0\.1|\[::1\])(:|\/)/.test(connectionString);
const pgssl = (process.env.PGSSL || "").toLowerCase();
const useSsl = pgssl === "require" || pgssl === "true" ? true
  : pgssl === "disable" || pgssl === "false" ? false
  : !isLocal;

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  },
});
