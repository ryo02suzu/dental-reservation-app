// 機能1: 治療内容連動型 自動フォローアップ＆リコール
// 予約が「完了」になった瞬間に、予約メニューに紐づくテンプレートから
// フォローアップ（翌日等）とリコール（数ヶ月後）の送信予約を作成する。
import { storage } from "./storage.js";

function jstNow(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

// 指定日(YYYY-MM-DD基準のbaseDate)の delayHours 後の日付に、HH:MM の時刻を設定したJST時刻を
// UTC Dateとして返す（DBはtimestampなのでUTCで保持）。
function buildSendTime(base: Date, delayHours: number, hhmm: string): Date {
  const t = new Date(base.getTime() + delayHours * 60 * 60 * 1000);
  const [h, m] = (hhmm || "18:00").split(":").map(Number);
  // JST想定で時刻をセットし、UTCに戻す
  const jst = new Date(t.getTime() + 9 * 60 * 60 * 1000);
  jst.setUTCHours(h, m, 0, 0);
  return new Date(jst.getTime() - 9 * 60 * 60 * 1000);
}

function addMonths(d: Date, months: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + months);
  return r;
}

function fill(template: string, vars: Record<string, string>): string {
  return (template || "").replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

const DEFAULT_FOLLOWUP_SURGICAL =
  "{patientName} 様\n\n昨日はお疲れ様でした。お痛みや出血は落ち着きましたか？\nもしご不安な点があれば、このLINEからそのままご返信ください。\n\n【{clinicName}】";
const DEFAULT_FOLLOWUP_CHECKUP =
  "{patientName} 様\n\n本日はご来院ありがとうございました。\nお口の状態で気になることがあれば、お気軽にご相談ください。\n\n【{clinicName}】";
const DEFAULT_RECALL =
  "{patientName} 様\n\n前回のご来院から時間が経ちました。お口の健康維持のため、定期検診・クリーニングをおすすめします。\nご予約をお待ちしております。\n\n【{clinicName}】";

// 予約完了時に呼ぶ。LINE連携(lineUserId)が無くても email チャネルで予約する。
export async function scheduleFollowUpsForAppointment(appointmentId: string): Promise<void> {
  try {
    const appt = await storage.getAppointmentById(appointmentId);
    if (!appt || !appt.patientId) return;
    const clinic = await storage.getClinic(appt.clinicId);
    if (!clinic) return;
    const patient = await storage.getPatientById(appt.patientId);
    if (!patient) return;

    // 既にこの予約でフォローアップが予約済みなら二重作成しない
    const existing = await storage.getScheduledMessages(appt.clinicId, "pending");
    if (existing.some(m => m.appointmentId === appointmentId)) return;

    const template = await storage.getFollowUpTemplateForService(appt.clinicId, appt.serviceId ?? null);
    // テンプレート未設定でも既定動作はしない（医院が明示的にONにしたときだけ送る）
    if (!template || !template.enabled) return;

    // 送信チャネル: LINE優先、無ければメール（どちらも不可ならスキップ）
    const channel = patient.lineUserId ? "line" : (patient.email ? "email" : null);
    if (!channel) return;

    const vars = {
      patientName: patient.name,
      clinicName: clinic.name,
      clinicPhone: clinic.phone ?? "",
    };
    const completedAt = jstNow();

    // フォローアップ（翌日夕方など）
    if (template.followUpEnabled) {
      const defaultMsg = template.kind === "surgical" ? DEFAULT_FOLLOWUP_SURGICAL : DEFAULT_FOLLOWUP_CHECKUP;
      const msg = fill(template.followUpMessage || defaultMsg, vars);
      const sendAt = buildSendTime(completedAt, template.followUpDelayHours ?? 24, template.followUpSendAtTime ?? "18:00");
      await storage.createScheduledMessage({
        clinicId: appt.clinicId,
        patientId: patient.id,
        appointmentId,
        templateId: template.id,
        purpose: "followup",
        channel,
        scheduledFor: sendAt,
        message: msg,
        status: "pending",
      });
    }

    // リコール（数ヶ月後）
    if (template.recallEnabled) {
      const msg = fill(template.recallMessage || DEFAULT_RECALL, vars);
      const base = addMonths(completedAt, template.recallDelayMonths ?? 6);
      const sendAt = buildSendTime(base, 0, template.recallSendAtTime ?? "10:00");
      await storage.createScheduledMessage({
        clinicId: appt.clinicId,
        patientId: patient.id,
        appointmentId,
        templateId: template.id,
        purpose: "recall",
        channel,
        scheduledFor: sendAt,
        message: msg,
        status: "pending",
      });
    }
  } catch (e) {
    console.error("[FollowUp] scheduleFollowUpsForAppointment error:", e);
  }
}
