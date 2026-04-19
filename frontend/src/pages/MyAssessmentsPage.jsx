import { useState, useEffect } from "react";
import { getAssessments } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { resolvePatientId } from "../data/seedData";
import { usePagination } from "../hooks/usePagination";
import Card from "../components/Card";
import RiskBadge from "../components/RiskBadge";
import StatusBadge from "../components/StatusBadge";
import Pagination from "../components/Pagination";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";

export default function MyAssessmentsPage() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { page, limit, nextPage, prevPage } = usePagination(10);

  const patientId = user ? resolvePatientId(user) : null;

  useEffect(() => {
    if (!patientId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getAssessments(patientId, { page, limit, sortOrder: "desc" })
      .then(({ data: res }) => {
        setData(res.data || []);
        setPagination(res.pagination || null);
      })
      .catch((err) =>
        setError(err.response?.data?.error?.message || "Failed to load"),
      )
      .finally(() => setLoading(false));
  }, [patientId, page, limit]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Assessments</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Your complete risk assessment history
        </p>
      </div>

      <Card>
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner size="lg" />
          </div>
        ) : !patientId ? (
          <EmptyState message="Patient record not found. Contact your healthcare provider." />
        ) : data.length === 0 ? (
          <EmptyState message="No assessments found yet" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">
                      Date
                    </th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">
                      Score
                    </th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">
                      Risk Level
                    </th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.map((a) => (
                    <tr key={a.assessmentId} className="hover:bg-gray-50">
                      <td className="py-3 px-3 text-gray-600">
                        {new Date(a.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-100 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full bg-primary-500"
                              style={{ width: `${a.riskScore}%` }}
                            />
                          </div>
                          <span className="font-semibold text-gray-800">
                            {Math.round(a.riskScore)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <RiskBadge level={a.riskLevel} />
                      </td>
                      <td className="py-3 px-3">
                        <StatusBadge status={a.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              pagination={pagination}
              onNext={() => nextPage(pagination?.hasNext)}
              onPrev={() => prevPage(pagination?.hasPrev)}
            />
          </>
        )}
      </Card>
    </div>
  );
}
