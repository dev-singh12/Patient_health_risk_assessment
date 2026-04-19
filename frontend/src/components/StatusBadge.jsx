const COLORS = {
  COMPLETED: "bg-green-100 text-green-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  FAILED: "bg-red-100 text-red-700",
};

export default function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${COLORS[status] || "bg-gray-100 text-gray-600"}`}
    >
      {status}
    </span>
  );
}
