const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;

export interface TwilioCredentials {
  accountSid?: string | null;
  authToken?: string | null;
  fromNumber?: string | null;
}

// 院ごとの認証情報を優先し、無ければ環境変数にフォールバックする。
function resolveTwilioCredentials(creds?: TwilioCredentials) {
  const accountSid = creds?.accountSid || TWILIO_ACCOUNT_SID;
  const authToken = creds?.authToken || TWILIO_AUTH_TOKEN;
  const fromNumber = creds?.fromNumber || TWILIO_FROM_NUMBER;
  return { accountSid, authToken, fromNumber };
}

function formatJapanesePhone(phone: string): string {
  const digits = phone.replace(/[\s\-()]/g, "");
  if (digits.startsWith("0")) return "+81" + digits.slice(1);
  if (digits.startsWith("+81")) return digits;
  return digits;
}

export async function sendSms(to: string, body: string, creds?: TwilioCredentials): Promise<void> {
  const { accountSid, authToken, fromNumber } = resolveTwilioCredentials(creds);
  if (!accountSid || !authToken || !fromNumber) {
    console.log("[SMS] Twilio credentials not configured. Skipping SMS.");
    return;
  }

  const toFormatted = formatJapanesePhone(to);
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  try {
    const params = new URLSearchParams({
      To: toFormatted,
      From: fromNumber,
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

export function isSmsConfigured(creds?: TwilioCredentials): boolean {
  const { accountSid, authToken, fromNumber } = resolveTwilioCredentials(creds);
  return !!(accountSid && authToken && fromNumber);
}
