// リコール対象の補い。
// 共有のサンプルデータでは、ほぼ全員が直近6週間に来院しているため、定期検診の時期（前後30日）に
// 入る患者さんが本人（田中 美咲）の1人しかいない。リコール画面が成り立つよう、医院アプリの起動時に
// 決まった規則で（乱数を使わず患者IDから）対象者を補う。ストアは同じ配列から始まるので、
// サイドバーの件数・その他タブ・新規予約シートの「予約済み」への切り替えもそのまま連動する。
// 共有データ側で対象者が十分に作られるようになったら、ここは何もしない。
import { addDays, subDays } from "date-fns";
import { TODAY, TODAY_KEY } from "@/lib/clock";
import { ME, initialAppointments, patients, recalls, type RecallItem } from "@/data";

const CHECKUP = new Set(["sv01", "sv02", "sv09"]);

function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

if (recalls.length < 6) {
  const present = new Set(recalls.map(r => r.patientId));
  const todays = new Set(initialAppointments.filter(a => a.date === TODAY_KEY).map(a => a.patientId));
  const bookedCheckup = new Set(
    initialAppointments.filter(a => a.date > TODAY_KEY && CHECKUP.has(a.serviceId) && (a.status === "confirmed" || a.status === "pending")).map(a => a.patientId),
  );
  const pool = patients
    .slice(0, 70)
    .filter(p => p.id !== ME.id && p.visits > 1 && !present.has(p.id) && !todays.has(p.id))
    .sort((a, b) => hash(`r${a.id}`) - hash(`r${b.id}`))
    .slice(0, 24);
  // 期限は -27日〜+29日に散らす。予約済みは実際に定期検診の予約がある人から選ぶ
  pool.forEach((p, i) => {
    const h = hash(`s${p.id}`);
    const offset = -27 + Math.round((i * 56) / (pool.length - 1)) + ((h % 3) - 1);
    const due = addDays(TODAY, offset);
    let status: RecallItem["status"];
    if (bookedCheckup.has(p.id) && h % 7 < 2 && offset > -20) status = "予約済み";
    else if (offset < -14) status = "送信済み";
    else if (offset < 0) status = i % 2 ? "送信済み" : "未連絡";
    else status = (["未連絡", "送信済み", "未連絡", "保留", "未連絡", "送信済み", "未連絡"] as const)[i % 7];
    const channel: RecallItem["channel"] = p.line ? "LINE" : p.email ? (h % 2 ? "メール" : "SMS") : h % 4 === 0 ? "電話" : "SMS";
    // 送るのは期限の3週間ほど前（今日より後にはならない）
    const sentDaysAgo = Math.min(30 - (h % 9), Math.max(1, 21 - (h % 8) - offset));
    const sentAt = status === "送信済み" || status === "予約済み" ? subDays(TODAY, sentDaysAgo) : undefined;
    recalls.push({ patientId: p.id, due, status, channel, sentAt });
  });
}
