import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { type Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { type User as SelectUser } from "@shared/schema";
import connectPg from "connect-pg-simple";
import { createPool } from "./db-config";

const scryptAsync = promisify(scrypt);
const PostgresStore = connectPg(session);
const pool = createPool();

// セッション署名鍵を解決する。
// 本番では SESSION_SECRET 必須（未設定なら起動失敗）。開発では未設定時に
// 一時的なランダム鍵を生成する（再起動でセッションは失効するが、共有の
// ハードコード鍵によるセッション偽造リスクを排除する）。
function resolveSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET must be set to a value of at least 16 characters in production",
    );
  }
  console.warn(
    "[auth] SESSION_SECRET is not set — generating an ephemeral development secret. Sessions will not persist across restarts.",
  );
  return randomBytes(32).toString("hex");
}

const REMEMBER_ME_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30日

// 「ログイン状態を保持する」チェックに応じてセッションCookieの寿命を切り替える。
//  - remember あり: 30日間有効な永続Cookie（ブラウザを閉じても維持）
//  - remember なし: ブラウザを閉じると失効するセッションCookie
// 各ログインエンドポイント（管理者/患者）から認証成功後に呼び出す。
export function applyRememberMe(req: any, remember: unknown): void {
  if (!req?.session?.cookie) return;
  if (remember) {
    req.session.cookie.maxAge = REMEMBER_ME_MAX_AGE_MS;
  } else {
    req.session.cookie.expires = false;
  }
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: resolveSessionSecret(),
    resave: false,
    saveUninitialized: false,
    name: "sid",
    store: new PostgresStore({
      pool,
      createTableIfMissing: true,
      ttl: 30 * 24 * 60 * 60,
    }),
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  };

  app.set("trust proxy", 1);

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => {
    done(null, (user as SelectUser).id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    applyRememberMe(req, (req.body as any)?.rememberMe);
    res.status(200).json(req.user);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });
}

export { hashPassword, comparePasswords as comparePasswordsExport };
