import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import ErrorMessage from "../components/ErrorMessage";
import Spinner from "../components/Spinner";
import { STAFF, PATIENTS } from "../data/seedData";

export default function LoginPage() {
  const [step, setStep] = useState("pick"); // "pick" | "form"
  const [roleType, setRoleType] = useState(null); // "staff" | "patient"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { signIn, loading, error } = useAuth();
  const navigate = useNavigate();

  function pickRole(type) {
    setRoleType(type);
    setEmail("");
    setPassword("");
    setStep("form");
  }

  function fillCredentials(email, password) {
    setEmail(email);
    setPassword(password);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const data = await signIn(email, password);
      navigate(data.user.role === "PATIENT" ? "/my-health" : "/dashboard");
    } catch {
      /* error shown via hook */
    }
  }

  const staffList = STAFF;
  const patientList = PATIENTS;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-primary-600 px-8 py-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-white/20 rounded-xl mb-3">
            <span className="text-white text-2xl">🏥</span>
          </div>
          <h1 className="text-xl font-bold text-white">
            Health Risk Assessment
          </h1>
          <p className="text-primary-200 text-xs mt-1">
            Patient Management System
          </p>
        </div>

        <div className="p-8">
          {/* ── Step 1: Role picker ── */}
          {step === "pick" && (
            <div className="space-y-4">
              <p className="text-center text-sm font-medium text-gray-600 mb-6">
                Who are you logging in as?
              </p>
              <button
                onClick={() => pickRole("staff")}
                className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 hover:border-primary-400 hover:bg-primary-50 rounded-xl transition-all group"
              >
                <div className="w-12 h-12 bg-primary-100 group-hover:bg-primary-200 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 transition-colors">
                  👨‍⚕️
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-800">
                    Healthcare Staff
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Doctors and administrators — manage patients and run
                    assessments
                  </p>
                </div>
                <span className="ml-auto text-gray-300 group-hover:text-primary-400 text-lg">
                  →
                </span>
              </button>

              <button
                onClick={() => pickRole("patient")}
                className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 hover:border-teal-400 hover:bg-teal-50 rounded-xl transition-all group"
              >
                <div className="w-12 h-12 bg-teal-100 group-hover:bg-teal-200 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 transition-colors">
                  🧑‍🤝‍🧑
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-800">Patient</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    View your personal risk assessments and doctor's
                    recommendations
                  </p>
                </div>
                <span className="ml-auto text-gray-300 group-hover:text-teal-400 text-lg">
                  →
                </span>
              </button>
            </div>
          )}

          {/* ── Step 2: Login form ── */}
          {step === "form" && (
            <div className="space-y-4">
              <button
                onClick={() => setStep("pick")}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-2 transition-colors"
              >
                ← Back
              </button>

              <p className="text-sm font-semibold text-gray-700">
                {roleType === "staff"
                  ? "👨‍⚕️ Healthcare Staff Login"
                  : "🧑 Patient Login"}
              </p>

              {/* Quick-fill credentials */}
              <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {roleType === "staff"
                    ? "Select your account:"
                    : "Select your account:"}
                </p>
                {(roleType === "staff" ? staffList : patientList).map((u) => (
                  <button
                    key={u.email}
                    onClick={() => fillCredentials(u.email, u.password)}
                    className={`w-full flex items-center px-3 py-2 rounded-lg text-xs transition-colors border ${
                      email === u.email
                        ? "bg-primary-500 text-white border-primary-500"
                        : "bg-white text-gray-700 border-gray-200 hover:border-primary-300 hover:bg-primary-50"
                    }`}
                  >
                    <span className="font-medium">{u.name}</span>
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <ErrorMessage message={error} />

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading && <Spinner size="sm" />}
                  {loading ? "Signing in…" : "Sign In"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
