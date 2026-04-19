import { useState, useEffect } from "react";
import { getAssessments, getReports } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { getPatientsForStaff } from "../data/seedData";
import Card from "../components/Card";
import RiskBadge from "../components/RiskBadge";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
} from "recharts";

const RISK_COLOR = {
  LOW: "#22c55e",
  MODERATE: "#eab308",
  HIGH: "#f97316",
  CRITICAL: "#ef4444",
};

export default function DashboardPage() {
  const { user } = useAuth();

  // Patients assigned to this doctor
  const myPatients = getPatientsForStaff(user);

  const [selectedPatient, setSelectedPatient] = useState(myPatients[0] || null);
  const [assessments, setAssessments] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedPatient) return;
    localStorage.setItem("patientId", selectedPatient.patientId);
    setLoading(true);
    Promise.all([
      getAssessments(selectedPatient.patientId, {
        limit: 6,
        sortOrder: "desc",
      }),
      getReports(selectedPatient.patientId, { limit: 3 }),
    ])
      .then(([aRes, rRes]) => {
        setAssessments(aRes.data.data || []);
        setReports(rRes.data.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedPatient]);

  const latest = assessments[0];

  const chartData = [...assessments].reverse().map((a) => ({
    date: new Date(a.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    score: Math.round(a.riskScore),
  }));

  const radialData = latest
    ? [
        {
          name: "Risk",
          value: Math.round(latest.riskScore),
          fill: RISK_COLOR[latest.riskLevel],
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Welcome back, {user?.name}
        </p>
      </div>

      {/* My Patients panel */}
      <Card title="My Patients">
        {myPatients.length === 0 ? (
          <EmptyState message="No patients assigned" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {myPatients.map((p) => (
              <button
                key={p.patientId}
                onClick={() => setSelectedPatient(p)}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                  selectedPatient?.patientId === p.patientId
                    ? "border-primary-500 bg-primary-50"
                    : "border-gray-200 hover:border-primary-300 bg-white"
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-lg flex-shrink-0">
                  🧑
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {p.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">Age {p.age}</p>
                  <div className="mt-1">
                    <RiskBadge level={p.riskLevel} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Selected patient data */}
      {selectedPatient && (
        <>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-800">
              {selectedPatient.name}'s Assessment
            </h2>
            <RiskBadge level={selectedPatient.riskLevel} />
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <Spinner size="lg" />
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    Assessments
                  </p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {assessments.length}
                  </p>
                </Card>
                <Card>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    Reports
                  </p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {reports.length}
                  </p>
                </Card>
                <Card>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    Latest Risk
                  </p>
                  <div className="mt-2">
                    {latest ? (
                      <RiskBadge level={latest.riskLevel} />
                    ) : (
                      <span className="text-gray-400 text-sm">—</span>
                    )}
                  </div>
                </Card>
              </div>

              {/* Charts */}
              {latest ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card title="Current Risk Score">
                    <div className="flex items-center gap-6">
                      <div className="h-36 w-36 flex-shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadialBarChart
                            innerRadius="60%"
                            outerRadius="100%"
                            data={radialData}
                            startAngle={90}
                            endAngle={90 - (latest.riskScore / 100) * 360}
                          >
                            <RadialBar dataKey="value" cornerRadius={6} />
                            <Tooltip formatter={(v) => [`${v}/100`, "Score"]} />
                          </RadialBarChart>
                        </ResponsiveContainer>
                      </div>
                      <div>
                        <p
                          className="text-4xl font-bold"
                          style={{ color: RISK_COLOR[latest.riskLevel] }}
                        >
                          {Math.round(latest.riskScore)}
                        </p>
                        <p className="text-gray-400 text-sm">out of 100</p>
                        <div className="mt-2">
                          <RiskBadge level={latest.riskLevel} />
                        </div>
                      </div>
                    </div>
                  </Card>

                  <Card title="Score History">
                    {chartData.length > 1 ? (
                      <ResponsiveContainer width="100%" height={140}>
                        <BarChart
                          data={chartData}
                          margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#f0f0f0"
                          />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Bar
                            dataKey="score"
                            fill="#14b8a6"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyState message="Need more assessments for trend" />
                    )}
                  </Card>
                </div>
              ) : (
                <Card>
                  <EmptyState message="No assessments found for this patient" />
                </Card>
              )}

              {/* Latest report */}
              {reports[0] && (
                <Card title="Latest Health Report">
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {reports[0].summary}
                  </p>
                  {reports[0].recommendations?.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {reports[0].recommendations.map((r, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm text-gray-600"
                        >
                          <span className="text-primary-500 mt-0.5 flex-shrink-0">
                            ✓
                          </span>
                          {r}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
