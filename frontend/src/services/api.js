import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401 → clear storage and redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  },
);

// ── Auth ──────────────────────────────────────────────────────────────────
export const login = (email, password) =>
  api.post("/auth/login", { email, password });

export const logout = (refreshToken) =>
  api.post("/auth/logout", { refreshToken });

// ── Patients ──────────────────────────────────────────────────────────────
export const getPatient = (id) => api.get(`/patients/${id}`);

export const createPatient = (data) => api.post("/patients", data);

// Resolve patientId from userId by trying known patient IDs
// (used when a PATIENT role logs in — JWT has userId, not patientId)
export const resolvePatientId = async (userId) => {
  // The backend GET /patients/:id uses patientId, not userId.
  // We store a userId→patientId map in localStorage after first resolution.
  const cached = localStorage.getItem(`pid_${userId}`);
  if (cached) return cached;
  return null; // caller must handle via seed-known mapping
};

// ── Clinical Data ─────────────────────────────────────────────────────────
export const createClinicalData = (data) => api.post("/clinical-data", data);

// ── Assessments ───────────────────────────────────────────────────────────
export const getAssessments = (patientId, params = {}) =>
  api.get(`/assessments/${patientId}`, { params });

export const runAssessment = (patientId, idempotencyKey) =>
  api.post("/assessment/run", { patientId, idempotencyKey });

// ── Job Status ────────────────────────────────────────────────────────────
export const getJobStatus = (jobId) => api.get(`/jobs/${jobId}`);

// ── Reports ───────────────────────────────────────────────────────────────
export const getReports = (patientId, params = {}) =>
  api.get(`/reports/${patientId}`, { params });

export default api;
