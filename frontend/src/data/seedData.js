/**
 * Single source of truth for all seed data.
 * Keep in sync with src/db/seed.ts output.
 */

export const STAFF = [
  {
    name: "Dr. Sarah Collins",
    email: "staff2@hospital.com",
    password: "Staff2@123",
    role: "HEALTHCARE_STAFF",
    // Dr. Sarah manages: Charlie, Diana, Fatima
    patientIds: [
      "e2e86467-bd50-4aae-80f8-0b4c772b52fb",
      "d8bfa7ca-1400-4d6d-bb38-cb122047749c",
      "9abe40ac-b832-4eaa-873d-d01d45156dff",
    ],
  },
  {
    name: "Dr. Brian Patel",
    email: "staff1@hospital.com",
    password: "Staff@123",
    role: "HEALTHCARE_STAFF",
    // Dr. Brian manages: Edward, George
    patientIds: [
      "7c448430-0c64-442b-a5bb-9d468e093a5e",
      "b666b7ee-4762-4f2f-8111-9bf81da73681",
    ],
  },
];

export const PATIENTS = [
  {
    name: "Charlie",
    email: "charlie@patient.com",
    password: "Charlie@123",
    patientId: "e2e86467-bd50-4aae-80f8-0b4c772b52fb",
    doctor: "Dr. Sarah Collins",
    riskLevel: "LOW",
    age: 25,
  },
  {
    name: "Diana",
    email: "diana@patient.com",
    password: "Diana@123",
    patientId: "d8bfa7ca-1400-4d6d-bb38-cb122047749c",
    doctor: "Dr. Sarah Collins",
    riskLevel: "MODERATE",
    age: 45,
  },
  {
    name: "Edward",
    email: "edward@patient.com",
    password: "Edward@123",
    patientId: "7c448430-0c64-442b-a5bb-9d468e093a5e",
    doctor: "Dr. Brian Patel",
    riskLevel: "HIGH",
    age: 60,
  },
  {
    name: "Fatima",
    email: "fatima@patient.com",
    password: "Fatima@123",
    patientId: "9abe40ac-b832-4eaa-873d-d01d45156dff",
    doctor: "Dr. Sarah Collins",
    riskLevel: "CRITICAL",
    age: 72,
  },
  {
    name: "George",
    email: "george@patient.com",
    password: "George@123",
    patientId: "b666b7ee-4762-4f2f-8111-9bf81da73681",
    doctor: "Dr. Brian Patel",
    riskLevel: "MODERATE",
    age: 38,
  },
];

/** Given a logged-in patient user, return their patientId */
export function resolvePatientId(user) {
  if (!user) return null;
  // 1. Check localStorage cache (set fresh at login)
  const cached = localStorage.getItem(`pid_${user.userId}`);
  if (cached) return cached;
  // 2. Fall back to email lookup from seed data
  if (user.email) {
    const found = PATIENTS.find((p) => p.email === user.email);
    if (found) {
      localStorage.setItem(`pid_${user.userId}`, found.patientId);
      return found.patientId;
    }
  }
  // 3. Last resort: return first patient's ID (should never reach here)
  return PATIENTS[0]?.patientId ?? null;
}

/** Given a logged-in staff user, return their assigned patients */
export function getPatientsForStaff(user) {
  if (!user) return PATIENTS;
  const staff = STAFF.find((s) => s.email === user.email);
  if (!staff) return PATIENTS;
  return PATIENTS.filter((p) => staff.patientIds.includes(p.patientId));
}

/** Given a patient email, return their doctor's name */
export function getDoctorForPatient(email) {
  return (
    PATIENTS.find((p) => p.email === email)?.doctor ||
    "Your Healthcare Provider"
  );
}
