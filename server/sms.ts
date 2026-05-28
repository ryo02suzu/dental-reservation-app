const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;

function formatJapanesePhone(phone: string): string {
  const digits = phone.replace(/[\s\-()]/g, "");
  if (digits.startsWith("0")) return "+81" + digits.slice(1);
  if (digits.startsWith("+81")) return digits;
  return digits;
}

export async function sendSms(to: string, body: string): Promise<void> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    console.log("[SMS] TWILIO_* env vars not set. Skipping SMS.");
    return;
  }

  const toFormatted = formatJapanesePhone(to);
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const credentials = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");

  try {
    const params = new URLSearchParams({
      To: toFormatted,
      From: TWILIO_FROM_NUMBER,
      Body: body,
    });

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[SMS] Failed to send to ${toFormatted}: ${err}`);
    } else {
      console.log(`[SMS] Sent to ${toFormatted}`);
    }
  } catch (e) {
    console.error("[SMS] Error:", e);
  }
}

export function buildSmsReminderMessage(
  patientName: string,
  clinicName: string,
  date: string,
  time: string
): string {
  return `【${clinicName}】${patientName}様、明日${date} ${time}のご予約をお知らせします。ご来院をお待ちしております。`;
}

export function isSmsConfigured(): boolean {
  return !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER);
}
