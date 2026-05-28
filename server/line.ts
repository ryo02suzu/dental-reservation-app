const LINE_API = "https://api.line.me/v2/bot/message/push";

export async function sendLineMessage(
  channelAccessToken: string,
  userId: string,
  message: string
): Promise<void> {
  if (!channelAccessToken || !userId) return;
  try {
    const res = await fetch(LINE_API, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${channelAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: userId,
        messages: [{ type: "text", text: message }],
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[LINE] Failed to send to ${userId}: ${err}`);
    } else {
      console.log(`[LINE] Sent to ${userId}`);
    }
  } catch (e) {
    console.error("[LINE] Error:", e);
  }
}

export function buildReminderMessage(
  patientName: string,
  clinicName: string,
  date: string,
  time: string
): string {
  return `${patientName} 様

【${clinicName}】
明日のご予約をご案内いたします。

📅 ${date} ${time}

キャンセル・変更のご連絡はお早めにお願いいたします。
ご来院をお待ちしております。`;
}

export function buildRecallMessage(
  patientName: string,
  clinicName: string,
  clinicPhone: string
): string {
  return `${patientName} 様

【${clinicName}】
定期検診の時期になりましたのでご案内いたします。

お口の健康を保つため、ぜひ定期検診・クリーニングをご受診ください。

📞 ${clinicPhone || "お電話でご予約ください"}

またのご来院をお待ちしております。`;
}

export function buildBookingConfirmationMessage(
  patientName: string,
  clinicName: string,
  date: string,
  time: string,
  treatmentType: string
): string {
  return `${patientName} 様

【${clinicName}】
ご予約を承りました✅

📅 ${date} ${time}
🦷 ${treatmentType}

当日のお越しをお待ちしております。
キャンセルの場合はお早めにご連絡ください。`;
}
