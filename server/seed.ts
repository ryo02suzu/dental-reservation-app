import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { createPool } from "./db-config";

const pool = createPool();
const db = drizzle(pool);

const DEMO_CLINIC_ID = "default-clinic-001";

// 30分枠の時間スロット（昼休み12:00-14:00 除く）
const DAY_SLOTS = [
  { s: "09:00:00", e: "09:30:00" }, { s: "09:30:00", e: "10:00:00" },
  { s: "10:00:00", e: "10:30:00" }, { s: "10:30:00", e: "11:00:00" },
  { s: "11:00:00", e: "11:30:00" }, { s: "11:30:00", e: "12:00:00" },
  { s: "14:00:00", e: "14:30:00" }, { s: "14:30:00", e: "15:00:00" },
  { s: "15:00:00", e: "15:30:00" }, { s: "15:30:00", e: "16:00:00" },
  { s: "16:00:00", e: "16:30:00" }, { s: "16:30:00", e: "17:00:00" },
];
const SAT_SLOTS = DAY_SLOTS.slice(0, 6); // 土曜は午前のみ

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function resetDemoAppointments(): Promise<void> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = toDateStr(today);
    const windowStart = toDateStr(addDays(today, -3));
    const windowEnd = toDateStr(addDays(today, 30));

    // clinic_settings.clinic_name を同期
    await pool.query(
      `UPDATE clinic_settings SET clinic_name = 'デモ歯科クリニック' WHERE clinic_id = $1`,
      [DEMO_CLINIC_ID]
    );

    // スタッフ・患者・サービス取得
    const { rows: staffRows } = await pool.query<{ id: string; role: string }>(
      `SELECT id, role FROM staff WHERE clinic_id = $1 ORDER BY id`, [DEMO_CLINIC_ID]
    );
    const { rows: patientRows } = await pool.query<{ id: string }>(
      `SELECT id FROM patients WHERE clinic_id = $1 ORDER BY id`, [DEMO_CLINIC_ID]
    );
    const { rows: serviceRows } = await pool.query<{ id: string; name: string }>(
      `SELECT id, name FROM services WHERE clinic_id = $1 AND is_active = true ORDER BY sort_order, id`, [DEMO_CLINIC_ID]
    );

    if (staffRows.length === 0 || patientRows.length === 0 || serviceRows.length === 0) {
      console.log("[Demo Reset] スタッフ/患者/サービスが不足しています");
      return;
    }

    // 既存の予約を削除
    await pool.query(
      `DELETE FROM appointments WHERE clinic_id = $1 AND date >= $2 AND date <= $3`,
      [DEMO_CLINIC_ID, windowStart, windowEnd]
    );

    // 予約を生成
    const nowTimeStr = new Date().toTimeString().slice(0, 8);
    const insertRows: string[] = [];
    const params: string[] = [];
    let pIdx = 0, stIdx = 0, svIdx = 0, paramIdx = 0;

    for (let dayOffset = -3; dayOffset <= 30; dayOffset++) {
      const date = addDays(today, dayOffset);
      const dow = date.getDay(); // 0=日
      if (dow === 0) continue; // 日曜休診
      const dateStr = toDateStr(date);
      const slots = dow === 6 ? SAT_SLOTS : DAY_SLOTS;

      for (let slotIdx = 0; slotIdx < slots.length; slotIdx++) {
        // 一部スロットを間引いてリアル感を出す（固定パターン）
        if ((slotIdx + dayOffset + 7) % 7 === 0) continue;

        const slot = slots[slotIdx];
        const patient = patientRows[pIdx % patientRows.length];
        const staff = staffRows[stIdx % staffRows.length];
        const service = serviceRows[svIdx % serviceRows.length];
        pIdx++; stIdx++; svIdx++;

        let status = "confirmed";
        if (dateStr < todayStr) {
          const rnd = (pIdx * 3 + slotIdx) % 10;
          status = rnd < 7 ? "completed" : rnd < 9 ? "cancelled" : "no_show";
        } else if (dateStr === todayStr && slot.s < nowTimeStr) {
          status = "completed";
        }

        const id = `dr-${dateStr.replace(/-/g, "")}-${slotIdx}-${(pIdx % 9999).toString().padStart(4, "0")}`;
        // 重複防止でON CONFLICT使う
        const base = paramIdx;
        insertRows.push(`($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9},$${base+10},$${base+11})`);
        params.push(id, DEMO_CLINIC_ID, patient.id, staff.id, service.id, dateStr, slot.s, slot.e, service.name, status, "confirmed");
        paramIdx += 11;
      }
    }

    if (insertRows.length > 0) {
      // 100行ずつバッチ挿入
      const batchSize = 100;
      for (let i = 0; i < insertRows.length; i += batchSize) {
        const batchRows = insertRows.slice(i, i + batchSize);
        const batchParams = params.slice(i * 11, (i + batchSize) * 11);
        // batchRowsのプレースホルダーを再採番
        let pCount = 0;
        const renumberedRows = batchRows.map(row =>
          row.replace(/\$\d+/g, () => `$${++pCount}`)
        );
        await pool.query(
          `INSERT INTO appointments (id,clinic_id,patient_id,staff_id,service_id,date,start_time,end_time,treatment_type,status,confirmation_status)
           VALUES ${renumberedRows.join(",")}
           ON CONFLICT (id) DO NOTHING`,
          batchParams
        );
      }
      console.log(`[Demo Reset] ${insertRows.length}件の予約を生成しました`);
    }
  } catch (err) {
    console.error("[Demo Reset] エラー:", err);
  }
}

export async function applyMigrations() {
  try {
    // 今泉歯科医院のprimaryColorを常に正しい値に保つ
    await db.execute(sql`
      UPDATE clinic_settings
      SET primary_color = '#7eb4d2'
      WHERE clinic_id = 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1'
        AND (primary_color IS NULL OR primary_color = '#C4B5A0')
    `);
  } catch (err) {
    console.error("[Migration] primaryColor エラー:", err);
  }

  try {
    // sakura-demoの planType = 'professional' → 'pro' に修正（有効な値に統一）
    await db.execute(sql`
      UPDATE clinics
      SET plan_type = 'pro'
      WHERE id = 'f9853962-5b78-4671-a421-7e5328827c72'
        AND plan_type = 'professional'
    `);
  } catch (err) {
    console.error("[Migration] sakura-demo planType エラー:", err);
  }

  try {
    // 今泉歯科医院を初期パートナープランに変更
    await db.execute(sql`
      UPDATE clinics
      SET plan_type = 'partner'
      WHERE id = 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1'
        AND plan_type IN ('free', 'starter', 'pro')
    `);
  } catch (err) {
    console.error("[Migration] 今泉歯科 partner プランエラー:", err);
  }

  try {
    // 今泉歯科医院の診療メニューを患者目線の新リストに置き換える
    // 「初診・健診・相談」がなければ新リストに差し替え
    const check = await db.execute(sql`
      SELECT id FROM services
      WHERE clinic_id = 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1'
        AND name = '初診・健診・相談'
      LIMIT 1
    `);
    if (check.rows.length === 0) {
      await db.execute(sql`DELETE FROM services WHERE clinic_id = 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1'`);
      await db.execute(sql`
        INSERT INTO services (id, clinic_id, name, description, duration, price, category, sort_order, is_active) VALUES
          (gen_random_uuid(), 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1', '初診・健診・相談',       'はじめての方・健診・気になることのご相談', 60, 0, '一般歯科',   1,  true),
          (gen_random_uuid(), 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1', '歯が痛い・しみる',       '急性の痛みや知覚過敏の診察・応急処置',   30, 0, '一般歯科',   2,  true),
          (gen_random_uuid(), 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1', '虫歯の治療',             '虫歯の診断と治療',                    45, 0, '一般歯科',   3,  true),
          (gen_random_uuid(), 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1', '定期検診・予防',          '定期的なお口のチェックとクリーニング',   40, 0, '予防歯科',   4,  true),
          (gen_random_uuid(), 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1', 'クリーニング定期コース',   '歯石除去・PMTC・定期的な口腔ケア',     45, 0, 'お口のエステ', 5, true),
          (gen_random_uuid(), 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1', '子どもの歯のこと',        '乳歯・永久歯の管理、小児歯科全般',      30, 0, '小児歯科',   6,  true),
          (gen_random_uuid(), 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1', '親知らず・抜歯',          '親知らずや抜歯が必要な歯の処置',        60, 0, '口腔外科',   7,  true),
          (gen_random_uuid(), 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1', '入れ歯の相談・調整',      '入れ歯の作製・修理・フィット調整',      60, 0, '入れ歯',     8,  true),
          (gen_random_uuid(), 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1', '銀歯・見た目を直したい',   '白い素材への変更・審美的な治療',        60, 0, '審美歯科',   9,  true),
          (gen_random_uuid(), 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1', 'ホワイトニング',          '歯を白くするホワイトニング施術',         60, 0, 'お口のエステ', 10, true),
          (gen_random_uuid(), 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1', '口臭が気になる',          '口臭の原因診断とケアのご相談',          30, 0, '口臭外来',   11, true),
          (gen_random_uuid(), 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1', '訪問診療の相談',          'ご自宅や施設への訪問診療に関するご相談', 30, 0, '訪問診療',   12, true),
          (gen_random_uuid(), 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1', 'その他',                 '上記以外のご相談・治療',                30, 0, '一般歯科',   13, true)
      `);
      console.log("[Migration] 今泉歯科医院の診療メニューを新リストに更新しました");
    } else {
      // 既存レコードのカテゴリー・並び順を常に最新に保つ
      await db.execute(sql`
        UPDATE services SET category = '一般歯科',   sort_order = 1  WHERE clinic_id = 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1' AND name = '初診・健診・相談';
        UPDATE services SET category = '一般歯科',   sort_order = 2  WHERE clinic_id = 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1' AND name = '歯が痛い・しみる';
        UPDATE services SET category = '一般歯科',   sort_order = 3  WHERE clinic_id = 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1' AND name = '虫歯の治療';
        UPDATE services SET category = '予防歯科',   sort_order = 4  WHERE clinic_id = 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1' AND name = '定期検診・予防';
        UPDATE services SET category = 'お口のエステ', sort_order = 5 WHERE clinic_id = 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1' AND name = 'クリーニング定期コース';
        UPDATE services SET category = '小児歯科',   sort_order = 6  WHERE clinic_id = 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1' AND name = '子どもの歯のこと';
        UPDATE services SET category = '口腔外科',   sort_order = 7  WHERE clinic_id = 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1' AND name = '親知らず・抜歯';
        UPDATE services SET category = '入れ歯',     sort_order = 8  WHERE clinic_id = 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1' AND name = '入れ歯の相談・調整';
        UPDATE services SET category = '審美歯科',   sort_order = 9  WHERE clinic_id = 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1' AND name = '銀歯・見た目を直したい';
        UPDATE services SET category = 'お口のエステ', sort_order = 10 WHERE clinic_id = 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1' AND name = 'ホワイトニング';
        UPDATE services SET category = '口臭外来',   sort_order = 11 WHERE clinic_id = 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1' AND name = '口臭が気になる';
        UPDATE services SET category = '訪問診療',   sort_order = 12 WHERE clinic_id = 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1' AND name = '訪問診療の相談';
        UPDATE services SET category = '一般歯科',   sort_order = 13 WHERE clinic_id = 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1' AND name = 'その他';
      `);
      console.log("[Migration] 今泉歯科医院の診療メニュー：カテゴリー・並び順を更新しました");
    }
  } catch (err) {
    console.error("[Migration] サービス更新エラー:", err);
  }
}

export async function seedDatabase() {
  try {
    const result = await db.execute(
      sql`SELECT COUNT(*) as count FROM users WHERE is_super_admin = true`
    );
    const count = Number((result.rows[0] as any).count);
    if (count > 0) {
      return;
    }

    console.log("[Seed] 初期データを作成中...");

    // Sourirette スーパー管理者
    await db.execute(sql`
      INSERT INTO users (id, username, password, clinic_id, is_super_admin)
      VALUES (
        '1927a6b4-9cd3-45f8-8490-b2f2d98832ab',
        'Sourirette',
        '8c7a6c58d1d226ea84f2df9daa737439f3ac4b807548993b7159da7e788a4b48a73096868e2b034990a0db7d5d8382be40c4cb6a9318a30fcb8bcb0752aa0d15.275b581f722d2551c0e503d073a10701',
        NULL,
        true
      )
      ON CONFLICT (id) DO NOTHING
    `);

    // sakura-demo クリニック
    await db.execute(sql`
      INSERT INTO clinics (id, name, slug, phone, email, address, plan_type, is_active)
      VALUES (
        'f9853962-5b78-4671-a421-7e5328827c72',
        'Souriretteデンタルクリニック',
        'sakura-demo',
        '03-1234-5678',
        'info@sakura-dental.jp',
        '東京都渋谷区桜丘町1-2-3',
        'professional',
        true
      )
      ON CONFLICT (id) DO NOTHING
    `);

    await db.execute(sql`
      INSERT INTO business_hours (id, clinic_id, day_of_week, open_time, close_time, is_closed)
      VALUES
        (gen_random_uuid(), 'f9853962-5b78-4671-a421-7e5328827c72', 0, '09:00', '13:00', true),
        (gen_random_uuid(), 'f9853962-5b78-4671-a421-7e5328827c72', 1, '09:00', '18:30', false),
        (gen_random_uuid(), 'f9853962-5b78-4671-a421-7e5328827c72', 2, '09:00', '18:30', false),
        (gen_random_uuid(), 'f9853962-5b78-4671-a421-7e5328827c72', 3, '09:00', '18:30', false),
        (gen_random_uuid(), 'f9853962-5b78-4671-a421-7e5328827c72', 4, '09:00', '18:30', false),
        (gen_random_uuid(), 'f9853962-5b78-4671-a421-7e5328827c72', 5, '09:00', '18:30', false),
        (gen_random_uuid(), 'f9853962-5b78-4671-a421-7e5328827c72', 6, '09:00', '13:00', false)
    `);

    await db.execute(sql`
      INSERT INTO clinic_settings (id, clinic_id, clinic_name, chairs_count, booking_advance_days, booking_buffer_minutes, allow_double_booking, max_concurrent_appointments, enable_patient_confirmation, confirmation_deadline_hours, enable_qr_checkin, require_appointment_approval, slot_interval_minutes)
      VALUES (
        'b4392bc3-16dd-4b1b-a229-96fe3efea814',
        'f9853962-5b78-4671-a421-7e5328827c72',
        'さくら歯科クリニック', 6, 60, 15, false, 2, true, 24, false, false, 30
      )
      ON CONFLICT (id) DO NOTHING
    `);

    await db.execute(sql`
      INSERT INTO reminder_settings (id, clinic_id, enable_email, enable_sms, enable_line, reminder_hours_before)
      VALUES (gen_random_uuid(), 'f9853962-5b78-4671-a421-7e5328827c72', true, false, false, 24)
    `);

    await db.execute(sql`
      INSERT INTO services (id, clinic_id, name, description, duration, price, category, is_active)
      VALUES
        (gen_random_uuid(), 'f9853962-5b78-4671-a421-7e5328827c72', '定期検診・クリーニング', '歯石除去・歯面清掃・フッ素塗布', 30, 3300, '予防', true),
        (gen_random_uuid(), 'f9853962-5b78-4671-a421-7e5328827c72', '虫歯治療', '視診・X線検査・レジン充填', 45, 5500, '治療', true),
        (gen_random_uuid(), 'f9853962-5b78-4671-a421-7e5328827c72', 'ホワイトニング（オフィス）', '院内照射型ホワイトニング', 90, 33000, '審美', true),
        (gen_random_uuid(), 'f9853962-5b78-4671-a421-7e5328827c72', '歯周病治療', 'スケーリング・ルートプレーニング', 60, 4400, '治療', true),
        (gen_random_uuid(), 'f9853962-5b78-4671-a421-7e5328827c72', '矯正相談', '歯並び・矯正方法のカウンセリング', 30, 0, '相談', true)
    `);

    await db.execute(sql`
      INSERT INTO users (id, username, password, clinic_id, is_super_admin)
      VALUES (
        '2e5d32b7-7846-4db3-ad90-dd5c6730172c',
        'sakura-demo',
        '2c4a6382eb304478d12b8542d2e354803f3daac2ea5994642561efcd7d65a497b6c521147094669ae305781051a4a82df2ad4e52aa3673b907cf09937e0a6800.e47f0ab3e34dba258c31562e0e70cf4c',
        'f9853962-5b78-4671-a421-7e5328827c72',
        false
      )
      ON CONFLICT (id) DO NOTHING
    `);

    // 今泉歯科医院
    await db.execute(sql`
      INSERT INTO clinics (id, name, slug, phone, email, address, plan_type, is_active)
      VALUES (
        'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1',
        '今泉歯科医院',
        'imaizumi-dental',
        '',
        '',
        '群馬県桐生市',
        'starter',
        true
      )
      ON CONFLICT (id) DO NOTHING
    `);

    await db.execute(sql`
      INSERT INTO business_hours (id, clinic_id, day_of_week, open_time, close_time, is_closed)
      VALUES
        (gen_random_uuid(), 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1', 0, '09:00', '13:00', true),
        (gen_random_uuid(), 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1', 1, '09:00', '18:00', false),
        (gen_random_uuid(), 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1', 2, '09:00', '18:00', false),
        (gen_random_uuid(), 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1', 3, '09:00', '18:00', false),
        (gen_random_uuid(), 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1', 4, '09:00', '18:00', false),
        (gen_random_uuid(), 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1', 5, '09:00', '18:00', false),
        (gen_random_uuid(), 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1', 6, '09:00', '13:00', false)
    `);

    await db.execute(sql`
      INSERT INTO clinic_settings (id, clinic_id, clinic_name, chairs_count, booking_advance_days, booking_buffer_minutes, allow_double_booking, max_concurrent_appointments, enable_patient_confirmation, confirmation_deadline_hours, enable_qr_checkin, require_appointment_approval, slot_interval_minutes, primary_color)
      VALUES (
        gen_random_uuid(),
        'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1',
        '今泉歯科医院', 5, 60, 10, false, 2, true, 24, false, false, 30, '#7eb4d2'
      )
    `);

    await db.execute(sql`
      INSERT INTO reminder_settings (id, clinic_id, enable_email, enable_sms, enable_line, reminder_hours_before)
      VALUES (gen_random_uuid(), 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1', true, false, false, 24)
    `);

    await db.execute(sql`
      INSERT INTO services (id, clinic_id, name, description, duration, price, category, is_active)
      VALUES
        (gen_random_uuid(), 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1', '定期検診・クリーニング', '歯石除去・歯面清掃・フッ素塗布', 30, 3300, '予防', true),
        (gen_random_uuid(), 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1', '虫歯治療', '視診・X線検査・レジン充填', 45, 5500, '治療', true),
        (gen_random_uuid(), 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1', '歯周病治療', 'スケーリング・ルートプレーニング', 60, 4400, '治療', true),
        (gen_random_uuid(), 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1', '初診・カウンセリング', '口腔内検査・X線撮影・治療計画の説明', 60, 3300, '相談', true),
        (gen_random_uuid(), 'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1', '義歯（入れ歯）作製・調整', '部分義歯・総義歯の作製・調整', 60, 0, '補綴', true)
    `);

    await db.execute(sql`
      INSERT INTO users (id, username, password, clinic_id, is_super_admin)
      VALUES (
        '07bb6c3c-5f17-4656-a92d-4985ad9b8754',
        'imaizumi-admin',
        '393f6bf16af5b14336dddb46e318d732c6bbf7d83ac730b7c04c04672446ef46e20b824806207cfb2fe51c45bd9ac775bd6c277174dbf458572b9844f9fee9d2.582873da497b98e259689a39b1a7f8c3',
        'a5225a6e-9fdc-4cf5-bf9e-f43db810c3c1',
        false
      )
      ON CONFLICT (id) DO NOTHING
    `);

    console.log("[Seed] 初期データ作成完了");
  } catch (err) {
    console.error("[Seed] エラー:", err);
  }
}
