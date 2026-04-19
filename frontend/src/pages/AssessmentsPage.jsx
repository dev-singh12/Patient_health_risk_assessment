import { useState, useEffect } from "react";
import { getAssessments } from "../services/api";
import { usePagination } from "../hooks/usePagination";
import Card from "../components/Card";
import RiskBadge from "../components/RiskBadge";
import StatusBadge from "../components/StatusBadge";
import Pagination from "../components/Pagination";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";
import ErrorMessage from "../components/ErrorMessage";

export default function AssessmentsPage() {
  const [patientId, setPatientId] = useState(
    localStorage.getItem("patientId") || "",
  );
  const [inputId, setInputId] = useState(
    localStorage.getItem("patientId") || "",
  );
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { page, limit, nextPage, prevPage, reset } = usePagination(10);

  useEffect(() => {
    if (!patientId) return;
    setLoading(true);
    setError(null);
    getAssessments(patientId, { page, limit, sortOrder: "desc" })
      .then(({ data: res }) => {
        setData(res.data || []);
        setPagination(res.pagination || null);
      })
      .catch((err) =>
        setError(
          err.response?.data?.error?.message || "Failed to load assessments",
        ),
      )
      .finally(() => setLoading(false));
  }, [patientId, page, limit]);

  function handleSearch(e) {
    e.preventDefault();
    if (!inputId.trim()) return;
    localStorage.setItem("patientId", inputId.trim());
    setPatientId(inputId.trim());
    reset();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Assessments</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          View risk assessments by patient
        </p>
      </div>

      {/* Patient ID input */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={inputId}
          onChange={(e) => setInputId(e.target.value)}
          placeholder="Enter Patient ID (UUID)"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button
          type="submit"
          className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Load
        </button>
      </form>

      <ErrorMessage message={error} />

      <Card>
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner size="lg" />
          </div>
        ) : !patientId ? (
          <EmptyState message="Enter a Patient ID above to load assessments" />
        ) : data.length === 0 ? (
          <EmptyState message="No assessments found for this patient" />
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
                    <tr
                      key={a.assessmentId}
                      className="hover:bg-gray-50 transition-colors"
                    >
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
