export default function EmptyState({ message = "No data found" }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
      <span className="text-4xl mb-3">📭</span>
      <p className="text-sm">{message}</p>
    </div>
  );
}
