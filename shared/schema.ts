import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, date, time, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const clinics = pgTable("clinics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  planType: text("plan_type").default("free"),
  isActive: boolean("is_active").default(true),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const staff = pgTable("staff", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  clinicId: varchar("clinic_id").notNull().references(() => clinics.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  role: text("role").notNull(),
  jobTitle: text("job_title"),
  employmentType: text("employment_type").default("fulltime"),
  showInCalendar: boolean("show_in_calendar").default(true),
  email: text("email"),
  phone: text("phone"),
  maxConcurrentAppointments: integer("max_concurrent_appointments").default(1),
  sortOrder: integer("sort_order").default(0),
  loginToken: text("login_token").unique(),
  hourlyRate: integer("hourly_rate"),
  pin: text("pin"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const shiftPatterns = pgTable("shift_patterns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  clinicId: varchar("clinic_id").notNull().references(() => clinics.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const shifts = pgTable("shifts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  clinicId: varchar("clinic_id").notNull().references(() => clinics.id, { onDelete: "cascade" }),
  staffId: varchar("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  patternId: varchar("pattern_id").references(() => shiftPatterns.id, { onDelete: "set null" }),
  date: date("date").notNull(),
  startTime: time("start_time"),
  endTime: time("end_time"),
  status: text("status").notNull().default("requested"),
  notes: text("notes"),
  submittedAt: timestamp("submitted_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: text("reviewed_by"),
});

export const patients = pgTable("patients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  clinicId: varchar("clinic_id").notNull().references(() => clinics.id, { onDelete: "cascade" }),
  patientNumber: text("patient_number"),
  name: text("name").notNull(),
  nameKana: text("name_kana"),
  dateOfBirth: date("date_of_birth"),
  gender: text("gender"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  allergies: text("allergies"),
  medicalNotes: text("medical_notes"),
  cancellationCount: integer("cancellation_count").default(0),
  noShowCount: integer("no_show_count").default(0),
  lastVisitDate: date("last_visit_date"),
  nextRecallDate: date("next_recall_date"),
  lastRecallSentAt: timestamp("last_recall_sent_at"),
  recallIntervalMonths: integer("recall_interval_months").default(6),
  lineUserId: text("line_user_id"),
  password: text("password"),
  referralCode: text("referral_code").unique(),
  referredBy: text("referred_by"),
  referralCount: integer("referral_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const services = pgTable("services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  clinicId: varchar("clinic_id").notNull().references(() => clinics.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  duration: integer("duration").notNull().default(30),
  price: integer("price").default(0),
  category: text("category"),
  sortOrder: integer("sort_order").default(99),
  isActive: boolean("is_active").default(true),
  staffRole: text("staff_role").default("any"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const appointments = pgTable("appointments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  clinicId: varchar("clinic_id").notNull().references(() => clinics.id, { onDelete: "cascade" }),
  patientId: varchar("patient_id").references(() => patients.id, { onDelete: "set null" }),
  staffId: varchar("staff_id").references(() => staff.id, { onDelete: "set null" }),
  serviceId: varchar("service_id").references(() => services.id, { onDelete: "set null" }),
  date: date("date").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  treatmentType: text("treatment_type"),
  status: text("status").default("confirmed"),
  confirmationStatus: text("confirmation_status").default("pending"),
  chairNumber: integer("chair_number"),
  notes: text("notes"),
  cancellationReason: text("cancellation_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const medicalRecords = pgTable("medical_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  clinicId: varchar("clinic_id").notNull().references(() => clinics.id, { onDelete: "cascade" }),
  patientId: varchar("patient_id").references(() => patients.id, { onDelete: "cascade" }),
  appointmentId: varchar("appointment_id").references(() => appointments.id, { onDelete: "set null" }),
  staffId: varchar("staff_id").references(() => staff.id, { onDelete: "set null" }),
  date: date("date").notNull(),
  diagnosis: text("diagnosis"),
  treatment: text("treatment"),
  treatmentDetails: text("treatment_details"),
  toothNumber: text("tooth_number"),
  cost: integer("cost").default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const businessHours = pgTable("business_hours", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  clinicId: varchar("clinic_id").notNull().references(() => clinics.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(),
  openTime: time("open_time"),
  closeTime: time("close_time"),
  afternoonOpenTime: time("afternoon_open_time"),
  afternoonCloseTime: time("afternoon_close_time"),
  isClosed: boolean("is_closed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const holidays = pgTable("holidays", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  clinicId: varchar("clinic_id").notNull().references(() => clinics.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  name: text("name"),
  reason: text("reason"),
  startTime: time("start_time"),
  endTime: time("end_time"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const clinicSettings = pgTable("clinic_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  clinicId: varchar("clinic_id").notNull().references(() => clinics.id, { onDelete: "cascade" }),
  clinicName: text("clinic_name"),
  chairsCount: integer("chairs_count").default(5),
  bookingAdvanceDays: integer("booking_advance_days").default(60),
  bookingBufferMinutes: integer("booking_buffer_minutes").default(15),
  slotIntervalMinutes: integer("slot_interval_minutes").default(30),
  allowDoubleBooking: boolean("allow_double_booking").default(false),
  maxConcurrentAppointments: integer("max_concurrent_appointments").default(1),
  enablePatientConfirmation: boolean("enable_patient_confirmation").default(true),
  confirmationDeadlineHours: integer("confirmation_deadline_hours").default(24),
  enableQrCheckin: boolean("enable_qr_checkin").default(false),
  requireAppointmentApproval: boolean("require_appointment_approval").default(false),
  closedOnHolidays: boolean("closed_on_holidays").default(true),
  enableReferral: boolean("enable_referral").default(true),
  resendApiKey: text("resend_api_key"),
  primaryColor: text("primary_color").default("#C4B5A0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const waitlist = pgTable("waitlist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  clinicId: varchar("clinic_id").notNull().references(() => clinics.id, { onDelete: "cascade" }),
  patientName: text("patient_name").notNull(),
  patientPhone: text("patient_phone").notNull(),
  patientEmail: text("patient_email"),
  serviceId: varchar("service_id").references(() => services.id, { onDelete: "set null" }),
  preferredDate: date("preferred_date"),
  preferredTimeFrom: time("preferred_time_from"),
  preferredTimeTo: time("preferred_time_to"),
  notes: text("notes"),
  status: varchar("status").default("waiting"),
  notifiedAt: timestamp("notified_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const questionnaires = pgTable("questionnaires", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  clinicId: varchar("clinic_id").notNull().references(() => clinics.id, { onDelete: "cascade" }),
  appointmentId: varchar("appointment_id").references(() => appointments.id, { onDelete: "set null" }),
  patientId: varchar("patient_id").references(() => patients.id, { onDelete: "set null" }),
  patientName: text("patient_name"),
  chiefComplaint: text("chief_complaint"),
  painLevel: integer("pain_level"),
  painLocation: text("pain_location"),
  medicalHistory: text("medical_history"),
  currentMedications: text("current_medications"),
  allergies: text("allergies"),
  isPregnant: boolean("is_pregnant").default(false),
  lastDentalVisit: text("last_dental_visit"),
  brushingFrequency: text("brushing_frequency"),
  anxietyLevel: integer("anxiety_level"),
  notes: text("notes"),
  submittedAt: timestamp("submitted_at").defaultNow(),
});

export const reminderSettings = pgTable("reminder_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  clinicId: varchar("clinic_id").notNull().references(() => clinics.id, { onDelete: "cascade" }),
  enableEmail: boolean("enable_email").default(true),
  enableSms: boolean("enable_sms").default(false),
  enableLine: boolean("enable_line").default(false),
  reminderHoursBefore: integer("reminder_hours_before").default(24),
  lineChannelAccessToken: text("line_channel_access_token"),
  lineChannelSecret: text("line_channel_secret"),
  resendApiKey: text("resend_api_key"),
  autoReminderEnabled: boolean("auto_reminder_enabled").default(false),
  reminderSendTime: text("reminder_send_time").default("09:00"),
  lastReminderRunDate: text("last_reminder_run_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const planDefinitions = pgTable("plan_definitions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  price: integer("price").notNull().default(0),
  maxAppointmentsPerMonth: integer("max_appointments_per_month"),
  maxStaff: integer("max_staff"),
  features: text("features").array(),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const addonDefinitions = pgTable("addon_definitions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  price: integer("price").notNull().default(0),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const clinicAddons = pgTable("clinic_addons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  clinicId: varchar("clinic_id").notNull().references(() => clinics.id, { onDelete: "cascade" }),
  addonKey: text("addon_key").notNull(),
  enabledAt: timestamp("enabled_at").defaultNow(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  clinicId: varchar("clinic_id").references(() => clinics.id, { onDelete: "set null" }),
  isSuperAdmin: boolean("is_super_admin").default(false),
});

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  patient: one(patients, { fields: [appointments.patientId], references: [patients.id] }),
  staff: one(staff, { fields: [appointments.staffId], references: [staff.id] }),
  service: one(services, { fields: [appointments.serviceId], references: [services.id] }),
}));

export const medicalRecordsRelations = relations(medicalRecords, ({ one }) => ({
  patient: one(patients, { fields: [medicalRecords.patientId], references: [patients.id] }),
  staff: one(staff, { fields: [medicalRecords.staffId], references: [staff.id] }),
}));

export const patientsRelations = relations(patients, ({ many }) => ({
  appointments: many(appointments),
  medicalRecords: many(medicalRecords),
}));

export const staffRelations = relations(staff, ({ many }) => ({
  appointments: many(appointments),
  medicalRecords: many(medicalRecords),
  shifts: many(shifts),
}));

export const shiftsRelations = relations(shifts, ({ one }) => ({
  staff: one(staff, { fields: [shifts.staffId], references: [staff.id] }),
  clinic: one(clinics, { fields: [shifts.clinicId], references: [clinics.id] }),
  pattern: one(shiftPatterns, { fields: [shifts.patternId], references: [shiftPatterns.id] }),
}));

export const shiftPatternsRelations = relations(shiftPatterns, ({ one, many }) => ({
  clinic: one(clinics, { fields: [shiftPatterns.clinicId], references: [clinics.id] }),
  shifts: many(shifts),
}));

export const insertUserSchema = createInsertSchema(users).pick({ username: true, password: true });
export const insertClinicSchema = createInsertSchema(clinics).omit({ id: true, createdAt: true, updatedAt: true });
export const insertStaffSchema = createInsertSchema(staff).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPatientSchema = createInsertSchema(patients).omit({ id: true, createdAt: true, updatedAt: true });
export const insertServiceSchema = createInsertSchema(services).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAppointmentSchema = createInsertSchema(appointments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMedicalRecordSchema = createInsertSchema(medicalRecords).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBusinessHoursSchema = createInsertSchema(businessHours).omit({ id: true, createdAt: true, updatedAt: true });
export const insertHolidaySchema = createInsertSchema(holidays).omit({ id: true, createdAt: true });
export const insertClinicSettingsSchema = createInsertSchema(clinicSettings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWaitlistSchema = createInsertSchema(waitlist).omit({ id: true, createdAt: true });
export const insertQuestionnaireSchema = createInsertSchema(questionnaires).omit({ id: true, submittedAt: true });
export const insertPlanDefinitionSchema = createInsertSchema(planDefinitions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAddonDefinitionSchema = createInsertSchema(addonDefinitions).omit({ id: true, createdAt: true });
export const insertClinicAddonSchema = createInsertSchema(clinicAddons).omit({ id: true, enabledAt: true });
export const insertShiftSchema = createInsertSchema(shifts).omit({ id: true, submittedAt: true, reviewedAt: true });
export const insertShiftPatternSchema = createInsertSchema(shiftPatterns).omit({ id: true, createdAt: true });

export const adminNotifications = pgTable("admin_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  clinicId: varchar("clinic_id").notNull().references(() => clinics.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("new_booking"),
  title: text("title").notNull(),
  body: text("body"),
  appointmentId: varchar("appointment_id"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AdminNotification = typeof adminNotifications.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Clinic = typeof clinics.$inferSelect;
export type Staff = typeof staff.$inferSelect;
export type Patient = typeof patients.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type MedicalRecord = typeof medicalRecords.$inferSelect;
export type BusinessHours = typeof businessHours.$inferSelect;
export type Holiday = typeof holidays.$inferSelect;
export type ClinicSettings = typeof clinicSettings.$inferSelect;
export type ReminderSettings = typeof reminderSettings.$inferSelect;
export type Waitlist = typeof waitlist.$inferSelect;
export type Questionnaire = typeof questionnaires.$inferSelect;
export type PlanDefinition = typeof planDefinitions.$inferSelect;
export type AddonDefinition = typeof addonDefinitions.$inferSelect;
export type ClinicAddon = typeof clinicAddons.$inferSelect;
export type ShiftPattern = typeof shiftPatterns.$inferSelect;

export const attendance = pgTable("attendance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  clinicId: varchar("clinic_id").notNull().references(() => clinics.id, { onDelete: "cascade" }),
  staffId: varchar("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  clockIn: timestamp("clock_in"),
  clockOut: timestamp("clock_out"),
  breakStart: timestamp("break_start"),
  breakEnd: timestamp("break_end"),
  notes: text("notes"),
});

export const insertAttendanceSchema = createInsertSchema(attendance).omit({ id: true });

export type Attendance = typeof attendance.$inferSelect;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;

export type InsertClinic = z.infer<typeof insertClinicSchema>;
export type InsertStaff = z.infer<typeof insertStaffSchema>;
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type InsertService = z.infer<typeof insertServiceSchema>;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type InsertMedicalRecord = z.infer<typeof insertMedicalRecordSchema>;
export type InsertWaitlist = z.infer<typeof insertWaitlistSchema>;
export type InsertQuestionnaire = z.infer<typeof insertQuestionnaireSchema>;
export type InsertPlanDefinition = z.infer<typeof insertPlanDefinitionSchema>;
export type InsertAddonDefinition = z.infer<typeof insertAddonDefinitionSchema>;
export type Shift = typeof shifts.$inferSelect;
export type InsertShift = z.infer<typeof insertShiftSchema>;
export type InsertShiftPattern = z.infer<typeof insertShiftPatternSchema>;
