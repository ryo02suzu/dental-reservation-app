import { drizzle } from "drizzle-orm/node-postgres";
import { createPool } from "./db-config";
import { eq, and, gte, lte, desc, asc, sql, ilike, or } from "drizzle-orm";
import * as schema from "@shared/schema";
import type {
  Clinic, InsertClinic,
  Staff, InsertStaff,
  Patient, InsertPatient,
  Service, InsertService,
  Appointment, InsertAppointment,
  MedicalRecord, InsertMedicalRecord,
  BusinessHours,
  Holiday,
  ClinicSettings,
  ReminderSettings,
  Waitlist, InsertWaitlist,
  Questionnaire, InsertQuestionnaire,
  User, InsertUser,
  PlanDefinition, InsertPlanDefinition,
  AddonDefinition, InsertAddonDefinition,
  Shift, InsertShift,
  ShiftPattern, InsertShiftPattern,
  ClinicAddon,
  AdminNotification,
  Attendance, InsertAttendance,
} from "@shared/schema";

const pool = createPool();
const db = drizzle(pool, { schema });

export const DEFAULT_CLINIC_ID = "default-clinic-001";

export interface IStorage {
  // Clinic
  getClinic(clinicId?: string): Promise<Clinic | undefined>;
  getClinicBySlug(slug: string): Promise<Clinic | undefined>;
  getAllClinics(): Promise<Clinic[]>;
  upsertClinic(data: Partial<InsertClinic>, clinicId?: string): Promise<Clinic>;
  createClinicFull(clinicData: { name: string; slug: string; phone?: string; address?: string; email?: string; planType?: string }, adminData: { username: string; password: string }, addonKeys?: string[]): Promise<{ clinic: Clinic; user: User }>;
  updateClinicStatus(clinicId: string, isActive: boolean): Promise<Clinic | undefined>;
  updateClinicPlan(clinicId: string, planType: string): Promise<Clinic | undefined>;
  deleteClinic(clinicId: string): Promise<void>;
  // Staff
  getStaff(clinicId?: string): Promise<Staff[]>;
  getStaffById(id: string): Promise<Staff | undefined>;
  getStaffByLoginToken(token: string): Promise<Staff | undefined>;
  setStaffLoginToken(id: string, token: string | null): Promise<Staff | undefined>;
  createStaff(data: InsertStaff): Promise<Staff>;
  updateStaff(id: string, data: Partial<InsertStaff>): Promise<Staff | undefined>;
  reorderStaff(clinicId: string, orderedIds: string[]): Promise<void>;
  deleteStaff(id: string): Promise<void>;
  // Patients
  getPatients(clinicId?: string, search?: string): Promise<Patient[]>;
  getPatientById(id: string): Promise<Patient | undefined>;
  createPatient(data: InsertPatient): Promise<Patient>;
  updatePatient(id: string, data: Partial<InsertPatient>): Promise<Patient | undefined>;
  deletePatient(id: string): Promise<void>;
  // Shifts
  getShifts(filters: { clinicId: string; staffId?: string; month?: string; startDate?: string; endDate?: string }): Promise<(Shift & { staff?: Staff })[]>;
  createShift(data: InsertShift & { reviewedAt?: Date; reviewedBy?: string }): Promise<Shift>;
  updateShift(id: string, data: Partial<InsertShift & { reviewedAt?: Date; reviewedBy?: string }>): Promise<Shift | undefined>;
  getShiftById(id: string): Promise<Shift | undefined>;
  deleteShift(id: string): Promise<void>;
  // Shift Patterns
  getShiftPatterns(clinicId: string): Promise<ShiftPattern[]>;
  createShiftPattern(data: InsertShiftPattern): Promise<ShiftPattern>;
  updateShiftPattern(id: string, data: Partial<InsertShiftPattern>): Promise<ShiftPattern | undefined>;
  deleteShiftPattern(id: string): Promise<void>;
  getShiftPatternById(id: string): Promise<ShiftPattern | undefined>;
  // Services
  getServices(clinicId?: string): Promise<Service[]>;
  createService(data: InsertService): Promise<Service>;
  getServiceById(id: string): Promise<Service | undefined>;
  updateService(id: string, data: Partial<InsertService>): Promise<Service | undefined>;
  deleteService(id: string): Promise<void>;
  // Appointments
  getAppointments(filters?: { clinicId?: string; date?: string; startDate?: string; endDate?: string; patientId?: string }): Promise<(Appointment & { patient?: Patient; staff?: Staff })[]>;
  getAppointmentById(id: string): Promise<(Appointment & { patient?: Patient; staff?: Staff }) | undefined>;
  checkAppointmentConflict(params: { clinicId: string; date: string; startTime: string; endTime: string; chairNumber?: number; excludeId?: string }): Promise<boolean>;
  createAppointment(data: InsertAppointment): Promise<Appointment>;
  updateAppointment(id: string, data: Partial<InsertAppointment>): Promise<Appointment | undefined>;
  deleteAppointment(id: string): Promise<void>;
  // Medical Records
  getMedicalRecords(clinicId?: string): Promise<(MedicalRecord & { patient?: Patient; staff?: Staff })[]>;
  getMedicalRecordById(id: string): Promise<MedicalRecord | undefined>;
  createMedicalRecord(data: InsertMedicalRecord): Promise<MedicalRecord>;
  deleteMedicalRecord(id: string): Promise<void>;
  // Business Hours
  getBusinessHours(clinicId?: string): Promise<BusinessHours[]>;
  upsertBusinessHours(data: schema.BusinessHours[], clinicId?: string): Promise<void>;
  // Holidays
  getHolidays(clinicId?: string): Promise<Holiday[]>;
  getHolidayById(id: string): Promise<Holiday | undefined>;
  createHoliday(data: InsertHolidaySchemaType): Promise<Holiday>;
  createHolidayBatch(data: { date: string; name?: string | null; reason?: string | null }[], clinicId?: string): Promise<number>;
  deleteHoliday(id: string): Promise<void>;
  // Clinic Settings
  getClinicSettings(clinicId?: string): Promise<ClinicSettings | undefined>;
  upsertClinicSettings(data: Partial<schema.ClinicSettings>, clinicId?: string): Promise<ClinicSettings>;
  // Reminder Settings
  getReminderSettings(clinicId?: string): Promise<ReminderSettings | undefined>;
  upsertReminderSettings(data: Partial<ReminderSettings>, clinicId?: string): Promise<ReminderSettings>;
  // Waitlist
  addToWaitlist(data: InsertWaitlist): Promise<Waitlist>;
  getWaitlist(clinicId: string): Promise<Waitlist[]>;
  updateWaitlistEntry(id: string, data: Partial<InsertWaitlist>, clinicId: string): Promise<Waitlist | undefined>;
  deleteWaitlistEntry(id: string, clinicId: string): Promise<void>;
  // Recall
  getRecallPatients(clinicId: string): Promise<Patient[]>;
  updatePatientRecall(id: string, data: { nextRecallDate?: string | null; recallIntervalMonths?: number }, clinicId: string): Promise<Patient | undefined>;
  markRecallSent(id: string, clinicId: string): Promise<Patient | undefined>;
  // Questionnaires
  createQuestionnaire(data: InsertQuestionnaire): Promise<Questionnaire>;
  getQuestionnaires(clinicId: string): Promise<Questionnaire[]>;
  getQuestionnaireByAppointment(appointmentId: string): Promise<Questionnaire | undefined>;
  // User
  getPatientByPhone(phone: string, clinicId?: string): Promise<Patient | undefined>;
  getPatientByReferralCode(referralCode: string): Promise<Patient | undefined>;
  incrementReferralCount(patientId: string): Promise<void>;
  setPatientPassword(patientId: string, hashedPassword: string): Promise<void>;
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsersByClinicId(clinicId: string): Promise<User[]>;
  setUserPassword(id: string, hashedPassword: string): Promise<void>;
  createUser(user: InsertUser & { clinicId?: string | null; isSuperAdmin?: boolean }): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  hasUsers(): Promise<boolean>;
  // Plan Definitions
  getPlanDefinitions(): Promise<PlanDefinition[]>;
  getPlanDefinitionByKey(key: string): Promise<PlanDefinition | undefined>;
  createPlanDefinition(data: InsertPlanDefinition): Promise<PlanDefinition>;
  updatePlanDefinition(id: string, data: Partial<InsertPlanDefinition>): Promise<PlanDefinition | undefined>;
  deletePlanDefinition(id: string): Promise<void>;
  // Addon Definitions
  getAddonDefinitions(): Promise<AddonDefinition[]>;
  createAddonDefinition(data: InsertAddonDefinition): Promise<AddonDefinition>;
  updateAddonDefinition(id: string, data: Partial<InsertAddonDefinition>): Promise<AddonDefinition | undefined>;
  deleteAddonDefinition(id: string): Promise<void>;
  // Clinic Addons
  getClinicAddons(clinicId: string): Promise<ClinicAddon[]>;
  setClinicAddon(clinicId: string, addonKey: string, enabled: boolean): Promise<void>;
  // Admin Notifications
  createAdminNotification(data: { clinicId: string; type: string; title: string; body?: string; appointmentId?: string }): Promise<AdminNotification>;
  getAdminNotifications(clinicId: string, limit?: number): Promise<AdminNotification[]>;
  getUnreadNotificationCount(clinicId: string): Promise<number>;
  markAllNotificationsRead(clinicId: string): Promise<void>;
  // Attendance
  getAttendanceToday(clinicId: string): Promise<(Attendance & { staff?: Staff })[]>;
  getAttendanceByStaff(staffId: string, date: string): Promise<Attendance | undefined>;
  getAttendanceById(id: string): Promise<Attendance | undefined>;
  clockIn(data: InsertAttendance): Promise<Attendance>;
  clockOut(id: string): Promise<Attendance | undefined>;
  startBreak(id: string): Promise<Attendance | undefined>;
  endBreak(id: string): Promise<Attendance | undefined>;
  updateAttendance(id: string, data: Partial<{ clockIn: Date | null; clockOut: Date | null; breakStart: Date | null; breakEnd: Date | null; notes: string | null }>): Promise<Attendance | undefined>;
  getAttendanceByMonth(clinicId: string, month: string): Promise<(Attendance & { staff?: Staff })[]>;
  // Initialize
  initialize(): Promise<void>;
}

type InsertHolidaySchemaType = { clinicId: string; date: string; name?: string | null; reason?: string | null; startTime?: string | null; endTime?: string | null };

class PgStorage implements IStorage {
  async initialize(): Promise<void> {
    const existing = await db.select().from(schema.clinics).where(eq(schema.clinics.id, DEFAULT_CLINIC_ID)).limit(1);
    if (existing.length === 0) {
      await db.insert(schema.clinics).values({
        id: DEFAULT_CLINIC_ID,
        name: "クリニック名",
        slug: "demo",
        phone: "",
        email: "",
        address: "",
        description: "",
      });
    } else if (!existing[0].slug) {
      await db.update(schema.clinics).set({ slug: "demo" }).where(eq(schema.clinics.id, DEFAULT_CLINIC_ID));
    }

    const hoursCount = await db.select({ count: sql<number>`count(*)` }).from(schema.businessHours).where(eq(schema.businessHours.clinicId, DEFAULT_CLINIC_ID));
    if (Number(hoursCount[0].count) === 0) {
      await db.insert(schema.businessHours).values([
        { clinicId: DEFAULT_CLINIC_ID, dayOfWeek: 0, openTime: "09:00", closeTime: "17:00", isClosed: true },
        { clinicId: DEFAULT_CLINIC_ID, dayOfWeek: 1, openTime: "09:00", closeTime: "18:00", isClosed: false },
        { clinicId: DEFAULT_CLINIC_ID, dayOfWeek: 2, openTime: "09:00", closeTime: "18:00", isClosed: false },
        { clinicId: DEFAULT_CLINIC_ID, dayOfWeek: 3, openTime: "09:00", closeTime: "18:00", isClosed: false },
        { clinicId: DEFAULT_CLINIC_ID, dayOfWeek: 4, openTime: "09:00", closeTime: "18:00", isClosed: false },
        { clinicId: DEFAULT_CLINIC_ID, dayOfWeek: 5, openTime: "09:00", closeTime: "18:00", isClosed: false },
        { clinicId: DEFAULT_CLINIC_ID, dayOfWeek: 6, openTime: "09:00", closeTime: "14:00", isClosed: false },
      ]);
    }

    const settingsCount = await db.select({ count: sql<number>`count(*)` }).from(schema.clinicSettings).where(eq(schema.clinicSettings.clinicId, DEFAULT_CLINIC_ID));
    if (Number(settingsCount[0].count) === 0) {
      await db.insert(schema.clinicSettings).values({
        clinicId: DEFAULT_CLINIC_ID,
        clinicName: "クリニック名",
        chairsCount: 5,
        bookingAdvanceDays: 60,
        bookingBufferMinutes: 15,
        allowDoubleBooking: false,
        maxConcurrentAppointments: 1,
        enablePatientConfirmation: true,
        confirmationDeadlineHours: 24,
        enableQrCheckin: false,
      });
    }

    const reminderCount = await db.select({ count: sql<number>`count(*)` }).from(schema.reminderSettings).where(eq(schema.reminderSettings.clinicId, DEFAULT_CLINIC_ID));
    if (Number(reminderCount[0].count) === 0) {
      await db.insert(schema.reminderSettings).values({
        clinicId: DEFAULT_CLINIC_ID,
        enableEmail: true,
        enableSms: false,
        enableLine: false,
        reminderHoursBefore: 24,
      });
    }

    // Ensure existing admin users are marked as super admin
    await db.update(schema.users)
      .set({ isSuperAdmin: true })
      .where(and(
        sql`${schema.users.clinicId} IS NULL`,
        eq(schema.users.isSuperAdmin, false)
      ));

    // Seed default addon definitions if none exist
    const addonCount = await db.select({ count: sql<number>`count(*)` }).from(schema.addonDefinitions);
    if (Number(addonCount[0].count) === 0) {
      await db.insert(schema.addonDefinitions).values([
        { key: "line_reminder", name: "LINEリマインダー", price: 1980, description: "LINE公式アカウントを通じて予約リマインダーを送信", isActive: true, sortOrder: 1 },
        { key: "sms_pack", name: "SMS通知パック", price: 1980, description: "SMS（テキストメッセージ）でリマインダーを送信", isActive: true, sortOrder: 2 },
        { key: "recall", name: "患者リコール機能", price: 1980, description: "定期検診の自動リマインド管理", isActive: true, sortOrder: 3 },
        { key: "waitlist", name: "キャンセル待ち機能", price: 980, description: "キャンセル発生時に自動で次の患者へ通知", isActive: true, sortOrder: 4 },
        { key: "questionnaire", name: "問診票機能", price: 1980, description: "来院前のWeb問診票作成・管理", isActive: true, sortOrder: 5 },
      ]);
    }

    // Enable all addons for the default clinic
    const existingDefaults = await db.select().from(schema.clinicAddons).where(eq(schema.clinicAddons.clinicId, DEFAULT_CLINIC_ID));
    if (existingDefaults.length === 0) {
      const allAddons = await db.select().from(schema.addonDefinitions);
      if (allAddons.length > 0) {
        await db.insert(schema.clinicAddons).values(
          allAddons.map(a => ({ clinicId: DEFAULT_CLINIC_ID, addonKey: a.key }))
        );
      }
    }
  }

  async getClinic(clinicId: string = DEFAULT_CLINIC_ID): Promise<Clinic | undefined> {
    const result = await db.select().from(schema.clinics).where(eq(schema.clinics.id, clinicId)).limit(1);
    return result[0];
  }

  async getClinicBySlug(slug: string): Promise<Clinic | undefined> {
    const result = await db.select().from(schema.clinics).where(eq(schema.clinics.slug, slug)).limit(1);
    return result[0];
  }

  async getAllClinics(): Promise<Clinic[]> {
    return db.select().from(schema.clinics).orderBy(desc(schema.clinics.createdAt));
  }

  async upsertClinic(data: Partial<InsertClinic>, clinicId: string = DEFAULT_CLINIC_ID): Promise<Clinic> {
    const existing = await this.getClinic(clinicId);
    if (existing) {
      const result = await db.update(schema.clinics).set({ ...data, updatedAt: new Date() }).where(eq(schema.clinics.id, clinicId)).returning();
      return result[0];
    } else {
      const result = await db.insert(schema.clinics).values({ id: clinicId, name: data.name || "クリニック", ...data }).returning();
      return result[0];
    }
  }

  async createClinicFull(
    clinicData: { name: string; slug: string; phone?: string; address?: string; email?: string; planType?: string },
    adminData: { username: string; password: string },
    addonKeys: string[] = []
  ): Promise<{ clinic: Clinic; user: User }> {
    const [clinic] = await db.insert(schema.clinics).values({
      name: clinicData.name,
      slug: clinicData.slug,
      phone: clinicData.phone || "",
      address: clinicData.address || "",
      email: clinicData.email || "",
      planType: clinicData.planType || "free",
      isActive: true,
    }).returning();

    await db.insert(schema.businessHours).values([
      { clinicId: clinic.id, dayOfWeek: 0, openTime: "09:00", closeTime: "17:00", isClosed: true },
      { clinicId: clinic.id, dayOfWeek: 1, openTime: "09:00", closeTime: "18:00", isClosed: false },
      { clinicId: clinic.id, dayOfWeek: 2, openTime: "09:00", closeTime: "18:00", isClosed: false },
      { clinicId: clinic.id, dayOfWeek: 3, openTime: "09:00", closeTime: "18:00", isClosed: false },
      { clinicId: clinic.id, dayOfWeek: 4, openTime: "09:00", closeTime: "18:00", isClosed: false },
      { clinicId: clinic.id, dayOfWeek: 5, openTime: "09:00", closeTime: "18:00", isClosed: false },
      { clinicId: clinic.id, dayOfWeek: 6, openTime: "09:00", closeTime: "14:00", isClosed: false },
    ]);

    await db.insert(schema.clinicSettings).values({
      clinicId: clinic.id,
      clinicName: clinicData.name,
      chairsCount: 5,
      bookingAdvanceDays: 60,
      bookingBufferMinutes: 15,
      allowDoubleBooking: false,
      maxConcurrentAppointments: 1,
      enablePatientConfirmation: true,
      confirmationDeadlineHours: 24,
      enableQrCheckin: false,
    });

    await db.insert(schema.reminderSettings).values({
      clinicId: clinic.id,
      enableEmail: true,
      enableSms: false,
      enableLine: false,
      reminderHoursBefore: 24,
    });

    const [user] = await db.insert(schema.users).values({
      username: adminData.username,
      password: adminData.password,
      clinicId: clinic.id,
      isSuperAdmin: false,
    }).returning();

    if (addonKeys.length > 0) {
      await db.insert(schema.clinicAddons).values(
        addonKeys.map(key => ({ clinicId: clinic.id, addonKey: key }))
      ).onConflictDoNothing();
    }

    return { clinic, user };
  }

  async updateClinicStatus(clinicId: string, isActive: boolean): Promise<Clinic | undefined> {
    const [result] = await db.update(schema.clinics).set({ isActive, updatedAt: new Date() }).where(eq(schema.clinics.id, clinicId)).returning();
    return result;
  }

  async updateClinicPlan(clinicId: string, planType: string): Promise<Clinic | undefined> {
    const [result] = await db.update(schema.clinics).set({ planType, updatedAt: new Date() }).where(eq(schema.clinics.id, clinicId)).returning();
    return result;
  }

  async getStaff(clinicId: string = DEFAULT_CLINIC_ID): Promise<Staff[]> {
    return db.select().from(schema.staff).where(eq(schema.staff.clinicId, clinicId)).orderBy(asc(schema.staff.sortOrder), asc(schema.staff.name));
  }

  async reorderStaff(clinicId: string, orderedIds: string[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.update(schema.staff)
        .set({ sortOrder: i + 1, updatedAt: new Date() })
        .where(and(eq(schema.staff.id, orderedIds[i]), eq(schema.staff.clinicId, clinicId)));
    }
  }

  async getStaffById(id: string): Promise<Staff | undefined> {
    const result = await db.select().from(schema.staff).where(eq(schema.staff.id, id)).limit(1);
    return result[0];
  }

  async getStaffByLoginToken(token: string): Promise<Staff | undefined> {
    const result = await db.select().from(schema.staff).where(eq(schema.staff.loginToken, token)).limit(1);
    return result[0];
  }

  async setStaffLoginToken(id: string, token: string | null): Promise<Staff | undefined> {
    const result = await db.update(schema.staff).set({ loginToken: token, updatedAt: new Date() }).where(eq(schema.staff.id, id)).returning();
    return result[0];
  }

  async createStaff(data: InsertStaff): Promise<Staff> {
    const result = await db.insert(schema.staff).values({ ...data }).returning();
    return result[0];
  }

  async updateStaff(id: string, data: Partial<InsertStaff>): Promise<Staff | undefined> {
    const result = await db.update(schema.staff).set({ ...data, updatedAt: new Date() }).where(eq(schema.staff.id, id)).returning();
    return result[0];
  }

  async deleteStaff(id: string): Promise<void> {
    await db.delete(schema.staff).where(eq(schema.staff.id, id));
  }

  async getShifts(filters: { clinicId: string; staffId?: string; month?: string; startDate?: string; endDate?: string }): Promise<(Shift & { staff?: Staff })[]> {
    const conditions = [eq(schema.shifts.clinicId, filters.clinicId)];
    if (filters.staffId) conditions.push(eq(schema.shifts.staffId, filters.staffId));
    if (filters.startDate) {
      conditions.push(gte(schema.shifts.date, filters.startDate));
    } else if (filters.month) {
      conditions.push(gte(schema.shifts.date, `${filters.month}-01`));
    }
    if (filters.endDate) {
      conditions.push(lte(schema.shifts.date, filters.endDate));
    } else if (filters.month) {
      const [y, m] = filters.month.split("-").map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      conditions.push(lte(schema.shifts.date, `${filters.month}-${String(lastDay).padStart(2, "0")}`));
    }
    const rows = await db.select().from(schema.shifts)
      .leftJoin(schema.staff, eq(schema.shifts.staffId, schema.staff.id))
      .where(and(...conditions))
      .orderBy(asc(schema.shifts.date));
    return rows.map(r => ({ ...r.shifts, staff: r.staff ?? undefined }));
  }

  async createShift(data: InsertShift & { reviewedAt?: Date; reviewedBy?: string }): Promise<Shift> {
    const result = await db.insert(schema.shifts).values(data).returning();
    return result[0];
  }

  async updateShift(id: string, data: Partial<InsertShift & { reviewedAt?: Date; reviewedBy?: string }>): Promise<Shift | undefined> {
    const result = await db.update(schema.shifts).set(data).where(eq(schema.shifts.id, id)).returning();
    return result[0];
  }

  async getShiftById(id: string): Promise<Shift | undefined> {
    const [row] = await db.select().from(schema.shifts).where(eq(schema.shifts.id, id));
    return row;
  }

  async deleteShift(id: string): Promise<void> {
    await db.delete(schema.shifts).where(eq(schema.shifts.id, id));
  }

  async getShiftPatterns(clinicId: string): Promise<ShiftPattern[]> {
    return db.select().from(schema.shiftPatterns)
      .where(eq(schema.shiftPatterns.clinicId, clinicId))
      .orderBy(asc(schema.shiftPatterns.sortOrder), asc(schema.shiftPatterns.createdAt));
  }

  async createShiftPattern(data: InsertShiftPattern): Promise<ShiftPattern> {
    const result = await db.insert(schema.shiftPatterns).values(data).returning();
    return result[0];
  }

  async updateShiftPattern(id: string, data: Partial<InsertShiftPattern>): Promise<ShiftPattern | undefined> {
    const result = await db.update(schema.shiftPatterns).set(data).where(eq(schema.shiftPatterns.id, id)).returning();
    return result[0];
  }

  async deleteShiftPattern(id: string): Promise<void> {
    await db.delete(schema.shiftPatterns).where(eq(schema.shiftPatterns.id, id));
  }

  async getShiftPatternById(id: string): Promise<ShiftPattern | undefined> {
    const result = await db.select().from(schema.shiftPatterns).where(eq(schema.shiftPatterns.id, id)).limit(1);
    return result[0];
  }

  async getPatients(clinicId: string = DEFAULT_CLINIC_ID, search?: string): Promise<Patient[]> {
    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      return db.select().from(schema.patients).where(
        and(
          eq(schema.patients.clinicId, clinicId),
          or(ilike(schema.patients.name, q), ilike(schema.patients.phone, q))
        )
      ).orderBy(asc(schema.patients.patientNumber));
    }
    return db.select().from(schema.patients).where(eq(schema.patients.clinicId, clinicId)).orderBy(asc(schema.patients.patientNumber));
  }

  async getPatientById(id: string): Promise<Patient | undefined> {
    const result = await db.select().from(schema.patients).where(eq(schema.patients.id, id)).limit(1);
    return result[0];
  }

  async createPatient(data: InsertPatient): Promise<Patient> {
    const cid = data.clinicId || DEFAULT_CLINIC_ID;
    const count = await db.select({ count: sql<number>`count(*)` }).from(schema.patients).where(eq(schema.patients.clinicId, cid));
    const num = Number(count[0].count) + 1;
    const patientNumber = `P-${String(num).padStart(4, "0")}`;
    let referralCode: string;
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    do {
      referralCode = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
      const existing = await db.select({ id: schema.patients.id }).from(schema.patients).where(eq(schema.patients.referralCode, referralCode));
      if (existing.length === 0) break;
    } while (true);
    const result = await db.insert(schema.patients).values({ ...data, clinicId: cid, patientNumber, referralCode }).returning();
    return result[0];
  }

  async updatePatient(id: string, data: Partial<InsertPatient>): Promise<Patient | undefined> {
    const result = await db.update(schema.patients).set({ ...data, updatedAt: new Date() }).where(eq(schema.patients.id, id)).returning();
    return result[0];
  }

  async deletePatient(id: string): Promise<void> {
    await db.delete(schema.patients).where(eq(schema.patients.id, id));
  }

  async getServices(clinicId: string = DEFAULT_CLINIC_ID): Promise<Service[]> {
    return db.select().from(schema.services).where(eq(schema.services.clinicId, clinicId)).orderBy(asc(schema.services.sortOrder), asc(schema.services.name));
  }

  async createService(data: InsertService): Promise<Service> {
    const result = await db.insert(schema.services).values({ ...data }).returning();
    return result[0];
  }

  async getServiceById(id: string): Promise<Service | undefined> {
    const result = await db.select().from(schema.services).where(eq(schema.services.id, id)).limit(1);
    return result[0];
  }

  async updateService(id: string, data: Partial<InsertService>): Promise<Service | undefined> {
    const result = await db.update(schema.services).set({ ...data, updatedAt: new Date() }).where(eq(schema.services.id, id)).returning();
    return result[0];
  }

  async deleteService(id: string): Promise<void> {
    await db.delete(schema.services).where(eq(schema.services.id, id));
  }

  async getAppointments(filters?: { clinicId?: string; date?: string; startDate?: string; endDate?: string; patientId?: string }): Promise<(Appointment & { patient?: Patient; staff?: Staff })[]> {
    const cid = filters?.clinicId || DEFAULT_CLINIC_ID;
    const rows = await db.query.appointments.findMany({
      where: (a, { eq, and, gte, lte }) => {
        const conditions = [eq(a.clinicId, cid)];
        if (filters?.date) conditions.push(eq(a.date, filters.date));
        if (filters?.startDate) conditions.push(gte(a.date, filters.startDate));
        if (filters?.endDate) conditions.push(lte(a.date, filters.endDate));
        if (filters?.patientId) conditions.push(eq(a.patientId, filters.patientId));
        return and(...conditions);
      },
      with: { patient: true, staff: true },
      orderBy: [asc(schema.appointments.date), asc(schema.appointments.startTime)],
    });
    return rows as any;
  }

  async getAppointmentById(id: string): Promise<(Appointment & { patient?: Patient; staff?: Staff }) | undefined> {
    const result = await db.query.appointments.findFirst({
      where: eq(schema.appointments.id, id),
      with: { patient: true, staff: true },
    });
    return result as any;
  }

  async checkAppointmentConflict(params: { clinicId: string; date: string; startTime: string; endTime: string; chairNumber?: number; excludeId?: string }): Promise<boolean> {
    const { clinicId, date, startTime, endTime, chairNumber, excludeId } = params;
    if (!chairNumber) return false;
    const rows = await db.select().from(schema.appointments).where(
      and(
        eq(schema.appointments.clinicId, clinicId),
        eq(schema.appointments.date, date),
        eq(schema.appointments.chairNumber, chairNumber),
        sql`${schema.appointments.status} NOT IN ('cancelled')`,
        sql`${schema.appointments.startTime} < ${endTime}`,
        sql`${schema.appointments.endTime} > ${startTime}`,
        excludeId ? sql`${schema.appointments.id} != ${excludeId}` : sql`true`
      )
    );
    return rows.length > 0;
  }

  async checkStaffConflict(params: { clinicId: string; date: string; startTime: string; endTime: string; staffId: string; excludeId?: string }): Promise<boolean> {
    const { clinicId, date, startTime, endTime, staffId, excludeId } = params;
    const rows = await db.select().from(schema.appointments).where(
      and(
        eq(schema.appointments.clinicId, clinicId),
        eq(schema.appointments.date, date),
        eq(schema.appointments.staffId, staffId),
        sql`${schema.appointments.status} NOT IN ('cancelled', 'no_show')`,
        sql`${schema.appointments.startTime} < ${endTime}`,
        sql`${schema.appointments.endTime} > ${startTime}`,
        excludeId ? sql`${schema.appointments.id} != ${excludeId}` : sql`true`
      )
    );
    return rows.length > 0;
  }

  async createAppointment(data: InsertAppointment): Promise<Appointment> {
    const result = await db.insert(schema.appointments).values({ ...data }).returning();
    return result[0];
  }

  async updateAppointment(id: string, data: Partial<InsertAppointment>): Promise<Appointment | undefined> {
    const result = await db.update(schema.appointments).set({ ...data, updatedAt: new Date() }).where(eq(schema.appointments.id, id)).returning();
    return result[0];
  }

  async deleteAppointment(id: string): Promise<void> {
    await db.delete(schema.appointments).where(eq(schema.appointments.id, id));
  }

  async getMedicalRecords(clinicId: string = DEFAULT_CLINIC_ID): Promise<(MedicalRecord & { patient?: Patient; staff?: Staff })[]> {
    const rows = await db.query.medicalRecords.findMany({
      where: eq(schema.medicalRecords.clinicId, clinicId),
      with: { patient: true, staff: true },
      orderBy: [desc(schema.medicalRecords.date)],
    });
    return rows as any;
  }

  async getMedicalRecordById(id: string): Promise<MedicalRecord | undefined> {
    const result = await db.select().from(schema.medicalRecords).where(eq(schema.medicalRecords.id, id)).limit(1);
    return result[0];
  }

  async createMedicalRecord(data: InsertMedicalRecord): Promise<MedicalRecord> {
    const result = await db.insert(schema.medicalRecords).values({ ...data }).returning();
    return result[0];
  }

  async deleteMedicalRecord(id: string): Promise<void> {
    await db.delete(schema.medicalRecords).where(eq(schema.medicalRecords.id, id));
  }

  async getBusinessHours(clinicId: string = DEFAULT_CLINIC_ID): Promise<BusinessHours[]> {
    return db.select().from(schema.businessHours).where(eq(schema.businessHours.clinicId, clinicId)).orderBy(asc(schema.businessHours.dayOfWeek));
  }

  async upsertBusinessHours(data: schema.BusinessHours[], clinicId: string = DEFAULT_CLINIC_ID): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(schema.businessHours).where(eq(schema.businessHours.clinicId, clinicId));
      if (data.length > 0) {
        await tx.insert(schema.businessHours).values(
          data.map(h => ({
            clinicId,
            dayOfWeek: h.dayOfWeek,
            openTime: h.openTime ?? null,
            closeTime: h.closeTime ?? null,
            afternoonOpenTime: h.afternoonOpenTime ?? null,
            afternoonCloseTime: h.afternoonCloseTime ?? null,
            isClosed: h.isClosed ?? false,
          }))
        );
      }
    });
  }

  async getHolidays(clinicId: string = DEFAULT_CLINIC_ID): Promise<Holiday[]> {
    return db.select().from(schema.holidays).where(eq(schema.holidays.clinicId, clinicId)).orderBy(asc(schema.holidays.date));
  }

  async createHoliday(data: InsertHolidaySchemaType): Promise<Holiday> {
    const result = await db.insert(schema.holidays).values({ ...data }).returning();
    return result[0];
  }

  async createHolidayBatch(data: { date: string; name?: string | null; reason?: string | null }[], clinicId: string = DEFAULT_CLINIC_ID): Promise<number> {
    if (data.length === 0) return 0;
    const existing = await this.getHolidays(clinicId);
    const existingDates = new Set(existing.map(h => h.date));
    const toInsert = data.filter(d => !existingDates.has(d.date));
    if (toInsert.length === 0) return 0;
    await db.insert(schema.holidays).values(toInsert.map(d => ({ ...d, clinicId })));
    return toInsert.length;
  }

  async deleteHoliday(id: string): Promise<void> {
    await db.delete(schema.holidays).where(eq(schema.holidays.id, id));
  }

  async getHolidayById(id: string): Promise<Holiday | undefined> {
    const result = await db.select().from(schema.holidays).where(eq(schema.holidays.id, id)).limit(1);
    return result[0];
  }

  async getClinicSettings(clinicId: string = DEFAULT_CLINIC_ID): Promise<ClinicSettings | undefined> {
    const result = await db.select().from(schema.clinicSettings).where(eq(schema.clinicSettings.clinicId, clinicId)).limit(1);
    return result[0];
  }

  async upsertClinicSettings(data: Partial<schema.ClinicSettings>, clinicId: string = DEFAULT_CLINIC_ID): Promise<ClinicSettings> {
    const existing = await this.getClinicSettings(clinicId);
    if (existing) {
      const result = await db.update(schema.clinicSettings).set({ ...data, updatedAt: new Date() }).where(eq(schema.clinicSettings.clinicId, clinicId)).returning();
      return result[0];
    } else {
      const result = await db.insert(schema.clinicSettings).values({ clinicId, ...data }).returning();
      return result[0];
    }
  }

  async getReminderSettings(clinicId: string = DEFAULT_CLINIC_ID): Promise<ReminderSettings | undefined> {
    const result = await db.select().from(schema.reminderSettings).where(eq(schema.reminderSettings.clinicId, clinicId)).limit(1);
    return result[0];
  }

  async upsertReminderSettings(data: Partial<ReminderSettings>, clinicId: string = DEFAULT_CLINIC_ID): Promise<ReminderSettings> {
    const existing = await this.getReminderSettings(clinicId);
    if (existing) {
      const result = await db.update(schema.reminderSettings).set({ ...data, updatedAt: new Date() }).where(eq(schema.reminderSettings.clinicId, clinicId)).returning();
      return result[0];
    } else {
      const result = await db.insert(schema.reminderSettings).values({ clinicId, ...data }).returning();
      return result[0];
    }
  }

  async getPatientByPhone(phone: string, clinicId: string = DEFAULT_CLINIC_ID): Promise<Patient | undefined> {
    const [patient] = await db.select().from(schema.patients)
      .where(and(eq(schema.patients.clinicId, clinicId), eq(schema.patients.phone, phone)));
    return patient;
  }

  async getPatientByReferralCode(referralCode: string): Promise<Patient | undefined> {
    const [patient] = await db.select().from(schema.patients)
      .where(eq(schema.patients.referralCode, referralCode.toUpperCase()));
    return patient;
  }

  async incrementReferralCount(patientId: string): Promise<void> {
    await db.update(schema.patients)
      .set({ referralCount: sql`referral_count + 1`, updatedAt: new Date() })
      .where(eq(schema.patients.id, patientId));
  }

  async setPatientPassword(patientId: string, hashedPassword: string): Promise<void> {
    await db.update(schema.patients)
      .set({ password: hashedPassword })
      .where(eq(schema.patients.id, patientId));
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser & { clinicId?: string | null; isSuperAdmin?: boolean }): Promise<User> {
    const [user] = await db.insert(schema.users).values({
      username: insertUser.username,
      password: insertUser.password,
      clinicId: insertUser.clinicId ?? null,
      isSuperAdmin: insertUser.isSuperAdmin ?? false,
    }).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(schema.users).set(data).where(eq(schema.users.id, id)).returning();
    return user;
  }

  async getUsersByClinicId(clinicId: string): Promise<User[]> {
    return db.select().from(schema.users).where(eq(schema.users.clinicId, clinicId));
  }

  async setUserPassword(id: string, hashedPassword: string): Promise<void> {
    await db.update(schema.users).set({ password: hashedPassword }).where(eq(schema.users.id, id));
  }

  async hasUsers(): Promise<boolean> {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(schema.users);
    return Number(result.count) > 0;
  }

  // ─── Waitlist ────────────────────────────────────────────────────────────────
  async addToWaitlist(data: InsertWaitlist): Promise<Waitlist> {
    const [entry] = await db.insert(schema.waitlist).values(data).returning();
    return entry;
  }

  async getWaitlist(clinicId: string): Promise<Waitlist[]> {
    return db.select().from(schema.waitlist)
      .where(eq(schema.waitlist.clinicId, clinicId))
      .orderBy(desc(schema.waitlist.createdAt));
  }

  async updateWaitlistEntry(id: string, data: Partial<InsertWaitlist>, clinicId: string): Promise<Waitlist | undefined> {
    const [entry] = await db.update(schema.waitlist).set(data)
      .where(and(eq(schema.waitlist.id, id), eq(schema.waitlist.clinicId, clinicId)))
      .returning();
    return entry;
  }

  async deleteWaitlistEntry(id: string, clinicId: string): Promise<void> {
    await db.delete(schema.waitlist)
      .where(and(eq(schema.waitlist.id, id), eq(schema.waitlist.clinicId, clinicId)));
  }

  // ─── Recall ──────────────────────────────────────────────────────────────────
  async getRecallPatients(clinicId: string): Promise<Patient[]> {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const dateStr = thirtyDaysFromNow.toISOString().split('T')[0];
    return db.select().from(schema.patients)
      .where(and(
        eq(schema.patients.clinicId, clinicId),
        lte(schema.patients.nextRecallDate, dateStr)
      ))
      .orderBy(asc(schema.patients.nextRecallDate));
  }

  async updatePatientRecall(id: string, data: { nextRecallDate?: string | null; recallIntervalMonths?: number }, clinicId: string): Promise<Patient | undefined> {
    const [patient] = await db.update(schema.patients).set({ ...data, updatedAt: new Date() })
      .where(and(eq(schema.patients.id, id), eq(schema.patients.clinicId, clinicId)))
      .returning();
    return patient;
  }

  async markRecallSent(id: string, clinicId: string): Promise<Patient | undefined> {
    const [patient] = await db.update(schema.patients)
      .set({ lastRecallSentAt: new Date(), updatedAt: new Date() })
      .where(and(eq(schema.patients.id, id), eq(schema.patients.clinicId, clinicId)))
      .returning();
    return patient;
  }

  // ─── Questionnaires ──────────────────────────────────────────────────────────
  async createQuestionnaire(data: InsertQuestionnaire): Promise<Questionnaire> {
    const [q] = await db.insert(schema.questionnaires).values(data).returning();
    return q;
  }

  async getQuestionnaires(clinicId: string): Promise<Questionnaire[]> {
    return db.select().from(schema.questionnaires)
      .where(eq(schema.questionnaires.clinicId, clinicId))
      .orderBy(desc(schema.questionnaires.submittedAt));
  }

  async getQuestionnaireByAppointment(appointmentId: string): Promise<Questionnaire | undefined> {
    const [q] = await db.select().from(schema.questionnaires)
      .where(eq(schema.questionnaires.appointmentId, appointmentId))
      .limit(1);
    return q;
  }

  // ─── Plan Definitions ────────────────────────────────────────────────────────
  async getPlanDefinitions(): Promise<PlanDefinition[]> {
    return db.select().from(schema.planDefinitions).orderBy(asc(schema.planDefinitions.sortOrder));
  }

  async createPlanDefinition(data: InsertPlanDefinition): Promise<PlanDefinition> {
    const [plan] = await db.insert(schema.planDefinitions).values(data).returning();
    return plan;
  }

  async updatePlanDefinition(id: string, data: Partial<InsertPlanDefinition>): Promise<PlanDefinition | undefined> {
    const [plan] = await db.update(schema.planDefinitions).set({ ...data, updatedAt: new Date() })
      .where(eq(schema.planDefinitions.id, id)).returning();
    return plan;
  }

  async deletePlanDefinition(id: string): Promise<void> {
    await db.delete(schema.planDefinitions).where(eq(schema.planDefinitions.id, id));
  }

  async getPlanDefinitionByKey(key: string): Promise<PlanDefinition | undefined> {
    const [plan] = await db.select().from(schema.planDefinitions).where(eq(schema.planDefinitions.key, key));
    return plan;
  }

  // ─── Addon Definitions ───────────────────────────────────────────────────────
  async getAddonDefinitions(): Promise<AddonDefinition[]> {
    return db.select().from(schema.addonDefinitions).orderBy(asc(schema.addonDefinitions.sortOrder));
  }

  async createAddonDefinition(data: InsertAddonDefinition): Promise<AddonDefinition> {
    const [addon] = await db.insert(schema.addonDefinitions).values(data).returning();
    return addon;
  }

  async updateAddonDefinition(id: string, data: Partial<InsertAddonDefinition>): Promise<AddonDefinition | undefined> {
    const [addon] = await db.update(schema.addonDefinitions).set(data)
      .where(eq(schema.addonDefinitions.id, id)).returning();
    return addon;
  }

  async deleteAddonDefinition(id: string): Promise<void> {
    await db.delete(schema.addonDefinitions).where(eq(schema.addonDefinitions.id, id));
  }

  // ─── Clinic Addons ───────────────────────────────────────────────────────────
  async getClinicAddons(clinicId: string): Promise<ClinicAddon[]> {
    return db.select().from(schema.clinicAddons).where(eq(schema.clinicAddons.clinicId, clinicId));
  }

  async deleteClinic(clinicId: string): Promise<void> {
    await db.delete(schema.clinics).where(eq(schema.clinics.id, clinicId));
  }

  async setClinicAddon(clinicId: string, addonKey: string, enabled: boolean): Promise<void> {
    if (enabled) {
      const [existing] = await db.select().from(schema.clinicAddons)
        .where(and(eq(schema.clinicAddons.clinicId, clinicId), eq(schema.clinicAddons.addonKey, addonKey)))
        .limit(1);
      if (!existing) {
        await db.insert(schema.clinicAddons).values({ clinicId, addonKey });
      }
    } else {
      await db.delete(schema.clinicAddons)
        .where(and(eq(schema.clinicAddons.clinicId, clinicId), eq(schema.clinicAddons.addonKey, addonKey)));
    }
  }

  // ─── Admin Notifications ──────────────────────────────────────────────────────
  async createAdminNotification(data: { clinicId: string; type: string; title: string; body?: string; appointmentId?: string }): Promise<AdminNotification> {
    const [row] = await db.insert(schema.adminNotifications).values({
      clinicId: data.clinicId,
      type: data.type,
      title: data.title,
      body: data.body ?? null,
      appointmentId: data.appointmentId ?? null,
    }).returning();
    return row;
  }

  async getAdminNotifications(clinicId: string, limit: number = 30): Promise<AdminNotification[]> {
    return db.select().from(schema.adminNotifications)
      .where(eq(schema.adminNotifications.clinicId, clinicId))
      .orderBy(desc(schema.adminNotifications.createdAt))
      .limit(limit);
  }

  async getUnreadNotificationCount(clinicId: string): Promise<number> {
    const [row] = await db.select({ count: sql<number>`count(*)::int` })
      .from(schema.adminNotifications)
      .where(and(
        eq(schema.adminNotifications.clinicId, clinicId),
        eq(schema.adminNotifications.isRead, false)
      ));
    return row?.count ?? 0;
  }

  async markAllNotificationsRead(clinicId: string): Promise<void> {
    await db.update(schema.adminNotifications)
      .set({ isRead: true })
      .where(and(
        eq(schema.adminNotifications.clinicId, clinicId),
        eq(schema.adminNotifications.isRead, false)
      ));
  }

  async getAttendanceToday(clinicId: string): Promise<(Attendance & { staff?: Staff })[]> {
    const today = new Date().toISOString().slice(0, 10);
    const rows = await db.select().from(schema.attendance)
      .where(and(eq(schema.attendance.clinicId, clinicId), eq(schema.attendance.date, today)))
      .orderBy(asc(schema.attendance.clockIn));
    const staffRows = await db.select().from(schema.staff).where(eq(schema.staff.clinicId, clinicId));
    const staffMap = Object.fromEntries(staffRows.map(s => [s.id, s]));
    return rows.map(r => ({ ...r, staff: staffMap[r.staffId] }));
  }

  async getAttendanceByStaff(staffId: string, date: string): Promise<Attendance | undefined> {
    const [row] = await db.select().from(schema.attendance)
      .where(and(eq(schema.attendance.staffId, staffId), eq(schema.attendance.date, date)));
    return row;
  }

  async clockIn(data: InsertAttendance): Promise<Attendance> {
    const [row] = await db.insert(schema.attendance).values(data).returning();
    return row;
  }

  async clockOut(id: string): Promise<Attendance | undefined> {
    const [row] = await db.update(schema.attendance)
      .set({ clockOut: new Date() })
      .where(eq(schema.attendance.id, id)).returning();
    return row;
  }

  async startBreak(id: string): Promise<Attendance | undefined> {
    const [row] = await db.update(schema.attendance)
      .set({ breakStart: new Date() })
      .where(eq(schema.attendance.id, id)).returning();
    return row;
  }

  async endBreak(id: string): Promise<Attendance | undefined> {
    const [row] = await db.update(schema.attendance)
      .set({ breakEnd: new Date() })
      .where(eq(schema.attendance.id, id)).returning();
    return row;
  }

  async getAttendanceById(id: string): Promise<Attendance | undefined> {
    const [row] = await db.select().from(schema.attendance)
      .where(eq(schema.attendance.id, id));
    return row;
  }

  async updateAttendance(id: string, data: Partial<{ clockIn: Date | null; clockOut: Date | null; breakStart: Date | null; breakEnd: Date | null; notes: string | null }>): Promise<Attendance | undefined> {
    const [row] = await db.update(schema.attendance)
      .set(data)
      .where(eq(schema.attendance.id, id)).returning();
    return row;
  }

  async getAttendanceByMonth(clinicId: string, month: string): Promise<(Attendance & { staff?: Staff })[]> {
    const startDate = `${month}-01`;
    const [y, m] = month.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const endDate = `${month}-${String(lastDay).padStart(2, "0")}`;
    const rows = await db.select().from(schema.attendance)
      .where(and(
        eq(schema.attendance.clinicId, clinicId),
        sql`${schema.attendance.date} >= ${startDate}`,
        sql`${schema.attendance.date} <= ${endDate}`,
      ))
      .orderBy(asc(schema.attendance.date), asc(schema.attendance.clockIn));
    const staffRows = await db.select().from(schema.staff).where(eq(schema.staff.clinicId, clinicId));
    const staffMap = Object.fromEntries(staffRows.map(s => [s.id, s]));
    return rows.map(r => ({ ...r, staff: staffMap[r.staffId] }));
  }
}

export const storage = new PgStorage();
