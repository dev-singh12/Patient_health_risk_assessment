import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const STAFF_NAV = [
  { to: "/dashboard", label: "Dashboard", icon: "🏠" },
  { to: "/assessments", label: "Assessments", icon: "📊" },
  { to: "/reports", label: "Reports", icon: "📋" },
  { to: "/run-assessment", label: "Run Assessment", icon: "▶️" },
];

const PATIENT_NAV = [
  { to: "/my-health", label: "My Health", icon: "🏥" },
  { to: "/my-assessments", label: "My Assessments", icon: "📊" },
  { to: "/my-reports", label: "My Reports", icon: "📋" },
];

export default function Layout() {
  const { user, signOut } = useAuth();
  const isPatient = user?.role === "PATIENT";
  const nav = isPatient ? PATIENT_NAV : STAFF_NAV;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-primary-700 text-white flex flex-col flex-shrink-0">
        <div className="px-6 py-5 border-b border-primary-600">
          <h1 className="text-lg font-bold leading-tight">Health Risk</h1>
          <p className="text-primary-200 text-xs mt-0.5">Assessment System</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary-500 text-white"
                    : "text-primary-100 hover:bg-primary-600"
                }`
              }
            >
              <span>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-primary-600">
          <div className="text-xs text-primary-200 mb-0.5 truncate font-medium">
            {user?.name}
          </div>
          <div className="text-xs text-primary-300 mb-3 truncate">
            {isPatient ? "Patient" : "Healthcare Staff"}
          </div>
          <button
            onClick={signOut}
            className="w-full text-xs bg-primary-600 hover:bg-primary-500 text-white py-2 rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
        <Outlet />
      </main>
    </div>
  );
}
