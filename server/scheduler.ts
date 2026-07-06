import { storage } from "./storage.js";
import { sendReminderEmail, sendGenericEmail } from "./email.js";
import { sendLineMessage, buildReminderMessage } from "./line.js";
import { sendSms, buildSmsReminderMessage } from "./sms.js";
import { getPlanLimitsFromDB } from "./plans.js";

// 医院の実効プラン上限（アドオン解放を含む）を取得する。
async function getClinicLimits(clinicId: string) {
  const clinic = await storage.getClinic(clinicId);
  const limits = { ...await getPlanLimitsFromDB(storage, clinic?.planType || "free") };
  try {
    const addons = await storage.getClinicAddons(clinicId);
    const keys = new Set(addons.map((a: any) => a.addonKey));
    if (keys.has("line_reminder")) limits.canLine = true;
    if (keys.has("sms")) limits.canSms = true;
  } catch { /* アドオン取得失敗時はプラン素の値 */ }
  return limits;
}

let schedulerTimer: NodeJS.Timeout | null = null;

function getTomorrowDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getTodayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDateStrDaysAhead(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateJP(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`;
}

async function runRemindersForClinic(clinic: { id: string; name: string }, reminderCfg: any): Promise<void> {
  const today = getTodayDateStr();
  // 設定「◯時間前」を日数に換算して対象日を決定（24h→翌日, 48h→2日後, ...）
  const hoursBefore = Number(reminderCfg.reminderHoursBefore) || 24;
  const daysAhead = Math.max(1, Math.round(hoursBefore / 24));
  const targetDate = getDateStrDaysAhead(daysAhead);

  // プラン制限: 使えない通知チャネルはスケジューラからも送らない（多層防御）
  const limits = await getClinicLimits(clinic.id);
  const allowEmail = reminderCfg.enableEmail && limits.canEmail;
  const allowLine = reminderCfg.enableLine && limits.canLine;
  const allowSms = reminderCfg.enableSms && limits.canSms;

  const appointments = await storage.getAppointments({
    clinicId: clinic.id,
    startDate: targetDate,
    endDate: targetDate,
  });

  let sent = 0;
  for (const appt of appointments) {
    if (appt.status === "cancelled" || appt.status === "no_show") continue;
    const patient = (appt as any).patient;
    if (!patient) continue;

    const dateStr = formatDateJP(appt.date);
    const timeStr = appt.startTime?.slice(0, 5) || "";

    if (allowEmail && patient.email) {
      try {
        await sendReminderEmail(patient.email, patient.name, dateStr, timeStr, clinic.name, reminderCfg.resendApiKey, reminderCfg.resendFromEmail);
        sent++;
      } catch (e) {
        console.error(`[Scheduler] Email to ${patient.email} failed:`, e);
      }
    }

    if (allowLine && reminderCfg.lineChannelAccessToken && patient.lineUserId) {
      try {
        const msg = buildReminderMessage(patient.name, clinic.name, dateStr, timeStr);
        await sendLineMessage(reminderCfg.lineChannelAccessToken, patient.lineUserId, msg);
        sent++;
      } catch (e) {
        console.error(`[Scheduler] LINE to ${patient.lineUserId} failed:`, e);
      }
    }

    if (allowSms && patient.phone) {
      try {
        const msg = buildSmsReminderMessage(patient.name, clinic.name, dateStr, timeStr);
        await sendSms(patient.phone, msg, {
          accountSid: reminderCfg.twilioAccountSid,
          authToken: reminderCfg.twilioAuthToken,
          fromNumber: reminderCfg.twilioFromNumber,
        });
        sent++;
      } catch (e) {
        console.error(`[Scheduler] SMS to ${patient.phone} failed:`, e);
      }
    }
  }

  // Persist that we ran today for this clinic
  await storage.upsertReminderSettings({ lastReminderRunDate: today }, clinic.id);

  if (sent > 0 || appointments.length > 0) {
    console.log(`[Scheduler] Sent ${sent} reminders for clinic "${clinic.name}" (target: ${targetDate}, ${hoursBefore}h前設定)`);
  }
}

// runDailyReminders: used for manual/forced runs (e.g. from admin API).
// Runs all clinics that have autoReminderEnabled and haven't run today.
export async function runDailyReminders(): Promise<void> {
  const today = getTodayDateStr();
  try {
    const clinics = await storage.getAllClinics();
    for (const clinic of clinics) {
      try {
        const reminderCfg = await storage.getReminderSettings(clinic.id);
        if (!reminderCfg?.autoReminderEnabled) continue;

        // DB-backed deduplication: skip if already sent today for this clinic
        if (reminderCfg.lastReminderRunDate === today) {
          console.log(`[Scheduler] Already sent reminders today for clinic "${clinic.name}"`);
          continue;
        }

        await runRemindersForClinic(clinic, reminderCfg);
      } catch (e) {
        console.error(`[Scheduler] Error processing clinic ${clinic.id}:`, e);
      }
    }
  } catch (e) {
    console.error("[Scheduler] Fatal error:", e);
  }
}

function getCurrentTimeHHMM(): string {
  // Use JST (UTC+9) for consistent Japan-time scheduling
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

// checkAndRunReminders: runs every minute and checks each clinic independently.
// Each clinic fires at its own configured sendTime, not all at once.
async function checkAndRunReminders(): Promise<void> {
  const currentTime = getCurrentTimeHHMM();
  const today = getTodayDateStr();
  try {
    const clinics = await storage.getAllClinics();
    for (const clinic of clinics) {
      try {
        const cfg = await storage.getReminderSettings(clinic.id);
        if (!cfg?.autoReminderEnabled) continue;
        const sendTime = cfg.reminderSendTime || "09:00";
        if (currentTime !== sendTime) continue;
        // Already sent today for this clinic — skip
        if (cfg.lastReminderRunDate === today) continue;

        await runRemindersForClinic(clinic, cfg);
      } catch (e) {
        console.error(`[Scheduler] Error checking clinic ${clinic.id}:`, e);
      }
    }
  } catch {
    // Ignore fatal errors in scheduler loop
  }
}

// 機能1: 送信予約キュー（フォローアップ/リコール）の処理。
// scheduledFor が現在時刻を過ぎた pending メッセージを送信する。
const clinicReminderCfgCache = new Map<string, any>();
async function processScheduledMessages(): Promise<void> {
  try {
    const due = await storage.getDueScheduledMessages(new Date());
    if (due.length === 0) return;
    clinicReminderCfgCache.clear();

    for (const msg of due) {
      try {
        const patient = msg.patientId ? await storage.getPatientById(msg.patientId) : null;
        if (!patient) {
          await storage.updateScheduledMessage(msg.id, { status: "failed", error: "患者が見つかりません" });
          continue;
        }

        // 医院のチャネル設定/認証情報を取得（キャッシュ）
        let cfg = clinicReminderCfgCache.get(msg.clinicId);
        if (cfg === undefined) {
          cfg = await storage.getReminderSettings(msg.clinicId);
          clinicReminderCfgCache.set(msg.clinicId, cfg);
        }
        const limits = await getClinicLimits(msg.clinicId);

        let delivered = false;
        if (msg.channel === "line" && patient.lineUserId && cfg?.lineChannelAccessToken && cfg?.enableLine && limits.canLine) {
          await sendLineMessage(cfg.lineChannelAccessToken, patient.lineUserId, msg.message);
          delivered = true;
        } else if (patient.email && limits.canEmail) {
          // LINE不可でもメールにフォールバック
          const subject = msg.purpose === "recall" ? "定期検診のご案内" : "ご来院後のご連絡";
          await sendGenericEmail(patient.email, subject, msg.message, cfg?.resendApiKey, cfg?.resendFromEmail);
          delivered = true;
        }

        if (delivered) {
          await storage.updateScheduledMessage(msg.id, { status: "sent", sentAt: new Date(), error: null });
        } else {
          await storage.updateScheduledMessage(msg.id, { status: "failed", error: "送信可能なチャネルがありません（LINE未連携かつメール未登録）" });
        }
      } catch (e: any) {
        await storage.updateScheduledMessage(msg.id, { status: "failed", error: String(e?.message || e) });
      }
    }
    console.log(`[Scheduler] Processed ${due.length} scheduled follow-up message(s).`);
  } catch (e) {
    console.error("[Scheduler] processScheduledMessages error:", e);
  }
}

// 患者確認の期限切れ自動キャンセル。
// enablePatientConfirmation が有効な医院で、confirmationStatus が pending のまま
// 予約時刻まで confirmationDeadlineHours を切った予約を自動キャンセルする。
async function autoCancelUnconfirmed(): Promise<void> {
  try {
    const clinics = await storage.getAllClinics();
    const nowMs = Date.now();
    for (const clinic of clinics) {
      try {
        const settings = await storage.getClinicSettings(clinic.id);
        if (!settings?.enablePatientConfirmation) continue;
        const deadlineH = settings.confirmationDeadlineHours ?? 24;

        // 今日以降の予約のみ対象
        const todayJST = new Date(nowMs + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const appts = await storage.getAppointments({ clinicId: clinic.id, startDate: todayJST });
        for (const a of appts) {
          if (a.status !== "confirmed" && a.status !== "pending") continue;
          if (a.confirmationStatus === "confirmed") continue;
          if (!a.date || !a.startTime) continue;
          // 予約開始時刻（JST）をUTC msに換算
          const apptJst = new Date(`${a.date}T${a.startTime}`).getTime();
          const apptUtcMs = apptJst - 9 * 60 * 60 * 1000;
          const hoursUntil = (apptUtcMs - nowMs) / (60 * 60 * 1000);
          // 期限を切った & まだ未来の予約（過去はautoComplete等に任せる）
          if (hoursUntil <= deadlineH && hoursUntil > 0) {
            await storage.updateAppointment(a.id, {
              status: "cancelled",
              cancellationReason: "確認期限切れによる自動キャンセル",
            });
            await storage.cancelPendingMessagesForAppointment(a.id);
            try {
              await storage.createAdminNotification({
                clinicId: clinic.id,
                type: "auto_cancel",
                title: "予約を自動キャンセルしました",
                body: `${a.date} ${a.startTime?.slice(0,5)} の予約が確認期限切れのため自動キャンセルされました。`,
                appointmentId: a.id,
              });
            } catch { /* 通知失敗は無視 */ }
          }
        }
      } catch (e) {
        console.error(`[Scheduler] autoCancel error for clinic ${clinic.id}:`, e);
      }
    }
  } catch (e) {
    console.error("[Scheduler] autoCancelUnconfirmed fatal:", e);
  }
}

async function tick(): Promise<void> {
  await checkAndRunReminders();
  await processScheduledMessages();
  await autoCancelUnconfirmed();
}

export function startScheduler(): void {
  if (schedulerTimer) return;
  schedulerTimer = setInterval(tick, 60 * 1000);
  console.log("[Scheduler] Started. Checking every minute for reminders & follow-ups.");
}

export function stopScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}
