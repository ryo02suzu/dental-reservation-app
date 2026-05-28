# DentalFlow - Dental Clinic Management System

## Overview

DentalFlow is a multi-tenant, full-stack web application designed as a dental clinic management system for the Japanese market. It comprises an authenticated administration panel for staff and a public-facing booking and appointment management page for patients.

Key capabilities include:

- **Staff-facing Admin Panel**: Features a dashboard, calendar-based appointment scheduling, patient management, electronic medical records (カルテ), reporting, and comprehensive clinic settings.
- **Shift Management (Airシフト風 + シフトボード風)**: 
  - **Admin Shift Board** (`シフト表` sidebar menu): Full-month grid view with all staff × days. Role-based color coding (Dr=blue, DH=green, DA=orange). Per-staff monthly summary (days/hours). Per-day role breakdown with minimum staff warnings. Holiday/closed-day integration (grey-out). Batch approval, appointment conflict checking on delete, and print/PDF support.
  - **Staff Personal Page** (`/my-schedule` → Shift tab): Calendar-based shift submission with pattern selection. Monthly summary (approved/requested/rejected/hours). Holiday display. Batch date selection with notes.
  - **Shift Patterns**: Configurable time-slot patterns (e.g., 午前 09:00-13:00) accessible from shift board's pattern settings dialog.
  - **APIs**: `GET/POST /api/shifts`, `POST /api/shifts/batch-approve`, `GET /api/shifts/appointment-counts`, `GET /api/staff/my-shifts`, `GET/POST /api/shift-patterns`, `GET /api/staff/holidays`.
- **Attendance / Clock-In System (出退勤打刻 — QR + PIN認証)**:
  - **QR Clock-in**: Staff scan a rotating QR code (30-sec refresh) displayed on admin attendance panel. QR page shows staff list → staff selects name → enters 4-digit PIN → clock-in. No login required. Route: `/qr-clock-in/:token`.
  - **Staff Personal Page**: QR scanner button (opens camera to scan admin QR code). Break/clock-out buttons remain. Clock-out confirmation dialog prevents accidental logout. "勤怠" tab shows monthly attendance history with pay calculation.
  - **Admin Panel** (`出退勤` sidebar menu): Two tabs — "本日の出退勤" (real-time dashboard with QR display + edit buttons) and "月次レポート" (staff-by-staff monthly pay summary). SSE for instant updates + 3s polling fallback. Admin can edit any attendance record (clock-in/out/break times).
  - **PIN**: `pin` column on `staff` table (4-digit). Set via admin staff edit dialog. Used for QR clock-in identity verification.
  - **Hourly Rate**: `hourly_rate` column on `staff` table. Set via admin staff edit dialog. Used for automatic pay calculation.
  - **DB**: `attendance` table (id, clinic_id, staff_id, date, clock_in, clock_out, break_start, break_end, notes).
  - **Public APIs**: `POST /api/public/qr-staff-list` (token → staff list), `POST /api/public/qr-clock-in` (token + staffId + pin → clock-in).
  - **Auth APIs**: `GET /api/staff/my-attendance`, `POST /api/staff/clock-in` (requires session + qrToken), `POST /api/staff/clock-out`, `POST /api/staff/break-start`, `POST /api/staff/break-end`, `GET /api/attendance/today`, `GET /api/attendance/stream` (SSE), `GET /api/attendance/qr-token`, `PUT /api/attendance/:id` (admin edit), `GET /api/attendance/monthly?month=YYYY-MM` (admin report), `GET /api/staff/my-attendance-history?month=YYYY-MM`.
- **Patient-facing Public Pages**: Allows unauthenticated users to book appointments through a 5-step flow and manage existing appointments (lookup, cancel, reschedule, edit profile) using their phone number or by logging in.
- **Multi-tenant Architecture**: Supports multiple clinics, each with its unique URL slug and isolated data. A super administrator dashboard allows for clinic management, plan assignment, and option configuration.
- **Recall and Waitlist Management**: Includes features for managing patient recalls for regular check-ups and a waitlist for unavailable slots.
- **Digital Questionnaire**: Patients can fill out digital questionnaires after booking appointments, with data accessible to clinic staff.
- **Automated Reminders**: Integrates with external services for sending appointment reminders via email (Resend) and LINE Messaging API, with a configurable scheduler.

The system aims to streamline operations for dental clinics and enhance the patient experience with a Japanese-localized UI.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

- **Framework**: React (SPA) with TypeScript.
- **Routing**: `wouter` for client-side routing.
- **State Management**: TanStack Query (React Query v5) for data fetching and caching.
- **UI Components**: `shadcn/ui` (New York style) built on Radix UI and styled with Tailwind CSS v3.
- **Forms**: `react-hook-form` with `@hookform/resolvers` for validation.
- **Date Handling**: `date-fns` with Japanese locale.
- **Structure**: A single `Home` page component manages view switching internally.

### Backend

- **Runtime**: Node.js with TypeScript via `tsx`.
- **Framework**: Express v5 for RESTful API endpoints.
- **Development**: Vite integrated as a middleware for HMR in development.
- **Build**: Custom script utilizing Vite for client and esbuild for server, with selective dependency bundling.

### Data Layer

- **ORM**: Drizzle ORM with PostgreSQL dialect.
- **Database**: PostgreSQL via `pg` Pool.
- **Schema**: Defined in `shared/schema.ts`, including tables for `clinics`, `staff`, `patients`, `services`, `appointments`, `medical_records`, `waitlist`, `questionnaires`, `attendance`, and various clinic settings. UUIDs are used for identifiers.
- **Migrations**: Drizzle Kit.
- **Storage**: `server/storage.ts` provides an `IStorage` interface with a PostgreSQL (Drizzle) implementation, supporting `clinicId` for multi-tenancy.
- **Validation**: `drizzle-zod` generates Zod schemas from Drizzle table definitions.

### Shared Code

- The `shared/` directory contains `schema.ts`, used by both frontend and backend for type consistency.

### Authentication

- **Method**: Session-based authentication using `passport` (LocalStrategy), `express-session`, and `connect-pg-simple` (PostgreSQL session store).
- **Security**: Password hashing with `crypto.scrypt`.
- **User Management**: `users` table stores admin accounts. Includes first-run setup for initial admin creation.
- **Access Control**: Most `/api/*` routes require authentication, with exceptions for public and patient-facing APIs.
- **Frontend Integration**: `AuthProvider` and `useAuth` hook manage authentication state and protect routes.
- **Cookie Settings**: `secure: process.env.NODE_ENV === "production"`, `sameSite: production ? "none" : "lax"` — development uses non-secure cookies to support HTTP access (e.g., Playwright tests), production uses `Secure; SameSite=None` for HTTPS cross-origin support.

## External Dependencies

- **PostgreSQL**: Primary database.
- **Drizzle ORM + drizzle-kit**: ORM and migration tools.
- **Radix UI**: Headless UI component primitives.
- **TanStack Query v5**: Server state management.
- **Vite**: Frontend bundler and dev server.
- **esbuild**: Server-side production bundler.
- **wouter**: Client-side routing.
- **date-fns**: Date manipulation.
- **react-hook-form**: Form state management.
- **Recharts**: Charting library (for reports).
- **Tailwind CSS**: Utility-first CSS framework.
- **Resend**: Email sending service for reminders.
- **LINE Messaging API**: For sending LINE-based reminders.
- **nanoid**: Unique ID generation.
- **connect-pg-simple**: PostgreSQL-backed session store.