import { Resend } from "resend";

const systemResend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

if (!systemResend) {
  console.warn("RESEND_API_KEY is not set. Clinics must configure their own Resend API key in settings.");
}

function getClient(clinicApiKey?: string | null): Resend | null {
  if (clinicApiKey) return new Resend(clinicApiKey);
  return systemResend;
}

const FROM = "Dental Clinic <onboarding@resend.dev>";

export async function sendReminderEmail(
  to: string,
  patientName: string,
  appointmentDate: string,
  appointmentTime: string,
  clinicName: string,
  clinicApiKey?: string | null
): Promise<void> {
  const client = getClient(clinicApiKey);
  if (!client) return;
  try {
    await client.emails.send({
      from: FROM, to: [to],
      subject: `予約確認のリマインダー: ${clinicName}`,
      html: `
        <p>${patientName} 様</p>
        <p>${clinicName} です。ご予約日が近づいておりますので、ご案内申し上げます。</p>
        <p>
          <strong>日時:</strong> ${appointmentDate} ${appointmentTime}<br>
          <strong>医院名:</strong> ${clinicName}
        </p>
        <p>ご来院をお待ちしております。</p>
      `,
    });
  } catch (error) {
    console.error("Error sending reminder email:", error);
  }
}

export async function sendRecallEmail(
  to: string,
  patientName: string,
  clinicName: string,
  clinicPhone: string,
  clinicApiKey?: string | null
): Promise<void> {
  const client = getClient(clinicApiKey);
  if (!client) return;
  try {
    await client.emails.send({
      from: FROM, to: [to],
      subject: `定期検診のご案内: ${clinicName}`,
      html: `
        <p>${patientName} 様</p>
        <p>${clinicName} です。前回の診察からしばらく経ちますが、いかがお過ごしでしょうか。</p>
        <p>お口の健康を維持するため、定期的な検診をおすすめしております。</p>
        <p>
          <strong>医院名:</strong> ${clinicName}<br>
          <strong>電話番号:</strong> ${clinicPhone}
        </p>
        <p>ご予約はお電話またはウェブサイトより承っております。ご連絡をお待ちしております。</p>
      `,
    });
  } catch (error) {
    console.error("Error sending recall email:", error);
  }
}

export async function sendBookingConfirmationEmail(
  to: string,
  patientName: string,
  appointmentDate: string,
  appointmentTime: string,
  clinicName: string,
  serviceType: string,
  clinicApiKey?: string | null
): Promise<void> {
  const client = getClient(clinicApiKey);
  if (!client) return;
  try {
    await client.emails.send({
      from: FROM, to: [to],
      subject: `予約完了のお知らせ: ${clinicName}`,
      html: `
        <p>${patientName} 様</p>
        <p>${clinicName} へのご予約、ありがとうございます。以下の内容で予約が完了しました。</p>
        <p>
          <strong>日時:</strong> ${appointmentDate} ${appointmentTime}<br>
          <strong>メニュー:</strong> ${serviceType}<br>
          <strong>医院名:</strong> ${clinicName}
        </p>
        <p>当日のお越しを心よりお待ちしております。</p>
      `,
    });
  } catch (error) {
    console.error("Error sending booking confirmation email:", error);
  }
}

export async function sendCancellationEmail(
  to: string,
  patientName: string,
  appointmentDate: string,
  clinicName: string,
  clinicApiKey?: string | null
): Promise<void> {
  const client = getClient(clinicApiKey);
  if (!client) return;
  try {
    await client.emails.send({
      from: FROM, to: [to],
      subject: `予約キャンセルのお知らせ: ${clinicName}`,
      html: `
        <p>${patientName} 様</p>
        <p>${clinicName} です。以下のご予約がキャンセルされましたのでお知らせいたします。</p>
        <p>
          <strong>日時:</strong> ${appointmentDate}<br>
          <strong>医院名:</strong> ${clinicName}
        </p>
        <p>またのご利用をお待ちしております。</p>
      `,
    });
  } catch (error) {
    console.error("Error sending cancellation email:", error);
  }
}

export async function sendNewBookingNotificationToAdmin(
  to: string,
  clinicName: string,
  patientName: string,
  patientPhone: string,
  appointmentDate: string,
  appointmentTime: string,
  treatmentType: string,
  clinicApiKey?: string | null
): Promise<void> {
  const client = getClient(clinicApiKey);
  if (!client) return;
  try {
    await client.emails.send({
      from: FROM, to: [to],
      subject: `【${clinicName}】新規予約が入りました`,
      html: `
        <p>${clinicName} 管理者様</p>
        <p>新規オンライン予約が入りましたのでお知らせいたします。</p>
        <table style="border-collapse:collapse; margin-top:12px;">
          <tr><td style="padding:4px 12px 4px 0; font-weight:bold;">患者名</td><td>${patientName}</td></tr>
          <tr><td style="padding:4px 12px 4px 0; font-weight:bold;">電話番号</td><td>${patientPhone}</td></tr>
          <tr><td style="padding:4px 12px 4px 0; font-weight:bold;">日時</td><td>${appointmentDate} ${appointmentTime}</td></tr>
          <tr><td style="padding:4px 12px 4px 0; font-weight:bold;">メニュー</td><td>${treatmentType}</td></tr>
        </table>
        <p style="margin-top:16px;">管理画面でご確認ください。</p>
      `,
    });
  } catch (error) {
    console.error("Error sending admin notification email:", error);
  }
}

export async function sendPendingBookingEmail(
  to: string,
  patientName: string,
  appointmentDate: string,
  appointmentTime: string,
  clinicName: string,
  serviceType: string,
  clinicApiKey?: string | null
): Promise<void> {
  const client = getClient(clinicApiKey);
  if (!client) return;
  try {
    await client.emails.send({
      from: FROM, to: [to],
      subject: `仮予約受付のお知らせ: ${clinicName}`,
      html: `
        <p>${patientName} 様</p>
        <p>${clinicName} への仮予約を受け付けました。医院からの承認後、正式にご予約が確定いたします。</p>
        <p>
          <strong>日時:</strong> ${appointmentDate} ${appointmentTime}<br>
          <strong>メニュー:</strong> ${serviceType}<br>
          <strong>医院名:</strong> ${clinicName}
        </p>
        <p>承認結果は別途メールにてご連絡いたします。しばらくお待ちください。</p>
      `,
    });
  } catch (error) {
    console.error("Error sending pending booking email:", error);
  }
}

export async function sendAppointmentApprovedEmail(
  to: string,
  patientName: string,
  appointmentDate: string,
  appointmentTime: string,
  clinicName: string,
  clinicApiKey?: string | null
): Promise<void> {
  const client = getClient(clinicApiKey);
  if (!client) return;
  try {
    await client.emails.send({
      from: FROM, to: [to],
      subject: `予約承認のお知らせ: ${clinicName}`,
      html: `
        <p>${patientName} 様</p>
        <p>${clinicName} です。ご予約が承認されました。</p>
        <p>
          <strong>日時:</strong> ${appointmentDate} ${appointmentTime}<br>
          <strong>医院名:</strong> ${clinicName}
        </p>
        <p>当日のお越しを心よりお待ちしております。</p>
      `,
    });
  } catch (error) {
    console.error("Error sending approval email:", error);
  }
}

export async function sendAppointmentRejectedEmail(
  to: string,
  patientName: string,
  appointmentDate: string,
  appointmentTime: string,
  clinicName: string,
  clinicApiKey?: string | null
): Promise<void> {
  const client = getClient(clinicApiKey);
  if (!client) return;
  try {
    await client.emails.send({
      from: FROM, to: [to],
      subject: `予約お断りのお知らせ: ${clinicName}`,
      html: `
        <p>${patientName} 様</p>
        <p>${clinicName} です。誠に恐れ入りますが、下記のご予約についてお応えできない状況となりました。</p>
        <p>
          <strong>日時:</strong> ${appointmentDate} ${appointmentTime}<br>
          <strong>医院名:</strong> ${clinicName}
        </p>
        <p>再度のご予約をお待ちしております。ご不便をおかけして申し訳ございません。</p>
      `,
    });
  } catch (error) {
    console.error("Error sending rejection email:", error);
  }
}

export async function sendWaitlistNotificationEmail(
  to: string,
  patientName: string,
  clinicName: string,
  bookingUrl: string,
  clinicApiKey?: string | null
): Promise<void> {
  const client = getClient(clinicApiKey);
  if (!client) return;
  try {
    await client.emails.send({
      from: FROM, to: [to],
      subject: `【${clinicName}】ご希望の時間帯に空きが出ました`,
      html: `
        <p>${patientName} 様</p>
        <p>${clinicName} です。キャンセルが発生し、ご希望の時間帯に空きが出ました。</p>
        <p>下記よりお早めにご予約ください（先着順となります）。</p>
        <p style="margin-top:16px;">
          <a href="${bookingUrl}" style="background:#2563eb; color:#fff; padding:10px 20px; border-radius:6px; text-decoration:none; font-weight:bold;">
            今すぐ予約する
          </a>
        </p>
        <p style="margin-top:16px; font-size:12px; color:#666;">
          このメールは自動送信です。ご返信はできません。
        </p>
      `,
    });
  } catch (error) {
    console.error("Error sending waitlist notification email:", error);
  }
}

export async function sendTestEmail(to: string, clinicName: string, clinicApiKey?: string | null): Promise<void> {
  const client = getClient(clinicApiKey);
  if (!client) throw new Error("メール送信APIキーが設定されていません。設定画面でResend APIキーを登録してください。");
  try {
    await client.emails.send({
      from: FROM, to: [to],
      subject: `テストメール: ${clinicName}`,
      html: `
        <p>${clinicName} の管理者様</p>
        <p>これはリマインダー設定からのテスト送信メールです。このメールが届いている場合、Resendの連携は正しく設定されています。</p>
      `,
    });
  } catch (error) {
    console.error("Error sending test email:", error);
    throw error;
  }
}
