import { useState, useEffect } from "react";
import { getReports } from "../services/api";
import { usePagination } from "../hooks/usePagination";
import Card from "../components/Card";
import Pagination from "../components/Pagination";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";
import ErrorMessage from "../components/ErrorMessage";

export default function ReportsPage() {
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
  const [expanded, setExpanded] = useState(null);
  const { page, limit, nextPage, prevPage, reset } = usePagination(5);

  useEffect(() => {
    if (!patientId) return;
    setLoading(true);
    setError(null);
    getReports(patientId, { page, limit, sortOrder: "desc" })
      .then(({ data: res }) => {
        setData(res.data || []);
        setPagination(res.pagination || null);
      })
      .catch((err) =>
        setError(
          err.response?.data?.error?.message || "Failed to load reports",
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
    setExpanded(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Health Reports</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          View generated health reports by patient
        </p>
      </div>

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

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner size="lg" />
        </div>
      ) : !patientId ? (
        <Card>
          <EmptyState message="Enter a Patient ID above to load reports" />
        </Card>
      ) : data.length === 0 ? (
        <Card>
          <EmptyState message="No reports found for this patient" />
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {data.map((r) => (
              <Card key={r.reportId}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-400">
                        {new Date(r.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                        v{r.version}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed line-clamp-2">
                      {r.summary}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setExpanded(expanded === r.reportId ? null : r.reportId)
                    }
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium flex-shrink-0"
                  >
                    {expanded === r.reportId ? "Hide" : "Details"}
                  </button>
                </div>

                {expanded === r.reportId && r.recommendations?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Recommendations
                    </p>
                    <ul className="space-y-1.5">
                      {r.recommendations.map((rec, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm text-gray-600"
                        >
                          <span className="text-primary-500 mt-0.5 flex-shrink-0">
                            ✓
                          </span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            ))}
          </div>

          <Pagination
            pagination={pagination}
            onNext={() => nextPage(pagination?.hasNext)}
            onPrev={() => prevPage(pagination?.hasPrev)}
          />
        </>
      )}
    </div>
  );
}
