import { useState, useEffect } from "react";
import { getReports } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { resolvePatientId, getDoctorForPatient } from "../data/seedData";
import { usePagination } from "../hooks/usePagination";
import Card from "../components/Card";
import Pagination from "../components/Pagination";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";

export default function MyReportsPage() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const { page, limit, nextPage, prevPage } = usePagination(5);

  const patientId = user ? resolvePatientId(user) : null;
  const doctorName = user ? getDoctorForPatient(user.email) : "Your Doctor";

  useEffect(() => {
    if (!patientId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getReports(patientId, { page, limit, sortOrder: "desc" })
      .then(({ data: res }) => {
        setData(res.data || []);
        setPagination(res.pagination || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patientId, page, limit]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Reports</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Health reports prepared by{" "}
          <span className="font-medium text-primary-600">{doctorName}</span>
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner size="lg" />
        </div>
      ) : !patientId ? (
        <Card>
          <EmptyState message="Patient record not found." />
        </Card>
      ) : data.length === 0 ? (
        <Card>
          <EmptyState message="No reports available yet" />
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
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                      <span className="text-xs bg-primary-50 text-primary-600 px-2 py-0.5 rounded-full">
                        v{r.version}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {r.summary}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setExpanded(expanded === r.reportId ? null : r.reportId)
                    }
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium flex-shrink-0"
                  >
                    {expanded === r.reportId ? "Hide" : "View Recommendations"}
                  </button>
                </div>

                {expanded === r.reportId && r.recommendations?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                      Recommendations from {doctorName}
                    </p>
                    <ul className="space-y-2">
                      {r.recommendations.map((rec, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm text-gray-700"
                        >
                          <span className="text-primary-500 mt-0.5 flex-shrink-0 font-bold">
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
