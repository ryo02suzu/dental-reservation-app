CREATE TABLE "addon_definitions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "addon_definitions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "admin_notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"clinic_id" varchar NOT NULL,
	"type" text DEFAULT 'new_booking' NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"appointment_id" varchar,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"clinic_id" varchar NOT NULL,
	"patient_id" varchar,
	"staff_id" varchar,
	"service_id" varchar,
	"date" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"treatment_type" text,
	"status" text DEFAULT 'confirmed',
	"confirmation_status" text DEFAULT 'pending',
	"chair_number" integer,
	"notes" text,
	"cancellation_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"clinic_id" varchar NOT NULL,
	"staff_id" varchar NOT NULL,
	"date" date NOT NULL,
	"clock_in" timestamp,
	"clock_out" timestamp,
	"break_start" timestamp,
	"break_end" timestamp,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "business_hours" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"clinic_id" varchar NOT NULL,
	"day_of_week" integer NOT NULL,
	"open_time" time,
	"close_time" time,
	"afternoon_open_time" time,
	"afternoon_close_time" time,
	"is_closed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "clinic_addons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"clinic_id" varchar NOT NULL,
	"addon_key" text NOT NULL,
	"enabled_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "clinic_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"clinic_id" varchar NOT NULL,
	"clinic_name" text,
	"chairs_count" integer DEFAULT 5,
	"booking_advance_days" integer DEFAULT 60,
	"booking_buffer_minutes" integer DEFAULT 15,
	"slot_interval_minutes" integer DEFAULT 30,
	"allow_double_booking" boolean DEFAULT false,
	"max_concurrent_appointments" integer DEFAULT 1,
	"enable_patient_confirmation" boolean DEFAULT true,
	"confirmation_deadline_hours" integer DEFAULT 24,
	"enable_qr_checkin" boolean DEFAULT false,
	"require_appointment_approval" boolean DEFAULT false,
	"closed_on_holidays" boolean DEFAULT true,
	"enable_referral" boolean DEFAULT true,
	"resend_api_key" text,
	"primary_color" text DEFAULT '#C4B5A0',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "clinics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"plan_type" text DEFAULT 'free',
	"is_active" boolean DEFAULT true,
	"phone" text,
	"email" text,
	"address" text,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "clinics_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "holidays" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"clinic_id" varchar NOT NULL,
	"date" date NOT NULL,
	"name" text,
	"reason" text,
	"start_time" time,
	"end_time" time,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "medical_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"clinic_id" varchar NOT NULL,
	"patient_id" varchar,
	"appointment_id" varchar,
	"staff_id" varchar,
	"date" date NOT NULL,
	"diagnosis" text,
	"treatment" text,
	"treatment_details" text,
	"tooth_number" text,
	"cost" integer DEFAULT 0,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"clinic_id" varchar NOT NULL,
	"patient_number" text,
	"name" text NOT NULL,
	"name_kana" text,
	"date_of_birth" date,
	"gender" text,
	"phone" text,
	"email" text,
	"address" text,
	"allergies" text,
	"medical_notes" text,
	"cancellation_count" integer DEFAULT 0,
	"no_show_count" integer DEFAULT 0,
	"last_visit_date" date,
	"next_recall_date" date,
	"last_recall_sent_at" timestamp,
	"recall_interval_months" integer DEFAULT 6,
	"line_user_id" text,
	"password" text,
	"referral_code" text,
	"referred_by" text,
	"referral_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "patients_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "plan_definitions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"max_appointments_per_month" integer,
	"max_staff" integer,
	"features" text[],
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "plan_definitions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "questionnaires" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"clinic_id" varchar NOT NULL,
	"appointment_id" varchar,
	"patient_id" varchar,
	"patient_name" text,
	"chief_complaint" text,
	"pain_level" integer,
	"pain_location" text,
	"medical_history" text,
	"current_medications" text,
	"allergies" text,
	"is_pregnant" boolean DEFAULT false,
	"last_dental_visit" text,
	"brushing_frequency" text,
	"anxiety_level" integer,
	"notes" text,
	"submitted_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reminder_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"clinic_id" varchar NOT NULL,
	"enable_email" boolean DEFAULT true,
	"enable_sms" boolean DEFAULT false,
	"enable_line" boolean DEFAULT false,
	"reminder_hours_before" integer DEFAULT 24,
	"line_channel_access_token" text,
	"line_channel_secret" text,
	"resend_api_key" text,
	"auto_reminder_enabled" boolean DEFAULT false,
	"reminder_send_time" text DEFAULT '09:00',
	"last_reminder_run_date" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"clinic_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"duration" integer DEFAULT 30 NOT NULL,
	"price" integer DEFAULT 0,
	"category" text,
	"sort_order" integer DEFAULT 99,
	"is_active" boolean DEFAULT true,
	"staff_role" text DEFAULT 'any',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shift_patterns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"clinic_id" varchar NOT NULL,
	"name" text NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"clinic_id" varchar NOT NULL,
	"staff_id" varchar NOT NULL,
	"pattern_id" varchar,
	"date" date NOT NULL,
	"start_time" time,
	"end_time" time,
	"status" text DEFAULT 'requested' NOT NULL,
	"notes" text,
	"submitted_at" timestamp DEFAULT now(),
	"reviewed_at" timestamp,
	"reviewed_by" text
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"clinic_id" varchar NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"job_title" text,
	"employment_type" text DEFAULT 'fulltime',
	"show_in_calendar" boolean DEFAULT true,
	"email" text,
	"phone" text,
	"max_concurrent_appointments" integer DEFAULT 1,
	"sort_order" integer DEFAULT 0,
	"login_token" text,
	"hourly_rate" integer,
	"pin" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "staff_login_token_unique" UNIQUE("login_token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"clinic_id" varchar,
	"is_super_admin" boolean DEFAULT false,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "waitlist" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"clinic_id" varchar NOT NULL,
	"patient_name" text NOT NULL,
	"patient_phone" text NOT NULL,
	"patient_email" text,
	"service_id" varchar,
	"preferred_date" date,
	"preferred_time_from" time,
	"preferred_time_to" time,
	"notes" text,
	"status" varchar DEFAULT 'waiting',
	"notified_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "admin_notifications" ADD CONSTRAINT "admin_notifications_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_hours" ADD CONSTRAINT "business_hours_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinic_addons" ADD CONSTRAINT "clinic_addons_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinic_settings" ADD CONSTRAINT "clinic_settings_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questionnaires" ADD CONSTRAINT "questionnaires_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questionnaires" ADD CONSTRAINT "questionnaires_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questionnaires" ADD CONSTRAINT "questionnaires_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_settings" ADD CONSTRAINT "reminder_settings_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_patterns" ADD CONSTRAINT "shift_patterns_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_pattern_id_shift_patterns_id_fk" FOREIGN KEY ("pattern_id") REFERENCES "public"."shift_patterns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;