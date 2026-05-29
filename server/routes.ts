import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import rateLimit from "express-rate-limit";
import { storage, DEFAULT_CLINIC_ID } from "./storage";
import { isJapaneseHoliday, getJapaneseHolidayName } from "./holidays";
import { resetDemoAppointments } from "./seed";
import type { Patient } from "@shared/schema";
import { hashPassword, comparePasswordsExport } from "./auth";
import { 
  sendBookingConfirmationEmail, 
  sendCancellationEmail, 
  sendRecallEmail, 
  sendTestEmail,
  sendNewBookingNotificationToAdmin,
  sendPendingBookingEmail,
} from "./email";
import { sendLineMessage, buildBookingConfirmationMessage } from "./line";
import { runDailyReminders } from "./scheduler";
import { getPlanLimitsFromDB } from "./plans";
import { validatePassword, sanitizeString, getClientIp, logSecurityEvent, INPUT_LIMITS } from "./security";
import * as crypto from "crypto";

// ─── SSE Notification Clients ─────────────────────────────────────────────────
const notificationClients = new Map<string, Set<Response>>();

function pushNotificationToClinic(clinicId: string, payload: object) {
  const clients = notificationClients.get(clinicId);
  if (!clients || clients.size === 0) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  clients.forEach(res => {
    try { res.write(data); } catch {}
  });
}

// ─── SSE Attendance Real-time Clients ────────────────────────────────────────
const attendanceClients = new Map<string, Set<Response>>();

// ─── QR Clock-in Token Store (rotating tokens per clinic) ────────────────────
const clockInTokens = new Map<string, { token: string; clinicId: string; expiresAt: number }>();

function generateClockInToken(clinicId: string): string {
  const token = crypto.randomBytes(16).toString("hex");
  clockInTokens.set(token, { token, clinicId, expiresAt: Date.now() + 60_000 });
  return token;
}

function validateClockInToken(token: string): string | null {
  const entry = clockInTokens.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    clockInTokens.delete(token);
    return null;
  }
  return entry.clinicId;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of clockInTokens) {
    if (now > v.expiresAt) clockInTokens.delete(k);
  }
}, 30_000);

function pushAttendanceToClinic(clinicId: string, payload: object) {
  const clients = attendanceClients.get(clinicId);
  if (!clients || clients.size === 0) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  clients.forEach(res => {
    try { res.write(data); } catch {}
  });
}

// ─── QR打刻PINの検証ヘルパー ──────────────────────────────────────────────
// 定数時間比較でタイミング攻撃を防ぎ、クリニック+スタッフ単位の試行回数制限で
// 総当たりを防ぐ。
function pinMatches(supplied: string, stored: string): boolean {
  const a = Buffer.from(String(supplied));
  const b = Buffer.from(String(stored));
  // 長さが異なる場合は timingSafeEqual が例外を投げるため事前に弾く
  // （PINは固定桁数のため長さ漏洩の実害はない）
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

const PIN_MAX_ATTEMPTS = 5;
const PIN_ATTEMPT_WINDOW_MS = 5 * 60 * 1000;
const pinAttempts = new Map<string, { count: number; resetAt: number }>();
function pinRateLimitOk(key: string): boolean {
  const rec = pinAttempts.get(key);
  if (!rec || Date.now() > rec.resetAt) return true;
  return rec.count < PIN_MAX_ATTEMPTS;
}
function recordPinFailure(key: string): void {
  const now = Date.now();
  const rec = pinAttempts.get(key);
  if (!rec || now > rec.resetAt) pinAttempts.set(key, { count: 1, resetAt: now + PIN_ATTEMPT_WINDOW_MS });
  else rec.count++;
}
function clearPinAttempts(key: string): void { pinAttempts.delete(key); }
// 期限切れエントリの定期クリーンアップ（メモリリーク防止）
setInterval(() => {
  const now = Date.now();
  pinAttempts.forEach((v, k) => { if (now > v.resetAt) pinAttempts.delete(k); });
}, PIN_ATTEMPT_WINDOW_MS).unref?.();

// ─── シークレットのマスク処理 ─────────────────────────────────────────────
// API応答では実際のシークレット（APIキー/トークン）を返さずマスク値を返す。
// 保存時にマスク値（または未送信）が来た場合は既存値を保持し、フォームの
// 動作を変えずに鍵の誤消去と漏洩の両方を防ぐ。
const MASKED_SECRET = "********";
const maskSecret = (v?: string | null): string => (v ? MASKED_SECRET : "");
const resolveSecret = (incoming: unknown, prev: string | null | undefined): string | null => {
  if (incoming === undefined || incoming === null) return prev ?? null; // 未送信 → 既存維持
  if (incoming === MASKED_SECRET) return prev ?? null;                  // マスク値 → 既存維持
  const s = String(incoming);
  return s === "" ? null : s;                                           // 明示クリア or 新しい値
};

// Rate limiters for public endpoints
const publicBookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "リクエストが多すぎます。しばらく経ってから再度お試しください。" },
  standardHeaders: true,
  legacyHeaders: false,
});
const publicSlotsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { message: "リクエストが多すぎます。しばらく経ってから再度お試しください。" },
  standardHeaders: true,
  legacyHeaders: false,
});
const publicGeneralLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: "リクエストが多すぎます。しばらく経ってから再度お試しください。" },
  standardHeaders: true,
  legacyHeaders: false,
});
// Strict auth limiters — prevent brute-force on login, register, password reset
const authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "ログイン試行が多すぎます。15分後に再度お試しください。" },
  standardHeaders: true,
  legacyHeaders: false,
});
const authRegisterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { message: "登録試行が多すぎます。1時間後に再度お試しください。" },
  standardHeaders: true,
  legacyHeaders: false,
});
const authResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { message: "パスワードリセット試行が多すぎます。1時間後に再度お試しください。" },
  standardHeaders: true,
  legacyHeaders: false,
});
const publicCancelLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { message: "キャンセル操作が多すぎます。1時間後に再度お試しください。" },
  standardHeaders: true,
  legacyHeaders: false,
});
// 電話番号による予約照会の総当たり（患者列挙）を防ぐ厳しめの制限
const publicLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: "照会の試行が多すぎます。しばらく経ってから再度お試しください。" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Max active (pending/confirmed) appointments allowed per patient
const MAX_ACTIVE_APPOINTMENTS_PER_PATIENT = 3;
// Max cancellations in last 30 days before blocking future bookings
const MAX_CANCELLATIONS_PER_MONTH = 3;

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  await storage.initialize();

  // Disable HTTP caching for all API routes (prevents 304 stale-data issues)
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  // Middleware to require authentication
  const requireAuth = (req: any, res: any, next: any) => {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ message: "Unauthorized" });
  };

  // Middleware to require super admin
  const requireSuperAdmin = (req: any, res: any, next: any) => {
    if (req.isAuthenticated() && req.user?.isSuperAdmin) return next();
    res.status(403).json({ message: "スーパー管理者権限が必要です" });
  };

  // Helper: resolve clinicId for the current admin user (supports super-admin impersonation)
  const getAdminClinicId = (req: any): string => {
    return (req.session as any)?.impersonatedClinicId || req.user?.clinicId || DEFAULT_CLINIC_ID;
  };

  // Helper: 指定リソースが現在の管理者のクリニックに属するか検証する。
  // 属さない／存在しない場合は 404 を返して false を返す（存在の有無を秘匿するため
  // 403 ではなく一律 404）。マルチテナント間の IDOR を防ぐ。
  const assertClinicOwnership = <T extends { clinicId?: string | null }>(
    req: any,
    res: any,
    resource: T | null | undefined,
  ): resource is T => {
    if (!resource || resource.clinicId !== getAdminClinicId(req)) {
      res.status(404).json({ message: "Not found" });
      return false;
    }
    return true;
  };

  // Demo auto-login routes (no auth required)
  const DEMO_PATIENT_ID = "c6dc53f7-a749-415f-8532-7452fbe7f82b";
  app.get("/api/demo/admin", async (req, res) => {
    try {
      const user = await storage.getUserByUsername("demo-admin");
      if (!user) return res.redirect("/login");
      // デモデータをリセット（完了してからリダイレクト）
      await resetDemoAppointments();
      req.login(user, (err) => {
        if (err) return res.redirect("/login");
        res.redirect("/admin");
      });
    } catch { res.redirect("/login"); }
  });
  app.get("/api/demo/patient", async (req, res) => {
    try {
      (req.session as any).patientId = DEMO_PATIENT_ID;
      req.session.save(() => res.redirect("/my-appointments"));
    } catch { res.redirect("/my-appointments"); }
  });
  // デモ用: スタッフマイページ自動ログイン (山田 一郎 / doctor)
  const DEMO_STAFF_ID = "a2af3017-5135-4efa-b106-8db63263d456";
  app.get("/api/demo/staff", async (req, res) => {
    try {
      (req.session as any).staffMemberId = DEMO_STAFF_ID;
      (req.session as any).staffClinicId = "default-clinic-001";
      req.session.save(() => res.redirect("/my-schedule"));
    } catch { res.redirect("/my-schedule"); }
  });
  // デモ用: 患者ログインなしで予約体験
  app.post("/api/demo/booking-guest", async (req, res) => {
    try {
      const patient = await storage.getPatientById(DEMO_PATIENT_ID);
      if (!patient) return res.status(404).json({ message: "デモ患者が見つかりません" });
      (req.session as any).patientId = DEMO_PATIENT_ID;
      req.session.save(() => res.json({ patient: { id: patient.id, name: patient.name, phone: patient.phone ?? "" } }));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Auth helper routes
  app.get("/api/auth/me", (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not logged in" });
    res.json(req.user);
  });

  app.get("/api/auth/setup-needed", async (_req, res) => {
    try {
      const hasUsers = await storage.hasUsers();
      res.json({ setupNeeded: !hasUsers });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/auth/setup", async (req, res) => {
    try {
      const hasUsers = await storage.hasUsers();
      if (hasUsers) return res.status(400).json({ message: "Setup already completed" });
      const { username, password, clinicName, clinicPhone, clinicAddress } = req.body;
      if (!username || !password) return res.status(400).json({ message: "Username and password required" });
      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({ username, password: hashedPassword, clinicId: null, isSuperAdmin: true });
      if (clinicName) {
        await storage.upsertClinic({ name: clinicName, phone: clinicPhone || "", address: clinicAddress || "" });
      }
      res.status(201).json(user);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ─── スーパー管理者API ─────────────────────────────────────────────────────

  // 全医院一覧
  app.get("/api/super-admin/clinics", requireSuperAdmin, async (_req, res) => {
    try {
      const clinics = await storage.getAllClinics();
      const result = await Promise.all(clinics.map(async (clinic) => {
        const [appts, staff, addons] = await Promise.all([
          storage.getAppointments({ clinicId: clinic.id }),
          storage.getStaff(clinic.id),
          storage.getClinicAddons(clinic.id),
        ]);
        return { ...clinic, appointmentCount: appts.length, staffCount: staff.length, addonKeys: addons.map(a => a.addonKey) };
      }));
      res.json(result);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // スーパー管理者が医院になりすます（管理画面閲覧用）
  app.post("/api/super-admin/clinics/:id/impersonate", requireSuperAdmin, async (req, res) => {
    try {
      const clinic = await storage.getClinic(req.params.id);
      if (!clinic) return res.status(404).json({ message: "医院が見つかりません" });
      (req.session as any).impersonatedClinicId = clinic.id;
      (req.session as any).impersonatedClinicName = clinic.name;
      logSecurityEvent("super_admin_impersonate_start", getClientIp(req), {
        superAdminId: (req as any).user?.id,
        clinicId: clinic.id,
      });
      res.json({ clinicId: clinic.id, clinicName: clinic.name });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // なりすまし解除
  app.post("/api/super-admin/impersonate/exit", requireSuperAdmin, async (req, res) => {
    const prevClinicId = (req.session as any).impersonatedClinicId || null;
    delete (req.session as any).impersonatedClinicId;
    delete (req.session as any).impersonatedClinicName;
    logSecurityEvent("super_admin_impersonate_end", getClientIp(req), {
      superAdminId: (req as any).user?.id,
      clinicId: prevClinicId,
    });
    res.json({ ok: true });
  });

  // なりすまし状態を返す
  app.get("/api/super-admin/impersonate/status", requireAuth, (req, res) => {
    const clinicId = (req.session as any).impersonatedClinicId || null;
    const clinicName = (req.session as any).impersonatedClinicName || null;
    res.json({ active: !!clinicId, clinicId, clinicName });
  });

  // 医院のステータス変更
  app.patch("/api/super-admin/clinics/:id/status", requireSuperAdmin, async (req, res) => {
    try {
      const { isActive } = req.body;
      const clinic = await storage.updateClinicStatus(req.params.id, isActive);
      if (!clinic) return res.status(404).json({ message: "医院が見つかりません" });
      res.json(clinic);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // 医院のプラン変更
  app.patch("/api/super-admin/clinics/:id/plan", requireSuperAdmin, async (req, res) => {
    try {
      const { planType } = req.body;
      if (!["free", "starter", "pro", "enterprise", "partner"].includes(planType)) {
        return res.status(400).json({ message: "無効なプランです" });
      }
      const clinic = await storage.updateClinicPlan(req.params.id, planType);
      if (!clinic) return res.status(404).json({ message: "医院が見つかりません" });
      res.json(clinic);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // 医院削除（カスケード削除 - 全データ消去）
  app.delete("/api/super-admin/clinics/:id", requireSuperAdmin, async (req, res) => {
    try {
      const clinic = await storage.getClinic(req.params.id);
      if (!clinic) return res.status(404).json({ message: "医院が見つかりません" });
      await storage.deleteClinic(req.params.id);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // 医院の管理者パスワードリセット
  app.post("/api/super-admin/clinics/:id/reset-admin-password", requireSuperAdmin, async (req, res) => {
    try {
      const users = await storage.getUsersByClinicId(req.params.id);
      if (users.length === 0) return res.status(404).json({ message: "この医院の管理者が見つかりません" });
      const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let tempPassword = "";
      for (let i = 0; i < 10; i++) tempPassword += chars[Math.floor(Math.random() * chars.length)];
      const hashed = await hashPassword(tempPassword);
      await storage.setUserPassword(users[0].id, hashed);
      res.json({ username: users[0].username, tempPassword });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── プラン定義管理 ─────────────────────────────────────────────────────────
  app.get("/api/super-admin/plans", requireSuperAdmin, async (_req, res) => {
    try { res.json(await storage.getPlanDefinitions()); }
    catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/super-admin/plans", requireSuperAdmin, async (req, res) => {
    try {
      const { key, name, price, maxAppointmentsPerMonth, maxStaff, features, isActive, sortOrder } = req.body;
      if (!key || !name) return res.status(400).json({ message: "keyとnameは必須です" });
      res.json(await storage.createPlanDefinition({ key, name, price: price ?? 0, maxAppointmentsPerMonth, maxStaff, features, isActive, sortOrder }));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.patch("/api/super-admin/plans/:id", requireSuperAdmin, async (req, res) => {
    try {
      const { id: _id, createdAt: _ca, updatedAt: _ua, ...safeData } = req.body;
      const plan = await storage.updatePlanDefinition(req.params.id, safeData);
      if (!plan) return res.status(404).json({ message: "プランが見つかりません" });
      res.json(plan);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/super-admin/plans/:id", requireSuperAdmin, async (req, res) => {
    try { await storage.deletePlanDefinition(req.params.id); res.json({ success: true }); }
    catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── オプション定義管理 ──────────────────────────────────────────────────────
  app.get("/api/super-admin/addons", requireSuperAdmin, async (_req, res) => {
    try { res.json(await storage.getAddonDefinitions()); }
    catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/super-admin/addons", requireSuperAdmin, async (req, res) => {
    try {
      const { key, name, price, description, isActive, sortOrder } = req.body;
      if (!key || !name) return res.status(400).json({ message: "keyとnameは必須です" });
      res.json(await storage.createAddonDefinition({ key, name, price: price ?? 0, description, isActive, sortOrder }));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.patch("/api/super-admin/addons/:id", requireSuperAdmin, async (req, res) => {
    try {
      const { id: _id, createdAt: _ca, ...safeData } = req.body;
      const addon = await storage.updateAddonDefinition(req.params.id, safeData);
      if (!addon) return res.status(404).json({ message: "オプションが見つかりません" });
      res.json(addon);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/super-admin/addons/:id", requireSuperAdmin, async (req, res) => {
    try { await storage.deleteAddonDefinition(req.params.id); res.json({ success: true }); }
    catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── クリニックオプション割り当て ──────────────────────────────────────────
  app.get("/api/super-admin/clinics/:id/addons", requireSuperAdmin, async (req, res) => {
    try { res.json(await storage.getClinicAddons(req.params.id)); }
    catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.patch("/api/super-admin/clinics/:id/addons/:addonKey", requireSuperAdmin, async (req, res) => {
    try {
      const { enabled } = req.body;
      await storage.setClinicAddon(req.params.id, req.params.addonKey, !!enabled);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/super-admin/clinics/:id/email-settings", requireSuperAdmin, async (req, res) => {
    try {
      const settings = await storage.getReminderSettings(req.params.id);
      // 実際のAPIキーは返さずマスクする
      res.json({ resendApiKey: maskSecret(settings?.resendApiKey) });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.patch("/api/super-admin/clinics/:id/email-settings", requireSuperAdmin, async (req, res) => {
    try {
      const { resendApiKey } = req.body;
      const prev = await storage.getReminderSettings(req.params.id);
      const settings = await storage.upsertReminderSettings(
        { resendApiKey: resolveSecret(resendApiKey, prev?.resendApiKey) },
        req.params.id
      );
      res.json({ success: true, hasKey: !!settings.resendApiKey });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── 医院セルフ登録（公開API） ────────────────────────────────────────────

  app.post("/api/clinics/register", async (req, res) => {
    try {
      const { name, slug, phone, address, email, adminUsername, adminPassword, planType, addonKeys } = req.body;
      if (!name || !slug || !adminUsername || !adminPassword) {
        return res.status(400).json({ message: "医院名、スラッグ、管理者ユーザー名、パスワードは必須です" });
      }
      const pwCheck = validatePassword(adminPassword);
      if (!pwCheck.valid) return res.status(400).json({ message: pwCheck.message });
      
      if (!/^[a-z0-9-]+$/.test(slug)) {
        return res.status(400).json({ message: "スラッグは英小文字・数字・ハイフンのみ使用できます" });
      }

      // Self-registration always starts on free plan — plan upgrades require super admin
      const selectedPlan = "free";
      const selectedAddons: string[] = [];

      const existingBySlug = await storage.getClinicBySlug(slug);
      if (existingBySlug) {
        return res.status(409).json({ message: "このスラッグは既に使用されています" });
      }
      const existingUser = await storage.getUserByUsername(adminUsername);
      if (existingUser) {
        return res.status(409).json({ message: "このユーザー名は既に使用されています" });
      }

      const hashedPassword = await hashPassword(adminPassword);
      const { clinic, user } = await storage.createClinicFull(
        { name, slug, phone, address, email, planType: selectedPlan },
        { username: adminUsername, password: hashedPassword },
        selectedAddons
      );
      res.status(201).json({ clinic, user: { id: user.id, username: user.username } });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // スラッグ存在確認（リアルタイムチェック用）
  app.get("/api/clinics/check-slug", async (req, res) => {
    try {
      const { slug } = req.query as { slug: string };
      if (!slug) return res.status(400).json({ message: "slug required" });
      const existing = await storage.getClinicBySlug(slug);
      res.json({ available: !existing });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Contact form (public)
  app.post("/api/contact", publicGeneralLimiter, async (req, res) => {
    try {
      const { name, clinicName, email, phone, subject, message } = req.body;
      if (!name || !email || !subject || !message) {
        return res.status(400).json({ message: "必須項目が不足しています" });
      }
      if (typeof name !== "string" || typeof email !== "string" || typeof subject !== "string" || typeof message !== "string") {
        return res.status(400).json({ message: "不正なリクエストです" });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: "有効なメールアドレスを入力してください" });
      }
      // HTML escape all user-supplied values to prevent injection attacks
      const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      const safeName = esc(String(name).slice(0, 100));
      const safeClinic = esc(String(clinicName || "").slice(0, 100)) || "（未入力）";
      const safeEmail = esc(String(email).slice(0, 254));
      const safePhone = esc(String(phone || "").slice(0, 20)) || "（未入力）";
      const safeSubject = esc(String(subject).slice(0, 200));
      const safeMessage = esc(String(message).slice(0, 5000));

      const { Resend } = await import("resend");
      const apiKey = process.env.RESEND_API_KEY;
      if (apiKey) {
        const resend = new Resend(apiKey);
        await resend.emails.send({
          from: "Arche Contact <onboarding@resend.dev>",
          to: ["sourirette.consulting@gmail.com"],
          replyTo: email,
          subject: `[お問い合わせ] ${safeSubject} - ${safeName}`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
              <h2 style="color:#1a1a2e;margin-bottom:24px">お問い合わせが届きました</h2>
              <table style="width:100%;border-collapse:collapse">
                <tr><td style="padding:8px 0;color:#666;width:120px">お名前</td><td style="padding:8px 0;font-weight:600">${safeName}</td></tr>
                <tr><td style="padding:8px 0;color:#666">医院名</td><td style="padding:8px 0">${safeClinic}</td></tr>
                <tr><td style="padding:8px 0;color:#666">メール</td><td style="padding:8px 0"><a href="mailto:${safeEmail}">${safeEmail}</a></td></tr>
                <tr><td style="padding:8px 0;color:#666">電話番号</td><td style="padding:8px 0">${safePhone}</td></tr>
                <tr><td style="padding:8px 0;color:#666">種別</td><td style="padding:8px 0">${safeSubject}</td></tr>
              </table>
              <hr style="margin:20px 0;border:none;border-top:1px solid #eee" />
              <h3 style="color:#1a1a2e;margin-bottom:8px">お問い合わせ内容</h3>
              <p style="white-space:pre-wrap;color:#333;line-height:1.6">${safeMessage}</p>
              <hr style="margin:20px 0;border:none;border-top:1px solid #eee" />
              <p style="color:#999;font-size:12px">Arche お問い合わせフォームより送信</p>
            </div>
          `,
        });
      } else {
        console.log("[Contact] RESEND_API_KEY not set — logging inquiry:", { name: safeName, email: safeEmail, subject: safeSubject });
      }
      res.json({ success: true });
    } catch (e: any) {
      console.error("[Contact] Error:", e);
      res.status(500).json({ message: "送信に失敗しました" });
    }
  });


  // Apply rate limiting to all public endpoints
  app.use("/api/public", publicGeneralLimiter);
  app.post("/api/public/:slug/book", publicBookingLimiter);
  app.post("/api/public/book", publicBookingLimiter);
  app.get("/api/public/:slug/slots", publicSlotsLimiter);
  app.get("/api/public/slots", publicSlotsLimiter);
  // Auth endpoint rate limits
  app.post("/api/patient/login", authLoginLimiter);
  app.post("/api/patient/register", authRegisterLimiter);
  app.post("/api/patient/reset-password", authResetLimiter);
  app.post("/api/public/cancel/:id", publicCancelLimiter);
  app.get("/api/public/my-appointments", publicLookupLimiter);

  // ─── 患者向け公開API（スラッグ別） ──────────────────────────────────────

  // スラッグ別クリニック情報
  app.get("/api/public/:slug/info", async (req, res) => {
    try {
      const clinic = await storage.getClinicBySlug(req.params.slug);
      if (!clinic) return res.status(404).json({ message: "医院が見つかりません" });
      if (!clinic.isActive) return res.status(403).json({ message: "この医院は現在利用停止中です" });
      const [hours, holidays, services, staffList, settings] = await Promise.all([
        storage.getBusinessHours(clinic.id),
        storage.getHolidays(clinic.id),
        storage.getServices(clinic.id),
        storage.getStaff(clinic.id),
        storage.getClinicSettings(clinic.id),
      ]);
      res.json({
        clinic, hours, holidays,
        services: services.filter(s => s.isActive),
        staff: staffList,
        primaryColor: settings?.primaryColor || "#C4B5A0",
        slotIntervalMinutes: settings?.slotIntervalMinutes ?? 30,
        bookingAdvanceDays: settings?.bookingAdvanceDays ?? 60,
        bookingBufferMinutes: settings?.bookingBufferMinutes ?? 15,
        enableReferral: settings?.enableReferral ?? true,
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // スラッグ別空き枠
  app.get("/api/public/:slug/slots", async (req, res) => {
    try {
      const clinic = await storage.getClinicBySlug(req.params.slug);
      if (!clinic) return res.status(404).json({ message: "医院が見つかりません" });
      const { date, staffId, excludeAppointmentId, durationMinutes } = req.query as { date: string; staffId?: string; excludeAppointmentId?: string; durationMinutes?: string };
      if (!date) return res.status(400).json({ message: "date required" });
      const duration = parseInt(durationMinutes || "30") || 30;

      const [hours, holidays, appointments, settings] = await Promise.all([
        storage.getBusinessHours(clinic.id),
        storage.getHolidays(clinic.id),
        storage.getAppointments({ clinicId: clinic.id, date }),
        storage.getClinicSettings(clinic.id),
      ]);

      const fullDayHoliday = holidays.find(h => h.date === date && !h.startTime);
      const partialHolidays = holidays.filter(h => h.date === date && h.startTime && h.endTime);
      const isManualHoliday = !!fullDayHoliday;
      const isNationalHoliday = isJapaneseHoliday(date);
      const closedOnHolidays = settings?.closedOnHolidays !== false;
      const isHoliday = isManualHoliday || (isNationalHoliday && closedOnHolidays);
      const dayOfWeek = new Date(date + "T00:00:00").getDay();
      const dayHours = hours.find(h => h.dayOfWeek === dayOfWeek);

      if (isHoliday || !dayHours || dayHours.isClosed) {
        const reason = isNationalHoliday && closedOnHolidays ? getJapaneseHolidayName(date) : undefined;
        return res.json({ available: false, slots: [], reason: reason || "休診日" });
      }

      const maxConcurrent = settings?.allowDoubleBooking ? 9999 : (settings?.chairsCount ?? settings?.maxConcurrentAppointments ?? 1);
      const stepMins = settings?.slotIntervalMinutes ?? 15;
      const bufferMins = settings?.bookingBufferMinutes ?? 15;

      // 本日の場合、バッファー時間を考慮してカットオフ時刻を計算 (JST=UTC+9)
      const nowJST = new Date(Date.now() + 9 * 60 * 60 * 1000);
      const todayJST = nowJST.toISOString().slice(0, 10);
      const nowMinsJST = nowJST.getUTCHours() * 60 + nowJST.getUTCMinutes();
      const cutoffMins = date === todayJST ? nowMinsJST + bufferMins : -1;

      const timeToMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
      const minsToStr = (t: number) => `${Math.floor(t / 60).toString().padStart(2, "0")}:${(t % 60).toString().padStart(2, "0")}`;

      const buildSlots = (open: string, close: string): string[] => {
        const openTotal = timeToMins(open);
        const closeTotal = timeToMins(close);
        const result: string[] = [];
        for (let t = openTotal; t + duration <= closeTotal; t += stepMins) {
          if (t < cutoffMins) continue;
          result.push(minsToStr(t));
        }
        return result;
      };

      const morningOpen = dayHours.openTime ? dayHours.openTime.slice(0, 5) : null;
      const morningClose = dayHours.closeTime ? dayHours.closeTime.slice(0, 5) : null;
      const afOpen = dayHours.afternoonOpenTime ? dayHours.afternoonOpenTime.slice(0, 5) : null;
      const afClose = dayHours.afternoonCloseTime ? dayHours.afternoonCloseTime.slice(0, 5) : null;

      const morningSlots = morningOpen && morningClose ? buildSlots(morningOpen, morningClose) : [];
      const afternoonSlots = afOpen && afClose ? buildSlots(afOpen, afClose) : [];
      const allSlots = [...morningSlots, ...afternoonSlots];
      // スポット休診（時間帯指定）のスロットを除外
      const slots = partialHolidays.length > 0
        ? allSlots.filter(slot => {
            const slotMins = timeToMins(slot);
            return !partialHolidays.some(ph => {
              const phStart = timeToMins(ph.startTime!.slice(0, 5));
              const phEnd = timeToMins(ph.endTime!.slice(0, 5));
              return slotMins >= phStart && slotMins < phEnd;
            });
          })
        : allSlots;

      const activeAppts = appointments.filter(a => {
        if (a.status === "cancelled") return false;
        if (excludeAppointmentId && a.id === excludeAppointmentId) return false;
        return true;
      });

      const bookedTimes = activeAppts.map(a => a.startTime.slice(0, 5));
      const freeSlots = slots.filter(slot => {
        const slotStart = timeToMins(slot);
        const slotEnd = slotStart + duration;
        if (staffId) {
          const staffAppts = activeAppts.filter(a => !a.staffId || a.staffId === staffId);
          return !staffAppts.some(a => {
            const aStart = timeToMins(a.startTime.slice(0, 5));
            const aEnd = a.endTime ? timeToMins(a.endTime.slice(0, 5)) : aStart + 30;
            return aStart < slotEnd && aEnd > slotStart;
          });
        }
        const overlapping = activeAppts.filter(a => {
          const aStart = timeToMins(a.startTime.slice(0, 5));
          const aEnd = a.endTime ? timeToMins(a.endTime.slice(0, 5)) : aStart + 30;
          return aStart < slotEnd && aEnd > slotStart;
        });
        return overlapping.length < maxConcurrent;
      });

      res.json({ available: true, slots: freeSlots, bookedSlots: bookedTimes });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── Auto-assign staff & chair helper ─────────────────────────────────────
  async function autoAssignStaffAndChair(
    clinicId: string,
    patientId: string,
    date: string,
    startTime: string,
    endTime: string,
    explicitStaffId?: string | null
  ): Promise<{ staffId: string | null; chairNumber: number | null }> {
    let assignedStaffId: string | null = explicitStaffId || null;
    let assignedChairNumber: number | null = null;

    // ── Staff auto-assignment ──────────────────────────────────────────────
    if (!assignedStaffId) {
      const staffList = await storage.getStaff(clinicId);

      // 常勤スタッフを優先（非常勤・契約は後回し）
      const sortedStaff = [...staffList].sort((a, b) => {
        const priority = (s: typeof a) =>
          s.employmentType === "fulltime" || !s.employmentType ? 0 : 1;
        return priority(a) - priority(b);
      });

      if (sortedStaff.length === 1) {
        // 担当者が1人だけなら自動で割り当て
        assignedStaffId = sortedStaff[0].id;
      } else if (sortedStaff.length > 1) {
        // 複数いる場合、既存患者の前回担当を検索
        const prevAppts = await storage.getAppointments({ clinicId, patientId });
        const withStaff = prevAppts
          .filter(a => a.staffId && a.status !== "cancelled")
          .sort((a, b) => b.date !== a.date ? b.date.localeCompare(a.date) : b.startTime.localeCompare(a.startTime));
        if (withStaff.length > 0) {
          const lastStaffId = withStaff[0].staffId!;
          if (sortedStaff.some(s => s.id === lastStaffId)) {
            assignedStaffId = lastStaffId; // 前回と同じ担当者
          }
        }
        // 新患 + 複数スタッフ → 常勤スタッフが1人だけなら自動割り当て
        if (!assignedStaffId) {
          const fulltimeOnly = sortedStaff.filter(s => s.employmentType === "fulltime" || !s.employmentType);
          if (fulltimeOnly.length === 1) assignedStaffId = fulltimeOnly[0].id;
        }
      }
    }

    // ── Chair (ユニット) auto-assignment ───────────────────────────────────
    const settings = await storage.getClinicSettings(clinicId);
    const chairsCount = settings?.chairsCount ?? 1;

    if (chairsCount >= 1) {
      const dayAppts = await storage.getAppointments({ clinicId, date });
      const occupiedChairs = new Set<number>();
      for (const a of dayAppts) {
        if (a.chairNumber && a.status !== "cancelled") {
          if (a.startTime < endTime && (a.endTime || "23:59") > startTime) {
            occupiedChairs.add(a.chairNumber);
          }
        }
      }
      for (let chair = 1; chair <= chairsCount; chair++) {
        if (!occupiedChairs.has(chair)) {
          assignedChairNumber = chair;
          break;
        }
      }
    }

    return { staffId: assignedStaffId, chairNumber: assignedChairNumber };
  }

  // ─── Patient booking security check helper ────────────────────────────────
  async function checkPatientCanBook(patient: Patient, clinicId: string): Promise<{ allowed: boolean; message: string }> {
    const allAppts = await storage.getAppointments({ clinicId, patientId: patient.id });
    // Check active appointment count
    const active = allAppts.filter(a => a.status === "pending" || a.status === "confirmed");
    if (active.length >= MAX_ACTIVE_APPOINTMENTS_PER_PATIENT) {
      return { allowed: false, message: `現在 ${MAX_ACTIVE_APPOINTMENTS_PER_PATIENT} 件の予約が入っています。既存の予約をキャンセルしてから新規予約してください。` };
    }
    // Check recent cancellations (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentCancelled = allAppts.filter(a => {
      if (a.status !== "cancelled") return false;
      const ts = a.updatedAt ?? a.createdAt;
      return ts ? new Date(ts) >= thirtyDaysAgo : false;
    });
    if (recentCancelled.length >= MAX_CANCELLATIONS_PER_MONTH) {
      return { allowed: false, message: `直近30日間に ${MAX_CANCELLATIONS_PER_MONTH} 件以上キャンセルされたため、オンライン予約を一時的に制限しています。直接お電話ください。` };
    }
    return { allowed: true, message: "" };
  }

  // スラッグ別予約作成
  app.post("/api/public/:slug/book", async (req, res) => {
    try {
      const clinic = await storage.getClinicBySlug(req.params.slug);
      if (!clinic) return res.status(404).json({ message: "医院が見つかりません" });
      if (!clinic.isActive) return res.status(403).json({ message: "この医院は現在利用停止中です" });

      // Plan limit check: monthly appointments
      const planLimits = await getPlanLimitsFromDB(storage, clinic.planType || "free");
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      const monthAppts = await storage.getAppointments({ clinicId: clinic.id, startDate: monthStart, endDate: monthEnd });
      if (monthAppts.length >= planLimits.maxMonthlyAppointments) {
        return res.status(429).json({ message: "今月の予約受付上限に達しました。医院にお電話でご連絡ください。" });
      }

      const { patientName, patientPhone, date, startTime, treatmentType, notes, durationMinutes, serviceId, staffId } = req.body;
      if (!patientName || !patientPhone || !date || !startTime || !treatmentType) {
        return res.status(400).json({ message: "必須項目が不足しています" });
      }
      // Reject bookings for past dates (JST)
      const todayJST = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
      if (date < todayJST) {
        return res.status(400).json({ message: "過去の日付への予約はできません。" });
      }

      // ログイン済み患者はセッションのpatientIdを優先使用（登録情報を正確に反映するため）
      const sessionPatientId = (req.session as any).patientId;
      let patient = sessionPatientId
        ? await storage.getPatientById(sessionPatientId)
        : undefined;

      if (!patient) {
        patient = await storage.getPatientByPhone(patientPhone, clinic.id);
      }
      if (!patient) {
        patient = await storage.createPatient({ clinicId: clinic.id, name: patientName, phone: patientPhone });
      }

      // Security: check if patient is allowed to book
      const bookCheck = await checkPatientCanBook(patient, clinic.id);
      if (!bookCheck.allowed) return res.status(429).json({ message: bookCheck.message });

      const duration = durationMinutes || 30;
      const [h, m] = startTime.split(":").map(Number);
      const endTotal = h * 60 + m + duration;
      const endTime = `${Math.floor(endTotal / 60).toString().padStart(2, "0")}:${(endTotal % 60).toString().padStart(2, "0")}`;

      // 自動割り当て（スタッフ＋ユニット）
      const { staffId: autoStaffId, chairNumber: autoChairNumber } =
        await autoAssignStaffAndChair(clinic.id, patient.id, date, startTime, endTime, staffId);

      // Check requireAppointmentApproval setting
      const [clinicSettings, emailSettings] = await Promise.all([
        storage.getClinicSettings(clinic.id),
        storage.getReminderSettings(clinic.id),
      ]);
      const requireApproval = clinicSettings?.requireAppointmentApproval ?? false;
      const apptStatus = requireApproval ? "pending" : "confirmed";

      const appointment = await storage.createAppointment({
        clinicId: clinic.id,
        patientId: patient.id,
        date,
        startTime,
        endTime,
        treatmentType,
        notes: notes || null,
        status: apptStatus,
        confirmationStatus: apptStatus === "confirmed" ? "confirmed" : "pending",
        serviceId: serviceId || null,
        staffId: autoStaffId,
        chairNumber: autoChairNumber,
      });

      res.status(201).json({ appointment, patient: { id: patient.id, name: patient.name, phone: patient.phone }, requireApproval });

      // Send emails (non-blocking)
      const rk = emailSettings?.resendApiKey;
      if (patient.email) {
        if (requireApproval) {
          sendPendingBookingEmail(patient.email, patient.name, date, startTime, clinic.name, treatmentType, rk)
            .catch(err => console.error("Error sending pending booking email:", err));
        } else {
          sendBookingConfirmationEmail(patient.email, patient.name, date, startTime, clinic.name, treatmentType, rk)
            .catch(err => console.error("Error sending booking email:", err));
        }
      }
      // Notify admin (email + in-app)
      if (clinic.email) {
        sendNewBookingNotificationToAdmin(clinic.email, clinic.name, patient.name, patient.phone || "", date, startTime, treatmentType, rk)
          .catch(err => console.error("Error sending admin notification:", err));
      }
      storage.createAdminNotification({
        clinicId: clinic.id,
        type: "new_booking",
        title: "新規予約が入りました",
        body: `${patient.name}様 ${date} ${startTime.slice(0, 5)}〜 ${treatmentType}`,
        appointmentId: appointment.id,
      }).then(notif => pushNotificationToClinic(clinic.id, { type: "new_booking", notification: notif }))
        .catch(err => console.error("Error creating admin notification:", err));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── 患者向け公開API（デフォルト・後方互換） ─────────────────────────────

  app.get("/api/public/info", async (req, res) => {
    try {
      // Use patient's clinic if logged in as patient, otherwise default
      let clinicId = DEFAULT_CLINIC_ID;
      const patientId = (req.session as any).patientId;
      if (patientId) {
        const patient = await storage.getPatientById(patientId);
        if (patient?.clinicId) clinicId = patient.clinicId;
      }
      const [clinic, hours, holidays, services, staffList, settings] = await Promise.all([
        storage.getClinic(clinicId),
        storage.getBusinessHours(clinicId),
        storage.getHolidays(clinicId),
        storage.getServices(clinicId),
        storage.getStaff(clinicId),
        storage.getClinicSettings(clinicId),
      ]);
      res.json({ clinic, hours, holidays, services: services.filter(s => s.isActive), staff: staffList, enableReferral: settings?.enableReferral ?? true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/public/slots", async (req, res) => {
    try {
      const { date, staffId, excludeAppointmentId, durationMinutes } = req.query as { date: string; staffId?: string; excludeAppointmentId?: string; durationMinutes?: string };
      if (!date) return res.status(400).json({ message: "date required" });
      const duration = parseInt(durationMinutes || "30") || 30;

      const [hours, holidays, appointments, settings] = await Promise.all([
        storage.getBusinessHours(),
        storage.getHolidays(),
        storage.getAppointments({ date }),
        storage.getClinicSettings(),
      ]);

      const fullDayHoliday2 = holidays.find(h => h.date === date && !h.startTime);
      const partialHolidays2 = holidays.filter(h => h.date === date && h.startTime && h.endTime);
      const isManualHoliday = !!fullDayHoliday2;
      const isNationalHoliday = isJapaneseHoliday(date);
      const closedOnHolidays = settings?.closedOnHolidays !== false;
      const isHoliday = isManualHoliday || (isNationalHoliday && closedOnHolidays);
      const dayOfWeek = new Date(date + "T00:00:00").getDay();
      const dayHours = hours.find(h => h.dayOfWeek === dayOfWeek);

      if (isHoliday || !dayHours || dayHours.isClosed) {
        const reason = isNationalHoliday && closedOnHolidays ? getJapaneseHolidayName(date) : undefined;
        return res.json({ available: false, slots: [], reason: reason || "休診日" });
      }

      const maxConcurrent = settings?.allowDoubleBooking ? 9999 : (settings?.chairsCount ?? settings?.maxConcurrentAppointments ?? 1);
      const stepMins = settings?.slotIntervalMinutes ?? 15;
      const bufferMins = settings?.bookingBufferMinutes ?? 15;

      const nowJST = new Date(Date.now() + 9 * 60 * 60 * 1000);
      const todayJST = nowJST.toISOString().slice(0, 10);
      const nowMinsJST = nowJST.getUTCHours() * 60 + nowJST.getUTCMinutes();
      const cutoffMins = date === todayJST ? nowMinsJST + bufferMins : -1;

      const timeToMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
      const minsToStr2 = (t: number) => `${Math.floor(t / 60).toString().padStart(2, "0")}:${(t % 60).toString().padStart(2, "0")}`;

      const buildSlots2 = (open: string, close: string): string[] => {
        const openTotal = timeToMins(open);
        const closeTotal = timeToMins(close);
        const result: string[] = [];
        for (let t = openTotal; t + duration <= closeTotal; t += stepMins) {
          if (t < cutoffMins) continue;
          result.push(minsToStr2(t));
        }
        return result;
      };

      const morningOpen2 = dayHours.openTime ? dayHours.openTime.slice(0, 5) : null;
      const morningClose2 = dayHours.closeTime ? dayHours.closeTime.slice(0, 5) : null;
      const afOpen2 = dayHours.afternoonOpenTime ? dayHours.afternoonOpenTime.slice(0, 5) : null;
      const afClose2 = dayHours.afternoonCloseTime ? dayHours.afternoonCloseTime.slice(0, 5) : null;

      const morningSlots2 = morningOpen2 && morningClose2 ? buildSlots2(morningOpen2, morningClose2) : [];
      const afternoonSlots2 = afOpen2 && afClose2 ? buildSlots2(afOpen2, afClose2) : [];
      const allSlots2 = [...morningSlots2, ...afternoonSlots2];
      const slots = partialHolidays2.length > 0
        ? allSlots2.filter(slot => {
            const slotMins = timeToMins(slot);
            return !partialHolidays2.some(ph => {
              const phStart = timeToMins(ph.startTime!.slice(0, 5));
              const phEnd = timeToMins(ph.endTime!.slice(0, 5));
              return slotMins >= phStart && slotMins < phEnd;
            });
          })
        : allSlots2;

      const activeAppts = appointments.filter(a => {
        if (a.status === "cancelled") return false;
        if (excludeAppointmentId && a.id === excludeAppointmentId) return false;
        return true;
      });

      const bookedTimes = activeAppts.map(a => a.startTime.slice(0, 5));
      const freeSlots = slots.filter(slot => {
        const slotStart = timeToMins(slot);
        const slotEnd = slotStart + duration;
        if (staffId) {
          const staffAppts = activeAppts.filter(a => !a.staffId || a.staffId === staffId);
          return !staffAppts.some(a => {
            const aStart = timeToMins(a.startTime.slice(0, 5));
            const aEnd = a.endTime ? timeToMins(a.endTime.slice(0, 5)) : aStart + 30;
            return aStart < slotEnd && aEnd > slotStart;
          });
        }
        const overlapping = activeAppts.filter(a => {
          const aStart = timeToMins(a.startTime.slice(0, 5));
          const aEnd = a.endTime ? timeToMins(a.endTime.slice(0, 5)) : aStart + 30;
          return aStart < slotEnd && aEnd > slotStart;
        });
        return overlapping.length < maxConcurrent;
      });

      res.json({ available: true, slots: freeSlots, bookedSlots: bookedTimes });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/public/book", async (req, res) => {
    try {
      const { patientName, patientPhone, date, startTime, treatmentType, notes, durationMinutes, serviceId, staffId } = req.body;
      if (!patientName || !patientPhone || !date || !startTime || !treatmentType) {
        return res.status(400).json({ message: "必須項目が不足しています" });
      }
      // Reject bookings for past dates (JST)
      const todayJSTDef = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
      if (date < todayJSTDef) {
        return res.status(400).json({ message: "過去の日付への予約はできません。" });
      }

      const clinic = await storage.getClinic(DEFAULT_CLINIC_ID);
      if (!clinic) return res.status(404).json({ message: "医院が見つかりません" });

      // Plan limit check
      const planLimits = await getPlanLimitsFromDB(storage, clinic.planType || "free");
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      const monthAppts = await storage.getAppointments({ clinicId: DEFAULT_CLINIC_ID, startDate: monthStart, endDate: monthEnd });
      if (monthAppts.length >= planLimits.maxMonthlyAppointments) {
        return res.status(429).json({ message: "今月の予約受付上限に達しました。医院にお電話でご連絡ください。" });
      }

      let patient = await storage.getPatientByPhone(patientPhone);
      if (!patient) {
        patient = await storage.createPatient({ clinicId: DEFAULT_CLINIC_ID, name: patientName, phone: patientPhone });
      }

      // Security: check if patient is allowed to book
      const bookCheck2 = await checkPatientCanBook(patient, DEFAULT_CLINIC_ID);
      if (!bookCheck2.allowed) return res.status(429).json({ message: bookCheck2.message });

      const duration = durationMinutes || 30;
      const [h, m] = startTime.split(":").map(Number);
      const endTotal = h * 60 + m + duration;
      const endTime = `${Math.floor(endTotal / 60).toString().padStart(2, "0")}:${(endTotal % 60).toString().padStart(2, "0")}`;

      // 自動割り当て（スタッフ＋ユニット）
      const { staffId: autoStaffId2, chairNumber: autoChairNumber2 } =
        await autoAssignStaffAndChair(DEFAULT_CLINIC_ID, patient.id, date, startTime, endTime, staffId);

      const [clinicSettings2, emailSettings2] = await Promise.all([
        storage.getClinicSettings(DEFAULT_CLINIC_ID),
        storage.getReminderSettings(DEFAULT_CLINIC_ID),
      ]);
      const requireApproval = clinicSettings2?.requireAppointmentApproval ?? false;
      const apptStatus = requireApproval ? "pending" : "confirmed";

      const appointment = await storage.createAppointment({
        clinicId: DEFAULT_CLINIC_ID,
        patientId: patient.id,
        date,
        startTime,
        endTime,
        treatmentType,
        notes: notes || null,
        status: apptStatus,
        confirmationStatus: apptStatus === "confirmed" ? "confirmed" : "pending",
        serviceId: serviceId || null,
        staffId: autoStaffId2,
        chairNumber: autoChairNumber2,
      });

      res.status(201).json({ appointment, patient: { id: patient.id, name: patient.name, phone: patient.phone }, requireApproval });

      // Send emails (non-blocking)
      const rk2 = emailSettings2?.resendApiKey;
      if (patient.email) {
        if (requireApproval) {
          sendPendingBookingEmail(patient.email, patient.name, date, startTime, clinic.name, treatmentType, rk2)
            .catch(err => console.error("Error sending pending booking email:", err));
        } else {
          sendBookingConfirmationEmail(patient.email, patient.name, date, startTime, clinic.name, treatmentType, rk2)
            .catch(err => console.error("Error sending booking email:", err));
        }
      }
      if (clinic.email) {
        sendNewBookingNotificationToAdmin(clinic.email, clinic.name, patient.name, patient.phone || "", date, startTime, treatmentType, rk2)
          .catch(err => console.error("Error sending admin notification:", err));
      }
      storage.createAdminNotification({
        clinicId: clinic.id,
        type: "new_booking",
        title: "新規予約が入りました",
        body: `${patient.name}様 ${date} ${startTime.slice(0, 5)}〜 ${treatmentType}`,
        appointmentId: appointment.id,
      }).then(notif => pushNotificationToClinic(clinic.id, { type: "new_booking", notification: notif }))
        .catch(err => console.error("Error creating admin notification:", err));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/public/my-appointments", async (req, res) => {
    try {
      const { phone } = req.query as { phone: string };
      if (!phone) return res.status(400).json({ message: "phone required" });

      const patient = await storage.getPatientByPhone(phone);
      if (!patient) return res.json([]);

      const all = await storage.getAppointments();
      const mine = all.filter(a => a.patientId === patient.id);
      res.json(mine);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/public/cancel/:id", async (req, res) => {
    try {
      const { phone, cancellationReason } = req.body;
      if (!phone) return res.status(400).json({ message: "電話番号が必要です" });

      const appointment = await storage.getAppointmentById(req.params.id);
      if (!appointment) return res.status(404).json({ message: "予約が見つかりません" });

      const patient = await storage.getPatientByPhone(phone);
      if (!patient || appointment.patientId !== patient.id) {
        return res.status(403).json({ message: "この予約をキャンセルする権限がありません" });
      }

      await storage.updateAppointment(req.params.id, { status: "cancelled", cancellationReason: cancellationReason || null });
      res.json({ success: true });

      const clinic = await storage.getClinic(appointment.clinicId);
      const cSettings = await storage.getReminderSettings(appointment.clinicId);
      if (patient.email && clinic) {
        sendCancellationEmail(patient.email, patient.name, appointment.date, clinic.name, cSettings?.resendApiKey)
          .catch(err => console.error("Error sending cancellation email:", err));
      }
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── 患者アカウント認証API ────────────────────────────────────────────────

  app.get("/api/patient/me", async (req, res) => {
    const patientId = (req.session as any).patientId;
    if (!patientId) return res.json({ loggedIn: false });
    try {
      const patient = await storage.getPatientById(patientId);
      if (!patient) {
        delete (req.session as any).patientId;
        return res.json({ loggedIn: false });
      }
      const { password: _pw, ...safe } = patient as any;
      res.json({ loggedIn: true, patient: safe });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/patient/login", authLoginLimiter, async (req, res) => {
    try {
      const phone = sanitizeString(req.body.phone, INPUT_LIMITS.phone);
      const password = sanitizeString(req.body.password, INPUT_LIMITS.password);
      const clinicId = req.body.clinicId;
      const ip = getClientIp(req);
      if (!phone || !password) return res.status(400).json({ message: "電話番号とパスワードを入力してください" });
      const cid = clinicId || DEFAULT_CLINIC_ID;
      const patient = await storage.getPatientByPhone(phone, cid);
      if (!patient || !patient.password) {
        logSecurityEvent("patient_login_fail", ip, { reason: "not_found" });
        return res.status(401).json({ message: "電話番号またはパスワードが正しくありません" });
      }
      const ok = await comparePasswordsExport(password, patient.password);
      if (!ok) {
        logSecurityEvent("patient_login_fail", ip, { reason: "wrong_password", patientId: patient.id });
        return res.status(401).json({ message: "電話番号またはパスワードが正しくありません" });
      }
      (req.session as any).patientId = patient.id;
      logSecurityEvent("patient_login", ip, { patientId: patient.id });
      const { password: _pw, ...safe } = patient as any;
      res.json({ loggedIn: true, patient: safe });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/patient/logout", (req, res) => {
    delete (req.session as any).patientId;
    res.json({ success: true });
  });

  // 患者パスワードリセット（電話番号＋お名前で本人確認）
  app.post("/api/patient/reset-password", authResetLimiter, async (req, res) => {
    try {
      const phone = sanitizeString(req.body.phone, INPUT_LIMITS.phone);
      const name = sanitizeString(req.body.name, INPUT_LIMITS.name);
      const newPassword = sanitizeString(req.body.newPassword, INPUT_LIMITS.password);
      const clinicId = req.body.clinicId;
      const ip = getClientIp(req);
      if (!phone || !newPassword) return res.status(400).json({ message: "電話番号と新しいパスワードを入力してください" });
      if (!name) return res.status(400).json({ message: "お名前を入力してください" });
      const pwCheck = validatePassword(newPassword);
      if (!pwCheck.valid) return res.status(400).json({ message: pwCheck.message });
      const cid = clinicId || DEFAULT_CLINIC_ID;
      const patient = await storage.getPatientByPhone(phone, cid);
      if (!patient) {
        logSecurityEvent("password_reset_not_found", ip, { phone: phone.slice(0, 4) + "***" });
        return res.status(404).json({ message: "この電話番号のアカウントが見つかりません" });
      }
      if (!patient.password) return res.status(400).json({ message: "このアカウントはパスワードが設定されていません。新規登録してください。" });
      // 本人確認は完全一致で行う（全角/半角・空白の差は正規化して吸収するが、
      // 部分一致は認めない＝「山田」だけでのリセットを防ぐ）
      const normalizeName = (s: string) => s.normalize("NFKC").replace(/\s+/g, "");
      const inputName = normalizeName(name);
      const storedName = normalizeName(patient.name);
      if (inputName !== storedName) {
        logSecurityEvent("password_reset_name_mismatch", ip, { patientId: patient.id });
        return res.status(401).json({ message: "お名前が一致しません。登録時のお名前を入力してください。" });
      }
      const hashed = await hashPassword(newPassword);
      await storage.setPatientPassword(patient.id, hashed);
      logSecurityEvent("password_reset_success", ip, { patientId: patient.id });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/patient/register", authRegisterLimiter, async (req, res) => {
    try {
      const phone = sanitizeString(req.body.phone, INPUT_LIMITS.phone);
      const password = sanitizeString(req.body.password, INPUT_LIMITS.password);
      const name = sanitizeString(req.body.name, INPUT_LIMITS.name);
      const nameKana = sanitizeString(req.body.nameKana || "", INPUT_LIMITS.name);
      const email = sanitizeString(req.body.email, INPUT_LIMITS.email);
      const clinicId = req.body.clinicId;
      const referralCodeInput = sanitizeString(req.body.referralCode || "", 20);
      const ip = getClientIp(req);
      if (!phone || !password) return res.status(400).json({ message: "電話番号とパスワードを入力してください" });
      const pwCheck = validatePassword(password);
      if (!pwCheck.valid) return res.status(400).json({ message: pwCheck.message });
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: "有効なメールアドレスを入力してください" });
      }

      let referrer: Patient | undefined;
      if (referralCodeInput) {
        referrer = await storage.getPatientByReferralCode(referralCodeInput);
      }

      const cid = clinicId || DEFAULT_CLINIC_ID;
      let patient = await storage.getPatientByPhone(phone, cid);
      if (!patient) {
        if (!name) return res.status(400).json({ message: "初回登録にはお名前も必要です" });
        patient = await storage.createPatient({
          clinicId: cid, name, nameKana: nameKana || null, phone, email,
          referredBy: referrer ? referrer.referralCode : null,
        });
      } else {
        if (!patient.email && email) {
          await storage.updatePatient(patient.id, { email });
        }
      }
      if (patient.password) {
        return res.status(409).json({ message: "このアカウントは既に登録済みです。ログインしてください。" });
      }
      // Prevent self-referral: block if the referral code belongs to this very patient
      if (referrer && referrer.id === patient.id) {
        return res.status(400).json({ message: "自分自身の紹介コードは使用できません。" });
      }
      // Prevent duplicate referral credit: only count if patient wasn't already referred
      const shouldCredit = referrer && !patient.referredBy && referrer.id !== patient.id;
      const hashed = await hashPassword(password);
      await storage.setPatientPassword(patient.id, hashed);
      if (shouldCredit) {
        await storage.incrementReferralCount(referrer!.id);
      }
      (req.session as any).patientId = patient.id;
      logSecurityEvent("patient_register", ip, { patientId: patient.id });
      const { password: _pw, ...safe } = { ...patient, password: hashed } as any;
      res.status(201).json({ loggedIn: true, patient: safe });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/patient/appointments", async (req, res) => {
    const patientId = (req.session as any).patientId;
    if (!patientId) return res.status(401).json({ message: "ログインが必要です" });
    try {
      const patient = await storage.getPatientById(patientId);
      if (!patient) return res.status(401).json({ message: "ログインが必要です" });
      const all = await storage.getAppointments({ clinicId: patient.clinicId });
      const mine = all.filter(a => a.patientId === patientId);
      res.json(mine);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/patient/cancel/:id", async (req, res) => {
    const patientId = (req.session as any).patientId;
    if (!patientId) return res.status(401).json({ message: "ログインが必要です" });
    try {
      const { cancellationReason } = req.body;
      const appointment = await storage.getAppointmentById(req.params.id);
      if (!appointment) return res.status(404).json({ message: "予約が見つかりません" });
      if (appointment.patientId !== patientId) return res.status(403).json({ message: "権限がありません" });
      await storage.updateAppointment(req.params.id, { status: "cancelled", cancellationReason: cancellationReason || null });
      res.json({ success: true });

      const clinic = await storage.getClinic(appointment.clinicId);
      const patientObj = await storage.getPatientById(patientId);
      const pcSettings = await storage.getReminderSettings(appointment.clinicId);
      if (patientObj?.email && clinic) {
        sendCancellationEmail(patientObj.email, patientObj.name, appointment.date, clinic.name, pcSettings?.resendApiKey)
          .catch(err => console.error("Error sending cancellation email:", err));
      }
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.put("/api/patient/reschedule/:id", async (req, res) => {
    const patientId = (req.session as any).patientId;
    if (!patientId) return res.status(401).json({ message: "ログインが必要です" });
    try {
      const { date, startTime, durationMinutes } = req.body;
      if (!date || !startTime) return res.status(400).json({ message: "日付と時間は必須です" });
      // Reject reschedule to past dates (JST)
      const todayJSTReschedule = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
      if (date < todayJSTReschedule) {
        return res.status(400).json({ message: "過去の日付への変更はできません。" });
      }
      const appointment = await storage.getAppointmentById(req.params.id);
      if (!appointment) return res.status(404).json({ message: "予約が見つかりません" });
      if (appointment.patientId !== patientId) return res.status(403).json({ message: "権限がありません" });
      if (appointment.status === "cancelled") return res.status(400).json({ message: "キャンセル済みの予約は変更できません" });
      const duration = durationMinutes || 30;
      const [h, m] = startTime.split(":").map(Number);
      const endTotal = h * 60 + m + duration;
      const endTime = `${Math.floor(endTotal / 60).toString().padStart(2, "0")}:${(endTotal % 60).toString().padStart(2, "0")}`;
      const updated = await storage.updateAppointment(req.params.id, { date, startTime, endTime, confirmationStatus: "pending" });
      res.json({ success: true, appointment: updated });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.put("/api/patient/profile", async (req, res) => {
    const patientId = (req.session as any).patientId;
    if (!patientId) return res.status(401).json({ message: "ログインが必要です" });
    try {
      const { name, phone, dateOfBirth, gender } = req.body;
      if (!name || !phone) return res.status(400).json({ message: "お名前と電話番号は必須です" });
      const updated = await storage.updatePatient(patientId, { name, phone, dateOfBirth: dateOfBirth || null, gender: gender || null });
      if (!updated) return res.status(404).json({ message: "患者情報が見つかりません" });
      const { password: _pw, ...safe } = updated as any;
      res.json({ success: true, patient: safe });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── 保護ルート（認証必須） ────────────────────────────────────────────────
  // NOTE: This middleware provides a second layer. Public-facing sub-paths
  // (/auth/, /public/, /patient/, /clinics/, /demo/, /contact, /login,
  // /logout, /user, /holidays/japan/, /line/) are excluded.
  app.use("/api", (req, res, next) => {
    const p = req.path;
    if (
      p.startsWith("/auth/") ||
      p.startsWith("/public/") ||
      p.startsWith("/patient/") ||
      p.startsWith("/clinics/") ||
      p.startsWith("/demo/") ||
      p.startsWith("/holidays/japan/") ||
      p.startsWith("/line/") ||
      p.startsWith("/staff-auth/") ||
      p === "/staff/me" ||
      p === "/staff/session-logout" ||
      p === "/staff/my-appointments" ||
      p === "/staff/clinic-info" ||
      p.startsWith("/staff/appointments/") ||
      p === "/staff/all-today-appointments" ||
      p === "/staff/my-attendance" ||
      p === "/staff/my-attendance-history" ||
      p === "/staff/my-hourly-rate" ||
      p === "/staff/my-shifts" ||
      p === "/staff/clock-in" ||
      p === "/staff/clock-out" ||
      p === "/staff/cancel-clock-out" ||
      p === "/staff/break-start" ||
      p === "/staff/break-end" ||
      p.startsWith("/staff/my-attendance/") ||
      p === "/staff/qr-auto-clock" ||
      p === "/contact" ||
      p === "/login" ||
      p === "/logout" ||
      p === "/user"
    ) {
      return next();
    }
    requireAuth(req, res, next);
  });

  // Clinic
  app.get("/api/clinic", async (req: any, res) => {
    try {
      const clinic = await storage.getClinic(getAdminClinicId(req));
      res.json(clinic || null);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/my-plan", requireAuth, async (req: any, res) => {
    try {
      const clinicId = getAdminClinicId(req);
      const [clinic, staffList, clinicAddons] = await Promise.all([
        storage.getClinic(clinicId),
        storage.getStaff(clinicId),
        storage.getClinicAddons(clinicId),
      ]);
      const planType = clinic?.planType || "free";
      const limits = { ...await getPlanLimitsFromDB(storage, planType) };
      const addonKeys = new Set(clinicAddons.map(a => a.addonKey));
      if (addonKeys.has("recall")) limits.canRecall = true;
      if (addonKeys.has("line_reminder")) limits.canLine = true;
      if (addonKeys.has("report")) limits.canReport = true;
      res.json({ planType, limits, usage: { staffCount: staffList.length, monthlyAppointments: 0 } });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/my-addons", requireAuth, async (req: any, res) => {
    try {
      const clinicId = getAdminClinicId(req);
      const addons = await storage.getClinicAddons(clinicId);
      res.json({ addonKeys: addons.map(a => a.addonKey) });
    } catch (e: any) {
      console.error("[addon] getClinicAddons error:", e.message);
      res.status(500).json({ message: e.message });
    }
  });

  app.put("/api/clinic", async (req: any, res) => {
    try {
      const clinic = await storage.upsertClinic(req.body, getAdminClinicId(req));
      res.json(clinic);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── Staff Token Auth ──────────────────────────────────────────────
  // QRコード経由のスタッフログイン（セッション不要ルート）
  app.get("/api/staff-auth/:token", async (req: any, res) => {
    try {
      const member = await storage.getStaffByLoginToken(req.params.token);
      if (!member) return res.status(404).json({ message: "無効なQRコードです" });
      req.session.staffMemberId = member.id;
      req.session.staffClinicId = member.clinicId;
      req.session.save((err: any) => {
        if (err) return res.status(500).json({ message: "セッション保存エラー" });
        res.json({ id: member.id, name: member.name, role: member.role, clinicId: member.clinicId });
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // 現在のスタッフセッション確認
  app.get("/api/staff/me", async (req: any, res) => {
    const staffId = req.session?.staffMemberId;
    if (!staffId) return res.status(401).json({ message: "未ログイン" });
    try {
      const member = await storage.getStaffById(staffId);
      if (!member) return res.status(401).json({ message: "スタッフが見つかりません" });
      res.json({ id: member.id, name: member.name, role: member.role, clinicId: member.clinicId });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // スタッフセッションログアウト
  app.post("/api/staff/session-logout", (req: any, res) => {
    req.session.staffMemberId = undefined;
    req.session.staffClinicId = undefined;
    res.json({ success: true });
  });

  // スタッフのスケジュール取得（staffセッション用）
  app.get("/api/staff/my-appointments", async (req: any, res) => {
    const staffId = req.session?.staffMemberId;
    const clinicId = req.session?.staffClinicId;
    if (!staffId || !clinicId) return res.status(401).json({ message: "未ログイン" });
    try {
      const { startDate, endDate } = req.query;
      const appts = await storage.getAppointments({ clinicId, startDate: startDate as string, endDate: endDate as string });
      const mine = appts.filter(a => a.staffId === staffId);
      res.json(mine);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // クリニック情報（スタッフセッション用）
  app.get("/api/staff/clinic-info", async (req: any, res) => {
    const clinicId = req.session?.staffClinicId;
    if (!clinicId) return res.status(401).json({ message: "未ログイン" });
    try {
      const clinic = await storage.getClinic(clinicId);
      res.json(clinic);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // クリニック全体の本日予約（助手用）
  app.get("/api/staff/all-today-appointments", async (req: any, res) => {
    const clinicId = req.session?.staffClinicId;
    if (!clinicId) return res.status(401).json({ message: "未ログイン" });
    try {
      const today = new Date().toLocaleDateString("sv-SE"); // yyyy-MM-dd
      const appts = await storage.getAppointments({ clinicId, startDate: today, endDate: today });
      res.json(appts);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // 予約ステータス更新（スタッフセッション用）
  app.patch("/api/staff/appointments/:id/status", async (req: any, res) => {
    const staffId = req.session?.staffMemberId;
    const clinicId = req.session?.staffClinicId;
    if (!staffId || !clinicId) return res.status(401).json({ message: "未ログイン" });
    try {
      const { status } = req.body;
      const allowed = ["pending", "confirmed", "arrived", "in_progress", "completed", "cancelled", "no_show"];
      if (!allowed.includes(status)) return res.status(400).json({ message: "無効なステータス" });
      const appt = await storage.getAppointmentById(req.params.id);
      if (!appt || appt.clinicId !== clinicId) return res.status(404).json({ message: "予約が見つかりません" });
      const updated = await storage.updateAppointment(req.params.id, { status });
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // 予約メモ更新（スタッフセッション用）
  app.patch("/api/staff/appointments/:id/notes", async (req: any, res) => {
    const staffId = req.session?.staffMemberId;
    const clinicId = req.session?.staffClinicId;
    if (!staffId || !clinicId) return res.status(401).json({ message: "未ログイン" });
    try {
      const { notes } = req.body;
      const appt = await storage.getAppointmentById(req.params.id);
      if (!appt || appt.clinicId !== clinicId) return res.status(404).json({ message: "予約が見つかりません" });
      const updated = await storage.updateAppointment(req.params.id, { notes });
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // トークン生成（管理者のみ）
  app.post("/api/staff/:id/generate-token", async (req: any, res) => {
    try {
      const existing = await storage.getStaffById(req.params.id);
      if (!assertClinicOwnership(req, res, existing)) return;
      const token = crypto.randomBytes(24).toString("hex");
      const member = await storage.setStaffLoginToken(req.params.id, token);
      if (!member) return res.status(404).json({ message: "Not found" });
      res.json({ token, staffId: member.id, name: member.name });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // トークン削除（リセット）
  app.delete("/api/staff/:id/token", async (req: any, res) => {
    try {
      const existing = await storage.getStaffById(req.params.id);
      if (!assertClinicOwnership(req, res, existing)) return;
      await storage.setStaffLoginToken(req.params.id, null);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Staff
  app.get("/api/staff", async (req: any, res) => {
    try {
      const staffList = await storage.getStaff(getAdminClinicId(req));
      res.json(staffList);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/staff", async (req: any, res) => {
    try {
      const clinicId = getAdminClinicId(req);
      const clinic = await storage.getClinic(clinicId);
      const planLimits = await getPlanLimitsFromDB(storage, clinic?.planType || "free");
      const existingStaff = await storage.getStaff(clinicId);
      if (existingStaff.length >= planLimits.maxStaff) {
        return res.status(403).json({ message: `現在のプランでは最大${planLimits.maxStaff}名のスタッフまで登録できます。プランをアップグレードしてください。` });
      }
      const member = await storage.createStaff({ ...req.body, clinicId });
      res.status(201).json(member);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/staff/reorder", async (req: any, res) => {
    try {
      const clinicId = getAdminClinicId(req);
      const { orderedIds } = req.body;
      if (!Array.isArray(orderedIds)) return res.status(400).json({ message: "orderedIds must be an array" });
      await storage.reorderStaff(clinicId, orderedIds);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.put("/api/staff/my-hourly-rate", async (req: any, res) => {
    try {
      const staffMemberId = req.session?.staffMemberId;
      if (!staffMemberId) return res.status(401).json({ message: "未認証" });
      const { hourlyRate } = req.body;
      const rate = hourlyRate === null || hourlyRate === "" ? null : Number(hourlyRate);
      if (rate !== null && (isNaN(rate) || rate < 0)) return res.status(400).json({ message: "無効な時給です" });
      await storage.updateStaff(staffMemberId, { hourlyRate: rate });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.put("/api/staff/:id", async (req: any, res) => {
    try {
      const existing = await storage.getStaffById(req.params.id);
      if (!assertClinicOwnership(req, res, existing)) return;
      // PIN を更新する場合は 4桁の数字のみ許可（空文字/null はPIN解除として許可）
      if (req.body && req.body.pin != null && req.body.pin !== "" && !/^\d{4}$/.test(String(req.body.pin))) {
        return res.status(400).json({ message: "PINは4桁の数字で入力してください" });
      }
      const member = await storage.updateStaff(req.params.id, req.body);
      if (!member) return res.status(404).json({ message: "Not found" });
      res.json(member);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/staff/:id", async (req: any, res) => {
    try {
      const existing = await storage.getStaffById(req.params.id);
      if (!assertClinicOwnership(req, res, existing)) return;
      await storage.deleteStaff(req.params.id);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── Shifts ─────────────────────────────────────────────────────────
  // Admin: get all shifts for clinic (with month filter)
  app.get("/api/shifts", async (req: any, res) => {
    try {
      const clinicId = getAdminClinicId(req);
      const { staffId, month, startDate, endDate } = req.query as { staffId?: string; month?: string; startDate?: string; endDate?: string };
      const shifts = await storage.getShifts({ clinicId, staffId, month, startDate, endDate });
      res.json(shifts);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Staff: get my own shifts (via session token)
  app.get("/api/staff/my-shifts", async (req: any, res) => {
    try {
      const staffMemberId = req.session?.staffMemberId;
      if (!staffMemberId) return res.status(401).json({ message: "未認証" });
      const me = await storage.getStaffById(staffMemberId);
      if (!me) return res.status(404).json({ message: "Not found" });
      const { month } = req.query as { month?: string };
      const shifts = await storage.getShifts({ clinicId: me.clinicId, staffId: me.id, month });
      res.json(shifts);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Staff: submit shift request
  app.post("/api/staff/my-shifts", async (req: any, res) => {
    try {
      const staffMemberId = req.session?.staffMemberId;
      if (!staffMemberId) return res.status(401).json({ message: "未認証" });
      const me = await storage.getStaffById(staffMemberId);
      if (!me) return res.status(404).json({ message: "Not found" });
      const { dates, startTime, endTime, notes, patternId } = req.body;
      if (!Array.isArray(dates) || dates.length === 0) return res.status(400).json({ message: "日付を選択してください" });
      const created = await Promise.all(
        dates.map((date: string) =>
          storage.createShift({ clinicId: me.clinicId, staffId: me.id, date, startTime, endTime, notes, patternId: patternId || null, status: "requested" })
        )
      );
      res.json(created);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Staff: delete own shift request (only requested/rejected)
  app.delete("/api/staff/my-shifts/:id", async (req: any, res) => {
    try {
      const staffMemberId = req.session?.staffMemberId;
      if (!staffMemberId) return res.status(401).json({ message: "未認証" });
      const clinicId = req.session?.staffClinicId;
      const shift = await storage.getShiftById(req.params.id);
      if (!shift) return res.status(404).json({ message: "Not found" });
      if (shift.staffId !== staffMemberId || shift.clinicId !== clinicId) return res.status(403).json({ message: "権限がありません" });
      if (shift.status !== "requested" && shift.status !== "rejected") return res.status(400).json({ message: "確定済みのシフトは削除できません" });
      await storage.deleteShift(req.params.id);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Admin: update shift status (approve/reject/modify)
  app.put("/api/shifts/:id", async (req: any, res) => {
    try {
      const existingShift = await storage.getShiftById(req.params.id);
      if (!assertClinicOwnership(req, res, existingShift)) return;
      const { status, startTime, endTime, notes } = req.body;
      const updated = await storage.updateShift(req.params.id, {
        status,
        startTime,
        endTime,
        notes,
        reviewedAt: new Date(),
        reviewedBy: req.session?.username || "admin",
      });
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Admin: delete shift
  app.delete("/api/shifts/:id", async (req: any, res) => {
    try {
      const existingShift = await storage.getShiftById(req.params.id);
      if (!assertClinicOwnership(req, res, existingShift)) return;
      await storage.deleteShift(req.params.id);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Admin: directly create a shift (already approved)
  app.post("/api/shifts", async (req: any, res) => {
    try {
      const clinicId = getAdminClinicId(req);
      const { staffId, date, patternId, startTime, endTime, notes, status } = req.body;
      if (!staffId || !date) return res.status(400).json({ message: "staffId と date は必須です" });
      const shift = await storage.createShift({
        clinicId, staffId, date,
        patternId: patternId || null,
        startTime: startTime || null,
        endTime: endTime || null,
        notes: notes || null,
        status: status || "approved",
        reviewedAt: new Date(),
        reviewedBy: req.user?.username ?? "admin",
      });
      res.json(shift);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Shift Patterns (clinic-configured time slots)
  app.get("/api/shift-patterns", async (req: any, res) => {
    try {
      const clinicId = getAdminClinicId(req);
      const patterns = await storage.getShiftPatterns(clinicId);
      res.json(patterns);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Staff can also fetch shift patterns for their clinic
  app.get("/api/staff/shift-patterns", async (req: any, res) => {
    try {
      const staffMemberId = req.session?.staffMemberId;
      if (!staffMemberId) return res.status(401).json({ message: "Unauthorized" });
      const clinicId = req.session?.staffClinicId;
      if (!clinicId) return res.status(400).json({ message: "No clinic" });
      const patterns = await storage.getShiftPatterns(clinicId);
      res.json(patterns);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/shift-patterns", async (req: any, res) => {
    try {
      const clinicId = getAdminClinicId(req);
      const pattern = await storage.createShiftPattern({ ...req.body, clinicId });
      res.json(pattern);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.put("/api/shift-patterns/:id", async (req: any, res) => {
    try {
      const existingPattern = await storage.getShiftPatternById(req.params.id);
      if (!assertClinicOwnership(req, res, existingPattern)) return;
      const pattern = await storage.updateShiftPattern(req.params.id, req.body);
      if (!pattern) return res.status(404).json({ message: "Not found" });
      res.json(pattern);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/shift-patterns/:id", async (req: any, res) => {
    try {
      const existingPattern = await storage.getShiftPatternById(req.params.id);
      if (!assertClinicOwnership(req, res, existingPattern)) return;
      await storage.deleteShiftPattern(req.params.id);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Admin: batch approve all requested shifts for a month
  app.post("/api/shifts/batch-approve", async (req: any, res) => {
    try {
      const clinicId = getAdminClinicId(req);
      const { month } = req.body;
      const shifts = await storage.getShifts({ clinicId, month });
      const requested = shifts.filter(s => s.status === "requested");
      const updated = await Promise.all(
        requested.map(s => storage.updateShift(s.id, {
          status: "approved",
          reviewedAt: new Date(),
          reviewedBy: req.session?.username || "admin",
        }))
      );
      res.json({ approved: updated.length });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Admin: get appointment counts per staff per day for a month (conflict check)
  app.get("/api/shifts/appointment-counts", async (req: any, res) => {
    try {
      const clinicId = getAdminClinicId(req);
      const month = req.query.month as string;
      if (!month) return res.status(400).json({ message: "month is required" });
      const [year, m] = month.split("-").map(Number);
      const startDate = `${month}-01`;
      const lastDay = new Date(year, m, 0).getDate();
      const endDate = `${month}-${String(lastDay).padStart(2, "0")}`;
      const appointments = await storage.getAppointments({ clinicId, startDate, endDate });
      const counts: Record<string, number> = {};
      for (const a of appointments) {
        if (a.status === "cancelled") continue;
        const key = `${a.staffId}|${a.date}`;
        counts[key] = (counts[key] || 0) + 1;
      }
      res.json(counts);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Staff: get holidays for their clinic
  app.get("/api/staff/holidays", async (req: any, res) => {
    try {
      const staffMemberId = req.session?.staffMemberId;
      if (!staffMemberId) return res.status(401).json({ message: "未認証" });
      const clinicId = req.session?.staffClinicId;
      if (!clinicId) return res.status(400).json({ message: "No clinic" });
      const holidays = await storage.getHolidays(clinicId);
      res.json(holidays);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── Attendance (Staff clock-in/out) ─────────────────────────────────────────

  app.get("/api/staff/my-attendance", async (req: any, res) => {
    try {
      const staffMemberId = req.session?.staffMemberId;
      if (!staffMemberId) return res.status(401).json({ message: "未認証" });
      const today = new Date().toISOString().slice(0, 10);
      const record = await storage.getAttendanceByStaff(staffMemberId, today);
      res.json(record || null);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/staff/clock-in", async (req: any, res) => {
    try {
      const staffMemberId = req.session?.staffMemberId;
      if (!staffMemberId) return res.status(401).json({ message: "未認証" });
      const clinicId = req.session?.staffClinicId;
      if (!clinicId) return res.status(400).json({ message: "No clinic" });
      const { qrToken } = req.body || {};
      if (!qrToken) return res.status(400).json({ message: "QRコードをスキャンしてください" });
      const tokenClinicId = validateClockInToken(qrToken);
      if (!tokenClinicId) return res.status(400).json({ message: "QRコードが無効または期限切れです。再スキャンしてください" });
      if (tokenClinicId !== clinicId) return res.status(400).json({ message: "異なるクリニックのQRコードです" });
      const today = new Date().toISOString().slice(0, 10);
      const existing = await storage.getAttendanceByStaff(staffMemberId, today);
      if (existing) return res.status(400).json({ message: "本日は既に打刻済みです" });
      const record = await storage.clockIn({ clinicId, staffId: staffMemberId, date: today, clockIn: new Date() });
      pushAttendanceToClinic(clinicId, { type: "clock-in", record });
      res.json(record);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/public/qr-staff-list", async (req: any, res) => {
    try {
      const { qrToken } = req.body || {};
      if (!qrToken) return res.status(400).json({ message: "QRトークンが必要です" });
      const clinicId = validateClockInToken(qrToken);
      if (!clinicId) return res.status(400).json({ message: "QRコードが無効または期限切れです" });
      const allStaff = await storage.getStaff(clinicId);
      const today = new Date().toISOString().slice(0, 10);
      const todayRecords = await storage.getAttendanceByMonth(clinicId, today.slice(0, 7));
      const todayOnly = todayRecords.filter(r => r.date === today);
      const list = allStaff.filter(s => s.showInCalendar !== false).map(s => {
        const att = todayOnly.find(r => r.staffId === s.id);
        return {
          id: s.id, name: s.name, role: s.role, hasPin: !!s.pin,
          status: !att ? "not_clocked_in" : att.clockOut ? "clocked_out" : "clocked_in",
        };
      });
      res.json({ clinicId, staff: list });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/public/qr-clock-in", async (req: any, res) => {
    try {
      const { qrToken, staffId, pin } = req.body || {};
      if (!qrToken || !staffId) return res.status(400).json({ message: "不正なリクエストです" });
      const clinicId = validateClockInToken(qrToken);
      if (!clinicId) return res.status(400).json({ message: "QRコードが無効または期限切れです。再スキャンしてください" });
      const member = await storage.getStaffById(staffId);
      if (!member || member.clinicId !== clinicId) return res.status(400).json({ message: "スタッフが見つかりません" });
      if (member.pin) {
        const rlKey = `${clinicId}:${staffId}`;
        if (!pinRateLimitOk(rlKey)) return res.status(429).json({ message: "PINの試行回数が上限に達しました。しばらく経ってから再度お試しください" });
        if (!pin) return res.status(400).json({ message: "PINを入力してください" });
        if (!pinMatches(pin, member.pin)) {
          recordPinFailure(rlKey);
          logSecurityEvent("qr_pin_mismatch", getClientIp(req), { staffId, clinicId });
          return res.status(400).json({ message: "PINが正しくありません" });
        }
        clearPinAttempts(rlKey);
      }
      const today = new Date().toISOString().slice(0, 10);
      const existing = await storage.getAttendanceByStaff(staffId, today);
      if (existing) return res.status(400).json({ message: "本日は既に打刻済みです" });
      const record = await storage.clockIn({ clinicId, staffId, date: today, clockIn: new Date() });
      pushAttendanceToClinic(clinicId, { type: "clock-in", record });
      res.json({ success: true, staffName: member.name, record });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/public/qr-clock-out", async (req: any, res) => {
    try {
      const { qrToken, staffId, pin } = req.body || {};
      if (!qrToken || !staffId) return res.status(400).json({ message: "不正なリクエストです" });
      const clinicId = validateClockInToken(qrToken);
      if (!clinicId) return res.status(400).json({ message: "QRコードが無効または期限切れです。再スキャンしてください" });
      const member = await storage.getStaffById(staffId);
      if (!member || member.clinicId !== clinicId) return res.status(400).json({ message: "スタッフが見つかりません" });
      if (member.pin) {
        const rlKey = `${clinicId}:${staffId}`;
        if (!pinRateLimitOk(rlKey)) return res.status(429).json({ message: "PINの試行回数が上限に達しました。しばらく経ってから再度お試しください" });
        if (!pin) return res.status(400).json({ message: "PINを入力してください" });
        if (!pinMatches(pin, member.pin)) {
          recordPinFailure(rlKey);
          logSecurityEvent("qr_pin_mismatch", getClientIp(req), { staffId, clinicId });
          return res.status(400).json({ message: "PINが正しくありません" });
        }
        clearPinAttempts(rlKey);
      }
      const today = new Date().toISOString().slice(0, 10);
      const existing = await storage.getAttendanceByStaff(staffId, today);
      if (!existing || !existing.clockIn) return res.status(400).json({ message: "出勤打刻がありません" });
      if (existing.clockOut) return res.status(400).json({ message: "既に退勤済みです" });
      const record = await storage.clockOut(existing.id);
      pushAttendanceToClinic(clinicId, { type: "clock-out", record });
      res.json({ success: true, staffName: member.name, record });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/attendance/generate-qr", async (req: any, res) => {
    try {
      const clinicId = getAdminClinicId(req);
      const token = generateClockInToken(clinicId);
      res.json({ token, expiresAt: Date.now() + 60_000 });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/attendance/qr-token", async (req: any, res) => {
    try {
      const clinicId = getAdminClinicId(req);
      const token = generateClockInToken(clinicId);
      res.json({ token, expiresAt: Date.now() + 60_000 });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/staff/clock-out", async (req: any, res) => {
    try {
      const staffMemberId = req.session?.staffMemberId;
      if (!staffMemberId) return res.status(401).json({ message: "未認証" });
      const clinicId = req.session?.staffClinicId;
      const today = new Date().toISOString().slice(0, 10);
      const existing = await storage.getAttendanceByStaff(staffMemberId, today);
      if (!existing) return res.status(400).json({ message: "出勤打刻がありません" });
      if (existing.clockOut) return res.status(400).json({ message: "既に退勤済みです" });
      const record = await storage.clockOut(existing.id);
      pushAttendanceToClinic(clinicId!, { type: "clock-out", record });
      res.json(record);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/staff/cancel-clock-out", async (req: any, res) => {
    try {
      const staffMemberId = req.session?.staffMemberId;
      if (!staffMemberId) return res.status(401).json({ message: "未認証" });
      const clinicId = req.session?.staffClinicId;
      const today = new Date().toISOString().slice(0, 10);
      const existing = await storage.getAttendanceByStaff(staffMemberId, today);
      if (!existing || !existing.clockOut) return res.status(400).json({ message: "退勤打刻がありません" });
      const record = await storage.updateAttendance(existing.id, { clockOut: null });
      pushAttendanceToClinic(clinicId!, { type: "cancel-clock-out", record });
      res.json(record);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // QRスキャン時：ログイン済みスタッフの自動打刻
  app.post("/api/staff/qr-auto-clock", async (req: any, res) => {
    try {
      const staffMemberId = req.session?.staffMemberId;
      const staffClinicId = req.session?.staffClinicId;
      if (!staffMemberId || !staffClinicId) return res.status(401).json({ message: "未ログイン" });

      // QRトークンの検証（正しいクリニックのQRかチェック）
      const { qrToken } = req.body;
      if (qrToken) {
        const tokenData = clockInTokens.get(qrToken);
        if (!tokenData || Date.now() > tokenData.expiresAt) {
          return res.status(400).json({ message: "QRコードが期限切れです" });
        }
        if (tokenData.clinicId !== staffClinicId) {
          return res.status(403).json({ message: "このQRコードは別のクリニック用です" });
        }
      }

      const member = await storage.getStaffById(staffMemberId);
      if (!member) return res.status(404).json({ message: "スタッフが見つかりません" });

      const today = new Date().toISOString().slice(0, 10);
      const existing = await storage.getAttendanceByStaff(staffMemberId, today);
      const now = new Date();

      if (!existing || (!existing.clockIn && !existing.clockOut)) {
        // 未出勤 → 出勤
        const record = await storage.createAttendance({
          clinicId: staffClinicId,
          staffId: staffMemberId,
          date: today,
          clockIn: now,
        });
        pushAttendanceToClinic(staffClinicId, { type: "clock-in", record });
        return res.json({ action: "clock-in", staffName: member.name, time: now });
      } else if (existing.clockIn && !existing.clockOut) {
        // 出勤中 → 退勤
        const record = await storage.updateAttendance(existing.id, { clockOut: now });
        pushAttendanceToClinic(staffClinicId, { type: "clock-out", record });
        return res.json({ action: "clock-out", staffName: member.name, time: now });
      } else {
        return res.status(400).json({ message: "本日の打刻は完了しています" });
      }
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // スタッフ自身による打刻修正（自分のレコードのみ）
  app.put("/api/staff/my-attendance/:id", async (req: any, res) => {
    try {
      const staffMemberId = req.session?.staffMemberId;
      if (!staffMemberId) return res.status(401).json({ message: "未認証" });
      const existing = await storage.getAttendanceById(req.params.id);
      if (!existing) return res.status(404).json({ message: "Not found" });
      if (existing.staffId !== staffMemberId) return res.status(403).json({ message: "権限がありません" });
      const { clockIn, clockOut, breakStart, breakEnd } = req.body;
      const dateBase = existing.date; // "yyyy-MM-dd"
      const toISO = (timeStr: string | null) => {
        if (!timeStr) return null;
        return new Date(`${dateBase}T${timeStr}:00`);
      };
      const updateData: any = {};
      if (clockIn !== undefined) updateData.clockIn = toISO(clockIn);
      if (clockOut !== undefined) updateData.clockOut = toISO(clockOut);
      if (breakStart !== undefined) updateData.breakStart = toISO(breakStart);
      if (breakEnd !== undefined) updateData.breakEnd = toISO(breakEnd);
      const record = await storage.updateAttendance(req.params.id, updateData);
      if (!record) return res.status(404).json({ message: "Not found" });
      res.json(record);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/staff/break-start", async (req: any, res) => {
    try {
      const staffMemberId = req.session?.staffMemberId;
      if (!staffMemberId) return res.status(401).json({ message: "未認証" });
      const clinicId = req.session?.staffClinicId;
      const today = new Date().toISOString().slice(0, 10);
      const existing = await storage.getAttendanceByStaff(staffMemberId, today);
      if (!existing || existing.clockOut) return res.status(400).json({ message: "出勤中ではありません" });
      const record = await storage.startBreak(existing.id);
      pushAttendanceToClinic(clinicId!, { type: "break-start", record });
      res.json(record);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/staff/break-end", async (req: any, res) => {
    try {
      const staffMemberId = req.session?.staffMemberId;
      if (!staffMemberId) return res.status(401).json({ message: "未認証" });
      const clinicId = req.session?.staffClinicId;
      const today = new Date().toISOString().slice(0, 10);
      const existing = await storage.getAttendanceByStaff(staffMemberId, today);
      if (!existing || !existing.breakStart) return res.status(400).json({ message: "休憩中ではありません" });
      const record = await storage.endBreak(existing.id);
      pushAttendanceToClinic(clinicId!, { type: "break-end", record });
      res.json(record);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/attendance/today", async (req: any, res) => {
    try {
      const clinicId = getAdminClinicId(req);
      const records = await storage.getAttendanceToday(clinicId);
      res.json(records);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/attendance/stream", (req: any, res) => {
    const clinicId = getAdminClinicId(req);
    if (!clinicId) return res.status(401).json({ message: "Unauthorized" });
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);
    if (!attendanceClients.has(clinicId)) attendanceClients.set(clinicId, new Set());
    attendanceClients.get(clinicId)!.add(res);
    const heartbeat = setInterval(() => { try { res.write(": heartbeat\n\n"); } catch {} }, 25000);
    req.on("close", () => {
      clearInterval(heartbeat);
      attendanceClients.get(clinicId)?.delete(res);
    });
  });

  // Admin: edit attendance record
  app.put("/api/attendance/:id", async (req: any, res) => {
    try {
      const clinicId = getAdminClinicId(req);
      const existing = await storage.getAttendanceById(req.params.id);
      if (!existing) return res.status(404).json({ message: "Not found" });
      if (existing.clinicId !== clinicId) return res.status(403).json({ message: "権限がありません" });
      const { clockIn, clockOut, breakStart, breakEnd, notes } = req.body;
      const updateData: any = {};
      if (clockIn !== undefined) updateData.clockIn = clockIn ? new Date(clockIn) : null;
      if (clockOut !== undefined) updateData.clockOut = clockOut ? new Date(clockOut) : null;
      if (breakStart !== undefined) updateData.breakStart = breakStart ? new Date(breakStart) : null;
      if (breakEnd !== undefined) updateData.breakEnd = breakEnd ? new Date(breakEnd) : null;
      if (notes !== undefined) updateData.notes = notes;
      const record = await storage.updateAttendance(req.params.id, updateData);
      if (!record) return res.status(404).json({ message: "Not found" });
      pushAttendanceToClinic(clinicId, { type: "edit", record });
      res.json(record);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Admin: monthly attendance report
  app.get("/api/attendance/monthly", async (req: any, res) => {
    try {
      const clinicId = getAdminClinicId(req);
      const month = req.query.month as string;
      if (!month) return res.status(400).json({ message: "month is required" });
      const records = await storage.getAttendanceByMonth(clinicId, month);
      const staffList = await storage.getStaff(clinicId);
      res.json({ records, staff: staffList });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Staff: my attendance history
  app.get("/api/staff/my-attendance-history", async (req: any, res) => {
    try {
      const staffMemberId = req.session?.staffMemberId;
      if (!staffMemberId) return res.status(401).json({ message: "未認証" });
      const clinicId = req.session?.staffClinicId;
      if (!clinicId) return res.status(400).json({ message: "No clinic" });
      const month = req.query.month as string;
      if (!month) return res.status(400).json({ message: "month is required" });
      const allRecords = await storage.getAttendanceByMonth(clinicId, month);
      const myRecords = allRecords.filter(r => r.staffId === staffMemberId);
      const me = await storage.getStaffById(staffMemberId);
      res.json({ records: myRecords, hourlyRate: me?.hourlyRate || null });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Patients
  app.get("/api/patients", async (req: any, res) => {
    try {
      const search = req.query.search as string | undefined;
      const patients = await storage.getPatients(getAdminClinicId(req), search);
      res.json(patients);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/patients/:id", async (req, res) => {
    try {
      const patient = await storage.getPatientById(req.params.id);
      if (!assertClinicOwnership(req, res, patient)) return;
      res.json(patient);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // 空文字をnullに変換（date型などのカラムへの空文字列挿入を防ぐ）
  function sanitizePatientBody(body: Record<string, any>) {
    const dateFields = ["dateOfBirth"];
    const result = { ...body };
    for (const f of dateFields) {
      if (result[f] === "" || result[f] === undefined) result[f] = null;
    }
    for (const key of Object.keys(result)) {
      if (result[key] === "") result[key] = null;
    }
    return result;
  }

  app.post("/api/patients", async (req: any, res) => {
    try {
      const patient = await storage.createPatient({ ...sanitizePatientBody(req.body), clinicId: getAdminClinicId(req) } as any);
      res.status(201).json(patient);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.put("/api/patients/:id", async (req, res) => {
    try {
      const existing = await storage.getPatientById(req.params.id);
      if (!assertClinicOwnership(req, res, existing)) return;
      const patient = await storage.updatePatient(req.params.id, sanitizePatientBody(req.body) as any);
      if (!patient) return res.status(404).json({ message: "Not found" });
      res.json(patient);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/patients/:id", async (req, res) => {
    try {
      const existing = await storage.getPatientById(req.params.id);
      if (!assertClinicOwnership(req, res, existing)) return;
      await storage.deletePatient(req.params.id);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Services
  app.get("/api/services", async (req: any, res) => {
    try {
      const services = await storage.getServices(getAdminClinicId(req));
      res.json(services);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/services", async (req: any, res) => {
    try {
      const service = await storage.createService({ ...req.body, clinicId: getAdminClinicId(req) });
      res.status(201).json(service);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.put("/api/services/:id", async (req, res) => {
    try {
      const existing = await storage.getServiceById(req.params.id);
      if (!assertClinicOwnership(req, res, existing)) return;
      const service = await storage.updateService(req.params.id, req.body);
      if (!service) return res.status(404).json({ message: "Not found" });
      res.json(service);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/services/:id", async (req, res) => {
    try {
      const existing = await storage.getServiceById(req.params.id);
      if (!assertClinicOwnership(req, res, existing)) return;
      await storage.deleteService(req.params.id);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Appointments
  // 終了時刻を過ぎた confirmed 予約を自動で completed に変更
  async function autoCompleteAppointments(clinicId: string) {
    try {
      const nowJST = new Date(Date.now() + 9 * 60 * 60 * 1000);
      const todayJST = nowJST.toISOString().slice(0, 10);
      const currentTimeJST = nowJST.toISOString().slice(11, 19);
      const all = await storage.getAppointments({ clinicId });
      const toComplete = all.filter(a => {
        if (a.status !== "confirmed") return false;
        if (a.date < todayJST) return true;
        if (a.date === todayJST && a.endTime && a.endTime <= currentTimeJST) return true;
        return false;
      });
      await Promise.all(toComplete.map(a => storage.updateAppointment(a.id, { status: "completed" })));
    } catch (e) { console.error("autoCompleteAppointments error:", e); }
  }

  app.get("/api/appointments", async (req: any, res) => {
    try {
      const clinicId = getAdminClinicId(req);
      await autoCompleteAppointments(clinicId);
      const { date, startDate, endDate } = req.query as Record<string, string>;
      const appointments = await storage.getAppointments({ clinicId, date, startDate, endDate });
      res.json(appointments);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── Admin Notifications ──────────────────────────────────────────────────────
  app.get("/api/notifications/stream", (req: any, res) => {
    const clinicId = getAdminClinicId(req);
    if (!clinicId) return res.status(401).json({ message: "Unauthorized" });
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);
    if (!notificationClients.has(clinicId)) notificationClients.set(clinicId, new Set());
    notificationClients.get(clinicId)!.add(res);
    const heartbeat = setInterval(() => { try { res.write(": heartbeat\n\n"); } catch {} }, 25000);
    req.on("close", () => {
      clearInterval(heartbeat);
      notificationClients.get(clinicId)?.delete(res);
    });
  });

  app.get("/api/notifications", async (req: any, res) => {
    try {
      const clinicId = getAdminClinicId(req);
      const notifications = await storage.getAdminNotifications(clinicId, 30);
      res.json(notifications);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/notifications/unread-count", async (req: any, res) => {
    try {
      const clinicId = getAdminClinicId(req);
      const count = await storage.getUnreadNotificationCount(clinicId);
      res.json({ count });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.put("/api/notifications/read-all", async (req: any, res) => {
    try {
      const clinicId = getAdminClinicId(req);
      await storage.markAllNotificationsRead(clinicId);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/appointments/pending-count", async (req: any, res) => {
    try {
      const clinicId = getAdminClinicId(req);
      await autoCompleteAppointments(clinicId);
      const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const appointments = await storage.getAppointments({ clinicId });
      const count = appointments.filter(a =>
        a.date === today &&
        a.status !== "cancelled" &&
        a.status !== "completed"
      ).length;
      res.json({ count });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/appointments/:id", async (req: any, res) => {
    try {
      const appt = await storage.getAppointmentById(req.params.id);
      if (!assertClinicOwnership(req, res, appt)) return;
      res.json(appt);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/appointments", async (req: any, res) => {
    try {
      const body = { ...req.body, clinicId: getAdminClinicId(req) };
      if (!body.staffId) body.staffId = null;
      if (!body.serviceId) body.serviceId = null;
      if (body.staffId && body.date && body.startTime && body.endTime) {
        const conflict = await storage.checkStaffConflict({ clinicId: body.clinicId, date: body.date, startTime: body.startTime, endTime: body.endTime, staffId: body.staffId });
        if (conflict) return res.status(409).json({ message: "その担当者はその時間帯に既に別の予約があります" });
      }
      const appt = await storage.createAppointment(body);
      res.status(201).json(appt);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.put("/api/appointments/:id", async (req: any, res) => {
    try {
      const prevAppt = await storage.getAppointmentById(req.params.id);
      if (!assertClinicOwnership(req, res, prevAppt)) return;
      // 楽観的ロック: クライアントが知っているupdatedAtと現在のDBの値を比較
      if (req.body._updatedAt && prevAppt.updatedAt) {
        const clientTs = new Date(req.body._updatedAt).getTime();
        const serverTs = new Date(prevAppt.updatedAt).getTime();
        if (Math.abs(clientTs - serverTs) > 1000) {
          return res.status(409).json({ code: "concurrent_edit", message: "別のスタッフがこの予約を更新しました。最新の内容を確認してください。" });
        }
      }
      const body = { ...req.body };
      delete body._updatedAt;
      delete body.id;
      delete body.clinicId;
      delete body.createdAt;
      delete body.updatedAt;
      if (!body.staffId) body.staffId = null;
      if (!body.serviceId) body.serviceId = null;
      if (body.staffId && body.date && body.startTime && body.endTime) {
        const conflict = await storage.checkStaffConflict({ clinicId: prevAppt.clinicId, date: body.date, startTime: body.startTime, endTime: body.endTime, staffId: body.staffId, excludeId: req.params.id });
        if (conflict) return res.status(409).json({ message: "その担当者はその時間帯に既に別の予約があります" });
      }
      const appt = await storage.updateAppointment(req.params.id, body);
      if (!appt) return res.status(404).json({ message: "Not found" });
      res.json(appt);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/appointments/:id", async (req, res) => {
    try {
      const existing = await storage.getAppointmentById(req.params.id);
      if (!assertClinicOwnership(req, res, existing)) return;
      await storage.deleteAppointment(req.params.id);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Medical Records
  app.get("/api/medical-records", async (req: any, res) => {
    try {
      const records = await storage.getMedicalRecords(getAdminClinicId(req));
      res.json(records);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/medical-records", async (req: any, res) => {
    try {
      const body = { ...req.body, clinicId: getAdminClinicId(req) };
      if (body.staffId === "" || body.staffId === undefined) body.staffId = null;
      if (body.patientId === "" || body.patientId === undefined) body.patientId = null;
      const record = await storage.createMedicalRecord(body);
      res.status(201).json(record);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/medical-records/:id", requireAuth, async (req: any, res) => {
    try {
      const record = await storage.getMedicalRecordById(req.params.id);
      if (!assertClinicOwnership(req, res, record)) return;
      await storage.deleteMedicalRecord(req.params.id);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Business Hours
  app.get("/api/business-hours", async (req: any, res) => {
    try {
      const hours = await storage.getBusinessHours(getAdminClinicId(req));
      res.json(hours);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.put("/api/business-hours", async (req: any, res) => {
    try {
      await storage.upsertBusinessHours(req.body, getAdminClinicId(req));
      const hours = await storage.getBusinessHours(getAdminClinicId(req));
      res.json(hours);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Holidays
  app.get("/api/holidays", async (req: any, res) => {
    try {
      const holidays = await storage.getHolidays(getAdminClinicId(req));
      res.json(holidays);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/holidays", async (req: any, res) => {
    try {
      const holiday = await storage.createHoliday({ ...req.body, clinicId: getAdminClinicId(req) });
      res.status(201).json(holiday);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/holidays/:id", async (req, res) => {
    try {
      const existing = await storage.getHolidayById(req.params.id);
      if (!assertClinicOwnership(req, res, existing)) return;
      await storage.deleteHoliday(req.params.id);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/holidays/japan/:year", async (req, res) => {
    try {
      const year = parseInt(req.params.year);
      if (isNaN(year) || year < 1970 || year > 2100) return res.status(400).json({ message: "Invalid year" });
      const response = await fetch("https://holidays-jp.github.io/api/v1/date.json");
      if (!response.ok) throw new Error("Failed to fetch Japanese holidays");
      const all: Record<string, string> = await response.json();
      const holidays = Object.entries(all)
        .filter(([date]) => date.startsWith(`${year}-`))
        .map(([date, name]) => ({ date, name, reason: "国民の祝日" }));
      res.json(holidays);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/holidays/batch", async (req: any, res) => {
    try {
      const { holidays } = req.body as { holidays: { date: string; name?: string; reason?: string }[] };
      if (!Array.isArray(holidays)) return res.status(400).json({ message: "holidays array required" });
      const count = await storage.createHolidayBatch(holidays, getAdminClinicId(req));
      res.json({ inserted: count, total: holidays.length });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // iCal subscription feed
  app.get("/api/calendar.ics", async (req: any, res) => {
    try {
      const clinicId = getAdminClinicId(req);
      const [appointments, clinic] = await Promise.all([
        storage.getAppointments({ clinicId }),
        storage.getClinic(clinicId),
      ]);

      const clinicName = clinic?.name || "Arche";
      const now = new Date();
      const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z/, "Z");

      const toICalDT = (dateStr: string, timeStr: string) => {
        const d = dateStr.replace(/-/g, "");
        const t = timeStr.replace(/:/g, "").substring(0, 6);
        return `${d}T${t}`;
      };

      const escapeIcal = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

      const events = appointments.map(a => {
        const patient = (a as any).patient;
        const staff = (a as any).staff;
        const patientName = patient?.name || "患者";
        const summary = `${patientName} - ${a.treatmentType || "診療"}`;
        const descParts = [];
        if (staff?.name) descParts.push(`担当: ${staff.name}`);
        if (a.status) descParts.push(`状態: ${a.status}`);
        if (a.notes) descParts.push(`メモ: ${a.notes}`);
        const description = descParts.join("\\n");

        return [
          "BEGIN:VEVENT",
          `UID:arche-${a.id}@arche`,
          `DTSTAMP:${stamp}`,
          `DTSTART;TZID=Asia/Tokyo:${toICalDT(a.date, a.startTime)}`,
          `DTEND;TZID=Asia/Tokyo:${toICalDT(a.date, a.endTime)}`,
          `SUMMARY:${escapeIcal(summary)}`,
          description ? `DESCRIPTION:${description}` : null,
          "END:VEVENT",
        ].filter(Boolean).join("\r\n");
      });

      const ical = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Arche//Arche//JA",
        `X-WR-CALNAME:${escapeIcal(clinicName)}`,
        "X-WR-CALDESC:診療予約カレンダー",
        "X-WR-TIMEZONE:Asia/Tokyo",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VTIMEZONE",
        "TZID:Asia/Tokyo",
        "BEGIN:STANDARD",
        "DTSTART:19700101T000000",
        "TZOFFSETFROM:+0900",
        "TZOFFSETTO:+0900",
        "TZNAME:JST",
        "END:STANDARD",
        "END:VTIMEZONE",
        ...events,
        "END:VCALENDAR",
      ].join("\r\n");

      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(clinicName)}.ics"`);
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.send(ical);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Clinic Settings
  app.get("/api/clinic-settings", async (req: any, res) => {
    try {
      const settings = await storage.getClinicSettings(getAdminClinicId(req));
      res.json(settings || null);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.put("/api/clinic-settings", async (req: any, res) => {
    try {
      const { chairsCount, bookingAdvanceDays, bookingBufferMinutes, slotIntervalMinutes,
              maxConcurrentAppointments, allowDoubleBooking, enablePatientConfirmation,
              confirmationDeadlineHours, enableQrCheckin, primaryColor,
              requireAppointmentApproval, closedOnHolidays, resendApiKey, enableReferral } = req.body;
      const settings = await storage.upsertClinicSettings(
        { chairsCount, bookingAdvanceDays, bookingBufferMinutes, slotIntervalMinutes,
          maxConcurrentAppointments, allowDoubleBooking, enablePatientConfirmation,
          confirmationDeadlineHours, enableQrCheckin, primaryColor,
          requireAppointmentApproval, closedOnHolidays, resendApiKey,
          enableReferral: enableReferral ?? true },
        getAdminClinicId(req)
      );
      res.json(settings);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Reminder Settings
  app.get("/api/reminder-settings", async (req: any, res) => {
    try {
      const settings = await storage.getReminderSettings(getAdminClinicId(req));
      if (!settings) return res.json(null);
      // シークレットは実値を返さずマスクする
      res.json({
        ...settings,
        lineChannelAccessToken: maskSecret(settings.lineChannelAccessToken),
        lineChannelSecret: maskSecret(settings.lineChannelSecret),
        resendApiKey: maskSecret(settings.resendApiKey),
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.put("/api/reminder-settings", async (req: any, res) => {
    try {
      const clinicId = getAdminClinicId(req);
      const {
        enableEmail, enableSms, enableLine, reminderHoursBefore,
        lineChannelAccessToken, lineChannelSecret, resendApiKey, autoReminderEnabled, reminderSendTime,
      } = req.body;
      // マスク値/未送信のシークレットは既存値を保持する
      const prev = await storage.getReminderSettings(clinicId);
      const settings = await storage.upsertReminderSettings({
        enableEmail, enableSms, enableLine, reminderHoursBefore,
        lineChannelAccessToken: resolveSecret(lineChannelAccessToken, prev?.lineChannelAccessToken),
        lineChannelSecret: resolveSecret(lineChannelSecret, prev?.lineChannelSecret),
        resendApiKey: resolveSecret(resendApiKey, prev?.resendApiKey),
        autoReminderEnabled, reminderSendTime,
      }, clinicId);
      // 応答でも実値を返さない
      res.json({
        ...settings,
        lineChannelAccessToken: maskSecret(settings.lineChannelAccessToken),
        lineChannelSecret: maskSecret(settings.lineChannelSecret),
        resendApiKey: maskSecret(settings.resendApiKey),
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/reminder-settings/test", async (req: any, res) => {
    try {
      const clinicId = getAdminClinicId(req);
      const clinic = await storage.getClinic(clinicId);
      if (!clinic || !clinic.email) {
        return res.status(400).json({ message: "クリニックのメールアドレスが設定されていません" });
      }
      const testSettings = await storage.getReminderSettings(clinicId);
      await sendTestEmail(clinic.email, clinic.name, testSettings?.resendApiKey);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Manual trigger for daily reminders (admin only)
  app.post("/api/reminder-settings/trigger-now", requireAuth, async (req: any, res) => {
    try {
      await runDailyReminders();
      res.json({ success: true, message: "リマインダーを手動送信しました" });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // LINE webhook - receives LINE events (follow, message) from LINE platform
  app.post("/api/line/:slug/webhook", async (req: any, res) => {
    try {
      const { slug } = req.params;
      const clinic = await storage.getClinicBySlug(slug);
      if (!clinic) return res.status(404).json({ message: "クリニックが見つかりません" });

      const settings = await storage.getReminderSettings(clinic.id);
      if (!settings?.lineChannelSecret) return res.status(400).json({ message: "LINE設定がありません" });

      // Verify signature
      const signature = req.headers["x-line-signature"] as string;
      if (signature) {
        const hmac = crypto.createHmac("sha256", settings.lineChannelSecret);
        hmac.update(JSON.stringify(req.body));
        const digest = hmac.digest("base64");
        if (digest !== signature) {
          return res.status(401).json({ message: "Invalid signature" });
        }
      }

      const events = req.body.events || [];
      for (const event of events) {
        if (event.type === "follow" && event.source?.userId) {
          // New follower - store LINE user ID
          // We match by profile reply; for now store as anonymous until patient links account
          console.log(`[LINE Webhook] New follower: ${event.source.userId} for clinic ${clinic.id}`);
          // Could send welcome message
          if (settings.lineChannelAccessToken) {
            await sendLineMessage(
              settings.lineChannelAccessToken,
              event.source.userId,
              `${clinic.name}のLINE公式アカウントをご登録いただきありがとうございます。\n予約リマインダーなどのお知らせをお送りします。`
            );
          }
        }
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Public: save LINE User ID from booking page (patient session)
  app.post("/api/booking/:slug/line-user-id", async (req: any, res) => {
    try {
      const { slug } = req.params;
      const { lineUserId } = req.body;
      if (!lineUserId) return res.status(400).json({ message: "lineUserId is required" });
      const clinic = await storage.getClinicBySlug(slug);
      if (!clinic) return res.status(404).json({ message: "クリニックが見つかりません" });
      const patientSession = req.session?.patientId;
      if (!patientSession) return res.status(401).json({ message: "ログインが必要です" });
      await storage.updatePatient(patientSession, { lineUserId });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // LINE webhook verification (GET request from LINE)
  app.get("/api/line/:slug/webhook", async (req: any, res) => {
    res.json({ status: "ok" });
  });

  // Update patient LINE user ID (admin)
  app.put("/api/patients/:id/line-user-id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { lineUserId } = req.body;
      const existing = await storage.getPatientById(id);
      if (!assertClinicOwnership(req, res, existing)) return;
      const updated = await storage.updatePatient(id, { lineUserId });
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Reports
  app.get("/api/reports", async (req: any, res) => {
    try {
      const clinicId = getAdminClinicId(req);
      const appointments = await storage.getAppointments({ clinicId });
      const patients = await storage.getPatients(clinicId);
      const staff = await storage.getStaff(clinicId);
      const services = await storage.getServices(clinicId);

      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      const parseDate = (d: string) => new Date(d);

      const thisMonthAppts = appointments.filter(a => {
        const d = parseDate(a.date);
        return d >= thisMonthStart && d <= thisMonthEnd;
      });
      const lastMonthAppts = appointments.filter(a => {
        const d = parseDate(a.date);
        return d >= lastMonthStart && d <= lastMonthEnd;
      });

      const cancelledThis = thisMonthAppts.filter(a => a.status === "cancelled").length;
      const noShowThis = thisMonthAppts.filter(a => a.status === "no_show").length;
      const completedThis = thisMonthAppts.filter(a => a.status === "completed").length;
      const cancelledLast = lastMonthAppts.filter(a => a.status === "cancelled").length;

      const treatmentTypeCounts: Record<string, number> = {};
      thisMonthAppts.forEach(a => {
        if (a.treatmentType) {
          treatmentTypeCounts[a.treatmentType] = (treatmentTypeCounts[a.treatmentType] || 0) + 1;
        }
      });
      const total = thisMonthAppts.length || 1;
      const treatmentTypeStats = Object.entries(treatmentTypeCounts).map(([type, count]) => ({
        type, count, percentage: Math.round((count / total) * 100),
      }));

      const timeSlotCounts: Record<string, number> = {};
      thisMonthAppts.forEach(a => {
        const hour = a.startTime.split(":")[0];
        const slot = `${hour}:00`;
        timeSlotCounts[slot] = (timeSlotCounts[slot] || 0) + 1;
      });
      const maxSlot = Math.max(...Object.values(timeSlotCounts), 1);
      const timeSlotStats = Object.entries(timeSlotCounts).sort().map(([time, count]) => ({
        time, count, percentage: Math.round((count / maxSlot) * 100),
      }));

      const staffCapacity = staff.map(s => {
        const booked = thisMonthAppts.filter(a => a.staffId === s.id).length;
        const capacity = 22 * 8;
        return { staff: s.name, capacity, booked, percentage: Math.round((booked / capacity) * 100) };
      });


      // 過去6ヶ月のトレンドデータ
      const monthlyTrend = Array.from({ length: 6 }, (_, i) => {
        const monthOffset = 5 - i;
        const start = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
        const end = new Date(now.getFullYear(), now.getMonth() - monthOffset + 1, 0);
        const label = `${start.getMonth() + 1}月`;
        const appts = appointments.filter(a => { const d = parseDate(a.date); return d >= start && d <= end; });
        const newPts = patients.filter(p => { const d = parseDate(p.createdAt!.toString()); return d >= start && d <= end; }).length;
        const completed = appts.filter(a => a.status === "completed").length;
        return {
          label,
          appointments: appts.length,
          newPatients: newPts,
          revenue: completed * 5000,
          cancellations: appts.filter(a => a.status === "cancelled").length,
        };
      });

      res.json({
        thisMonth: {
          totalAppointments: thisMonthAppts.length,
          newPatients: patients.filter(p => {
            const d = parseDate(p.createdAt!.toString());
            return d >= thisMonthStart && d <= thisMonthEnd;
          }).length,
          revenue: completedThis * 5000,
          cancellationRate: Math.round((cancelledThis / (thisMonthAppts.length || 1)) * 100),
          cancelledCount: cancelledThis,
          noShowCount: noShowThis,
          completedCount: completedThis,
        },
        lastMonth: {
          totalAppointments: lastMonthAppts.length,
          newPatients: patients.filter(p => {
            const d = parseDate(p.createdAt!.toString());
            return d >= lastMonthStart && d <= lastMonthEnd;
          }).length,
          revenue: lastMonthAppts.filter(a => a.status === "completed").length * 5000,
          cancellationRate: Math.round((cancelledLast / (lastMonthAppts.length || 1)) * 100),
        },
        staffCapacity,
        treatmentTypeStats,
        timeSlotStats,
        monthlyTrend,
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Plan info endpoint
  app.get("/api/plan-info", async (req: any, res) => {
    try {
      const clinicId = getAdminClinicId(req);
      const clinic = await storage.getClinic(clinicId);
      const planLimits = await getPlanLimitsFromDB(storage, clinic?.planType || "free");
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      const [staff, monthAppts] = await Promise.all([
        storage.getStaff(clinicId),
        storage.getAppointments({ clinicId, startDate: monthStart, endDate: monthEnd }),
      ]);
      res.json({
        planType: clinic?.planType || "free",
        limits: planLimits,
        usage: {
          staffCount: staff.length,
          monthlyAppointments: monthAppts.length,
        },
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Export Data
  app.get("/api/export/patients.csv", async (req: any, res) => {
    try {
      const clinicId = getAdminClinicId(req);
      const clinic = await storage.getClinic(clinicId);
      const planLimits = await getPlanLimitsFromDB(storage, clinic?.planType || "free");
      if (!planLimits.canExport) {
        return res.status(403).json({ message: "データエクスポートはスターター以上のプランで利用できます。" });
      }
      const patients = await storage.getPatients(clinicId);
      const BOM = "\uFEFF";
      const header = ["患者番号", "氏名", "ふりがな", "生年月日", "性別", "電話", "メール", "住所", "アレルギー", "備考", "キャンセル数", "無断キャンセル数", "最終来院日", "登録日"].join(",");
      const rows = patients.map(p => [
        p.patientNumber || "",
        `"${(p.name || "").replace(/"/g, '""')}"`,
        `"${(p.nameKana || "").replace(/"/g, '""')}"`,
        p.dateOfBirth || "",
        p.gender || "",
        p.phone || "",
        p.email || "",
        `"${(p.address || "").replace(/"/g, '""')}"`,
        `"${(p.allergies || "").replace(/"/g, '""')}"`,
        `"${(p.medicalNotes || "").replace(/"/g, '""')}"`,
        p.cancellationCount || 0,
        p.noShowCount || 0,
        p.lastVisitDate || "",
        p.createdAt ? new Date(p.createdAt).toLocaleDateString("ja-JP") : ""
      ].join(","));

      const csv = BOM + [header, ...rows].join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=\"patients.csv\"");
      res.send(csv);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/export/appointments.csv", async (req: any, res) => {
    try {
      const clinicId = getAdminClinicId(req);
      const clinic = await storage.getClinic(clinicId);
      const planLimitsExport = await getPlanLimitsFromDB(storage, clinic?.planType || "free");
      if (!planLimitsExport.canExport) {
        return res.status(403).json({ message: "データエクスポートはスターター以上のプランで利用できます。" });
      }
      const appointments = await storage.getAppointments({ clinicId });
      const BOM = "\uFEFF";
      const header = ["日付", "開始時間", "終了時間", "患者名", "担当スタッフ", "診療メニュー", "治療種別", "ステータス", "確認状況", "チェア番号", "メモ", "作成日"].join(",");
      const rows = appointments.map(a => {
        const patientName = (a as any).patient?.name || "";
        const staffName = (a as any).staff?.name || "";
        return [
          a.date,
          a.startTime,
          a.endTime,
          `"${patientName.replace(/"/g, '""')}"`,
          `"${staffName.replace(/"/g, '""')}"`,
          "",
          `"${(a.treatmentType || "").replace(/"/g, '""')}"`,
          a.status || "",
          a.confirmationStatus || "",
          a.chairNumber || "",
          `"${(a.notes || "").replace(/"/g, '""')}"`,
          a.createdAt ? new Date(a.createdAt).toLocaleDateString("ja-JP") : ""
        ].join(",");
      });

      const csv = BOM + [header, ...rows].join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=\"appointments.csv\"");
      res.send(csv);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Account settings
  app.put("/api/account/password", async (req: any, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "現在のパスワードと新しいパスワードを入力してください" });
      }
      const pwCheck = validatePassword(newPassword);
      if (!pwCheck.valid) return res.status(400).json({ message: pwCheck.message });
      
      const user = await storage.getUser(req.user.id);
      if (!user) return res.status(404).json({ message: "ユーザーが見つかりません" });

      const { scrypt, timingSafeEqual } = await import("crypto");
      const { promisify } = await import("util");
      const scryptAsync = promisify(scrypt);
      const [hashed, salt] = user.password.split(".");
      const hashedBuf = Buffer.from(hashed, "hex");
      const suppliedBuf = (await scryptAsync(currentPassword, salt, 64)) as Buffer;
      const match = timingSafeEqual(hashedBuf, suppliedBuf);
      if (!match) return res.status(400).json({ message: "現在のパスワードが正しくありません" });

      const hashedNew = await hashPassword(newPassword);
      await storage.updateUser(user.id, { password: hashedNew });
      res.json({ message: "パスワードを変更しました" });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.put("/api/account/username", async (req: any, res) => {
    try {
      const { newUsername } = req.body;
      if (!newUsername || newUsername.trim().length < 2) {
        return res.status(400).json({ message: "ユーザー名は2文字以上で入力してください" });
      }
      const existing = await storage.getUserByUsername(newUsername.trim());
      if (existing && existing.id !== req.user.id) {
        return res.status(400).json({ message: "そのユーザー名はすでに使用されています" });
      }
      const updated = await storage.updateUser(req.user.id, { username: newUsername.trim() });
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── Recall ──────────────────────────────────────────────────────────────────
  app.get("/api/recall", async (req: any, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: "認証が必要です" });
      const patients = await storage.getRecallPatients(getAdminClinicId(req));
      res.json(patients);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.put("/api/patients/:id/recall", async (req: any, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: "認証が必要です" });
      const { nextRecallDate, recallIntervalMonths } = req.body;
      const patient = await storage.updatePatientRecall(req.params.id, { nextRecallDate, recallIntervalMonths }, getAdminClinicId(req));
      if (!patient) return res.status(404).json({ message: "患者が見つかりません" });
      res.json(patient);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/recall/:id/send", async (req: any, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: "認証が必要です" });
      const patient = await storage.markRecallSent(req.params.id, getAdminClinicId(req));
      if (!patient) return res.status(404).json({ message: "患者が見つかりません" });
      try {
        const { sendRecallEmail } = await import("./email.js");
        const recallClinicId = getAdminClinicId(req);
        const clinic = await storage.getClinic(recallClinicId);
        const recallSettings = await storage.getReminderSettings(recallClinicId);
        if (patient.email && clinic) {
          await sendRecallEmail(patient.email, patient.name, clinic.name, clinic.phone || "", recallSettings?.resendApiKey);
        }
      } catch { /* email service not configured */ }
      res.json({ message: "リコール通知を送信しました", patient });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/recall/send-bulk", async (req: any, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: "認証が必要です" });
      const clinicId = getAdminClinicId(req);
      const patients = await storage.getRecallPatients(clinicId);
      const unsent = patients.filter(p => !p.lastRecallSentAt);
      const { sendRecallEmail } = await import("./email.js");
      const clinic = await storage.getClinic(clinicId);
      const recallSettings = await storage.getReminderSettings(clinicId);
      let sentCount = 0;
      for (const patient of unsent) {
        await storage.markRecallSent(patient.id, clinicId);
        try {
          if (patient.email && clinic) {
            await sendRecallEmail(patient.email, patient.name, clinic.name, clinic.phone || "", recallSettings?.resendApiKey);
          }
        } catch { /* email not configured */ }
        sentCount++;
      }
      res.json({ message: `${sentCount}件のリコール通知を送信しました`, sentCount });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── Questionnaires ──────────────────────────────────────────────────────────
  app.post("/api/public/questionnaire", async (req: any, res) => {
    try {
      const q = await storage.createQuestionnaire({ ...req.body, clinicId: DEFAULT_CLINIC_ID });
      res.json(q);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/public/:slug/questionnaire", async (req: any, res) => {
    try {
      const clinic = await storage.getClinicBySlug(req.params.slug);
      if (!clinic) return res.status(404).json({ message: "医院が見つかりません" });
      const q = await storage.createQuestionnaire({ ...req.body, clinicId: clinic.id });
      res.json(q);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/questionnaires", async (req: any, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: "認証が必要です" });
      const list = await storage.getQuestionnaires(getAdminClinicId(req));
      res.json(list);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/questionnaires/by-appointment/:appointmentId", async (req: any, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: "認証が必要です" });
      const q = await storage.getQuestionnaireByAppointment(req.params.appointmentId);
      // 他院の問診票を返さない
      if (q && (q as any).clinicId && (q as any).clinicId !== getAdminClinicId(req)) return res.json(null);
      res.json(q || null);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  return httpServer;
}
