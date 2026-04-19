import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import AssessmentsPage from "./pages/AssessmentsPage";
import ReportsPage from "./pages/ReportsPage";
import RunAssessmentPage from "./pages/RunAssessmentPage";
import PatientDashboardPage from "./pages/PatientDashboardPage";
import MyAssessmentsPage from "./pages/MyAssessmentsPage";
import MyReportsPage from "./pages/MyReportsPage";
import Layout from "./layouts/Layout";

function PrivateRoute({ children }) {
  const token = localStorage.getItem("accessToken");
  return token ? children : <Navigate to="/login" replace />;
}

function RoleRedirect() {
  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  })();
  if (!user) return <Navigate to="/login" replace />;
  return user.role === "PATIENT" ? (
    <Navigate to="/my-health" replace />
  ) : (
    <Navigate to="/dashboard" replace />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<RoleRedirect />} />

          {/* ── Staff routes ── */}
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="assessments" element={<AssessmentsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="run-assessment" element={<RunAssessmentPage />} />

          {/* ── Patient routes ── */}
          <Route path="my-health" element={<PatientDashboardPage />} />
          <Route path="my-assessments" element={<MyAssessmentsPage />} />
          <Route path="my-reports" element={<MyReportsPage />} />
        </Route>
        <Route path="*" element={<RoleRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}
