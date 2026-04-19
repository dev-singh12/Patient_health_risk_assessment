import { useState, useEffect } from "react";
import { getAssessments, getReports } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { resolvePatientId, getDoctorForPatient } from "../data/seedData";
import Card from "../components/Card";
import RiskBadge from "../components/RiskBadge";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const RISK_COLOR = {
  LOW: "#22c55e",
  MODERATE: "#eab308",
  HIGH: "#f97316",
  CRITICAL: "#ef4444",
};

const IMPROVEMENT_TIPS = {
  LOW: [
    {
      icon: "🏃",
      title: "Keep Moving",
      desc: "Maintain at least 150 min of moderate exercise per week.",
    },
    {
      icon: "🥗",
      title: "Balanced Diet",
      desc: "Continue eating fruits, vegetables, and whole grains.",
    },
    {
      icon: "😴",
      title: "Quality Sleep",
      desc: "Aim for 7–9 hours of sleep per night.",
    },
    {
      icon: "🩺",
      title: "Annual Check-up",
      desc: "Schedule your yearly wellness visit.",
    },
  ],
  MODERATE: [
    {
      icon: "🏋️",
      title: "Increase Activity",
      desc: "Add 30 min of brisk walking 5 days a week.",
    },
    {
      icon: "🧂",
      title: "Reduce Sodium",
      desc: "Limit sodium to <2,300 mg/day. Avoid processed foods.",
    },
    {
      icon: "📊",
      title: "Monitor BP & Glucose",
      desc: "Check blood pressure and glucose every 3 months.",
    },
    {
      icon: "🚭",
      title: "Quit Smoking",
      desc: "Enrol in a cessation programme if you smoke.",
    },
    {
      icon: "🩺",
      title: "3-Month Follow-up",
      desc: "Book a follow-up within 3 months.",
    },
  ],
  HIGH: [
    {
      icon: "💊",
      title: "Medication Review",
      desc: "Discuss starting medication for hypertension/cholesterol.",
    },
    {
      icon: "👨‍⚕️",
      title: "Specialist Referral",
      desc: "Ask for a referral to a cardiologist or endocrinologist.",
    },
    {
      icon: "🚭",
      title: "Stop Smoking Now",
      desc: "Ask about nicotine replacement therapy.",
    },
    {
      icon: "🥦",
      title: "Structured Diet Plan",
      desc: "Work with a dietitian on a heart-healthy meal plan.",
    },
    {
      icon: "📅",
      title: "4-Week Follow-up",
      desc: "Return to your provider within 4 weeks.",
    },
  ],
  CRITICAL: [
    {
      icon: "🚨",
      title: "Seek Immediate Care",
      desc: "Contact your healthcare provider today — do not delay.",
    },
    {
      icon: "💊",
      title: "Intensive Treatment",
      desc: "You likely need immediate medication adjustment.",
    },
    {
      icon: "📡",
      title: "Continuous Monitoring",
      desc: "Daily monitoring of BP, glucose, and symptoms.",
    },
    {
      icon: "🚭",
      title: "Emergency Cessation",
      desc: "Stop smoking immediately.",
    },
    {
      icon: "🏥",
      title: "Consider Hospitalisation",
      desc: "Urgent outpatient review may be necessary.",
    },
  ],
};

export default function PatientDashboardPage() {
  const { user } = useAuth();
  const [assessments, setAssessments] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const patientId = user ? resolvePatientId(user) : null;
  const doctorName = user ? getDoctorForPatient(user.email) : "Your Doctor";

  useEffect(() => {
    if (!patientId) {
      setLoading(false);
      return;
    }
    Promise.all([
      getAssessments(patientId, { limit: 10, sortOrder: "asc" }),
      getReports(patientId, { limit: 5, sortOrder: "desc" }),
    ])
      .then(([aRes, rRes]) => {
        setAssessments(aRes.data.data || []);
        setReports(rRes.data.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patientId]);

  const latest = assessments[assessments.length - 1];
  const latestReport = reports[0];
  const tips = latest ? IMPROVEMENT_TIPS[latest.riskLevel] : [];
  const prev = assessments[assessments.length - 2];
  const delta =
    latest && prev ? Math.round(latest.riskScore - prev.riskScore) : null;

  const trendData = assessments.map((a) => ({
    date: new Date(a.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    score: Math.round(a.riskScore),
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!patientId) {
    return (
      <Card>
        <EmptyState message="Patient record not found. Contact your healthcare provider." />
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            My Health Overview
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Your personal risk assessment from{" "}
            <span className="font-medium text-primary-600">{doctorName}</span>
          </p>
        </div>
        {latest && (
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2">
            <span className="text-xs text-gray-500">Current Risk:</span>
            <RiskBadge level={latest.riskLevel} />
          </div>
        )}
      </div>

      {/* Score + trend */}
      {latest ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="sm:col-span-1">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
              Risk Score
            </p>
            <p
              className="text-5xl font-bold"
              style={{ color: RISK_COLOR[latest.riskLevel] }}
            >
              {Math.round(latest.riskScore)}
            </p>
            <p className="text-gray-400 text-sm mt-0.5">out of 100</p>
            <div className="mt-3">
              <RiskBadge level={latest.riskLevel} />
            </div>
            {delta !== null && (
              <p
                className={`text-xs mt-2 font-medium ${delta < 0 ? "text-green-600" : delta > 0 ? "text-red-500" : "text-gray-400"}`}
              >
                {delta < 0
                  ? `▼ ${Math.abs(delta)} pts improved`
                  : delta > 0
                    ? `▲ ${delta} pts increased`
                    : "No change"}
              </p>
            )}
          </Card>

          <Card className="sm:col-span-2" title="Score Trend">
            {trendData.length > 1 ? (
              <ResponsiveContainer width="100%" height={130}>
                <AreaChart
                  data={trendData}
                  margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="#14b8a6"
                    fill="url(#sg)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="More assessments needed to show trend" />
            )}
          </Card>
        </div>
      ) : (
        <Card>
          <EmptyState message="No assessments found yet" />
        </Card>
      )}

      {/* Improvement plan */}
      {tips.length > 0 && (
        <Card title="Your Improvement Plan">
          <p className="text-sm text-gray-500 mb-4">
            Based on your latest assessment from <strong>{doctorName}</strong>:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {tips.map((tip, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
              >
                <span className="text-2xl flex-shrink-0">{tip.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {tip.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                    {tip.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Latest doctor report */}
      {latestReport && (
        <Card title={`Latest Report from ${doctorName}`}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-gray-400">
              {new Date(latestReport.createdAt).toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
            <span className="text-xs bg-primary-50 text-primary-600 px-2 py-0.5 rounded-full font-medium">
              v{latestReport.version}
            </span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">
            {latestReport.summary}
          </p>
          {latestReport.recommendations?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Doctor's Recommendations
              </p>
              <ul className="space-y-2">
                {latestReport.recommendations.map((r, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-gray-700"
                  >
                    <span className="text-primary-500 mt-0.5 flex-shrink-0 font-bold">
                      ✓
                    </span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {/* Assessment history */}
      {assessments.length > 0 && (
        <Card title="Assessment History">
          <div className="space-y-2">
            {[...assessments].reverse().map((a) => (
              <div
                key={a.assessmentId}
                className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
              >
                <span className="text-sm text-gray-500">
                  {new Date(a.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-16 bg-gray-100 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full bg-primary-500"
                        style={{ width: `${a.riskScore}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 w-6 text-right">
                      {Math.round(a.riskScore)}
                    </span>
                  </div>
                  <RiskBadge level={a.riskLevel} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
