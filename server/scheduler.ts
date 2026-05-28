import { storage } from "./storage.js";
import { sendReminderEmail } from "./email.js";
import { sendLineMessage, buildReminderMessage } from "./line.js";
import { sendSms, buildSmsReminderMessage } from "./sms.js";

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

function formatDateJP(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`;
}

async function runRemindersForClinic(clinic: { id: string; name: string }, reminderCfg: any): Promise<void> {
  const today = getTodayDateStr();
  const tomorrowDate = getTomorrowDateStr();

  const appointments = await storage.getAppointments({
    clinicId: clinic.id,
    startDate: tomorrowDate,
    endDate: tomorrowDate,
  });

  let sent = 0;
  for (const appt of appointments) {
    if (appt.status === "cancelled" || appt.status === "no_show") continue;
    const patient = (appt as any).patient;
    if (!patient) continue;

    const dateStr = formatDateJP(appt.date);
    const timeStr = appt.startTime?.slice(0, 5) || "";

    if (reminderCfg.enableEmail && patient.email) {
      try {
        await sendReminderEmail(patient.email, patient.name, dateStr, timeStr, clinic.name, reminderCfg.resendApiKey);
        sent++;
      } catch (e) {
        console.error(`[Scheduler] Email to ${patient.email} failed:`, e);
      }
    }

    if (reminderCfg.enableLine && reminderCfg.lineChannelAccessToken && patient.lineUserId) {
      try {
        const msg = buildReminderMessage(patient.name, clinic.name, dateStr, timeStr);
        await sendLineMessage(reminderCfg.lineChannelAccessToken, patient.lineUserId, msg);
        sent++;
      } catch (e) {
        console.error(`[Scheduler] LINE to ${patient.lineUserId} failed:`, e);
      }
    }

    if (reminderCfg.enableSms && patient.phone) {
      try {
        const msg = buildSmsReminderMessage(patient.name, clinic.name, dateStr, timeStr);
        await sendSms(patient.phone, msg);
        sent++;
      } catch (e) {
        console.error(`[Scheduler] SMS to ${patient.phone} failed:`, e);
      }
    }
  }

  // Persist that we ran today for this clinic
  await storage.upsertReminderSettings({ lastReminderRunDate: today }, clinic.id);

  if (sent > 0 || appointments.length > 0) {
    console.log(`[Scheduler] Sent ${sent} reminders for clinic "${clinic.name}" (tomorrow: ${tomorrowDate})`);
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

export function startScheduler(): void {
  if (schedulerTimer) return;
  schedulerTimer = setInterval(checkAndRunReminders, 60 * 1000);
  console.log("[Scheduler] Started. Checking every minute for reminder time.");
}

export function stopScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}
