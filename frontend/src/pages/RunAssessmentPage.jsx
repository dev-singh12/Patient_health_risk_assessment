import { useState, useEffect, useRef } from "react";
import { runAssessment, getJobStatus } from "../services/api";
import Card from "../components/Card";
import Spinner from "../components/Spinner";
import RiskBadge from "../components/RiskBadge";
import ErrorMessage from "../components/ErrorMessage";

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 30;

export default function RunAssessmentPage() {
  const [patientId, setPatientId] = useState(
    localStorage.getItem("patientId") || "",
  );
  const [jobId, setJobId] = useState(null);
  const [jobState, setJobState] = useState(null); // "waiting"|"active"|"completed"|"failed"
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const pollCount = useRef(0);
  const pollTimer = useRef(null);

  // Stop polling on unmount
  useEffect(() => () => clearTimeout(pollTimer.current), []);

  function stopPolling() {
    clearTimeout(pollTimer.current);
  }

  function poll(id) {
    pollTimer.current = setTimeout(async () => {
      pollCount.current += 1;
      if (pollCount.current > MAX_POLLS) {
        setError(
          "Assessment is taking longer than expected. Check back later.",
        );
        setJobState("timeout");
        return;
      }
      try {
        const { data } = await getJobStatus(id);
        setJobState(data.state);
        if (data.state === "completed") {
          setResult(data.result);
          stopPolling();
        } else if (data.state === "failed") {
          setError(`Job failed: ${data.failedReason || "Unknown error"}`);
          stopPolling();
        } else {
          poll(id); // keep polling
        }
      } catch {
        poll(id); // retry on transient error
      }
    }, POLL_INTERVAL_MS);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!patientId.trim()) return;

    setLoading(true);
    setError(null);
    setJobId(null);
    setJobState(null);
    setResult(null);
    pollCount.current = 0;

    localStorage.setItem("patientId", patientId.trim());

    const idempotencyKey = `frontend-${patientId.trim()}-${Date.now()}`;

    try {
      const { data } = await runAssessment(patientId.trim(), idempotencyKey);

      // Cached result returned immediately
      if (data.assessmentId) {
        setResult(data);
        setJobState("completed");
        return;
      }

      // Async job enqueued
      if (data.jobId) {
        setJobId(data.jobId);
        setJobState("waiting");
        poll(data.jobId);
      }
    } catch (err) {
      setError(
        err.response?.data?.error?.message || "Failed to start assessment",
      );
    } finally {
      setLoading(false);
    }
  }

  const isPolling =
    jobId && !["completed", "failed", "timeout"].includes(jobState);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Run Assessment</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Trigger a health risk assessment pipeline for a patient
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Patient ID
            </label>
            <input
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              placeholder="e.g. 44bba161-1e54-4c74-bba9-cd7e05b28a13"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              The patient must have clinical data uploaded before running an
              assessment.
            </p>
          </div>

          <ErrorMessage message={error} />

          <button
            type="submit"
            disabled={loading || isPolling}
            className="w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {(loading || isPolling) && <Spinner size="sm" />}
            {loading
              ? "Submitting…"
              : isPolling
                ? "Processing…"
                : "Run Assessment"}
          </button>
        </form>
      </Card>

      {/* Job status */}
      {jobId && (
        <Card title="Job Status">
          <div className="flex items-center gap-3">
            {isPolling && <Spinner size="sm" />}
            <div>
              <p className="text-xs text-gray-500">
                Job ID: <span className="font-mono">{jobId}</span>
              </p>
              <p className="text-sm font-medium text-gray-700 mt-0.5 capitalize">
                {jobState === "waiting" && "⏳ Waiting in queue…"}
                {jobState === "active" && "⚙️ Processing pipeline…"}
                {jobState === "completed" && "✅ Completed"}
                {jobState === "failed" && "❌ Failed"}
                {jobState === "timeout" && "⏱ Timed out"}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Result */}
      {result && (
        <Card title="Assessment Result">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  Risk Score
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {Math.round(
                    result.riskScore ?? result.report?.riskScore ?? 0,
                  )}
                  <span className="text-base font-normal text-gray-400">
                    /100
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  Risk Level
                </p>
                <div className="mt-2">
                  <RiskBadge level={result.riskLevel} />
                </div>
              </div>
            </div>

            {result.report && (
              <>
                <div className="pt-3 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Summary
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {result.report.summary}
                  </p>
                </div>

                {result.report.recommendations?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Recommendations
                    </p>
                    <ul className="space-y-1.5">
                      {result.report.recommendations.map((r, i) => (
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
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
