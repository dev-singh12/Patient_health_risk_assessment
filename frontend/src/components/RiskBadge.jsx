const COLORS = {
  LOW: "bg-green-100 text-green-700",
  MODERATE: "bg-yellow-100 text-yellow-700",
  HIGH: "bg-orange-100 text-orange-700",
  CRITICAL: "bg-red-100 text-red-700",
};

export default function RiskBadge({ level }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${COLORS[level] || "bg-gray-100 text-gray-600"}`}
    >
      {level}
    </span>
  );
}
