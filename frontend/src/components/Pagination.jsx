export default function Pagination({ pagination, onNext, onPrev }) {
  if (!pagination) return null;
  const { page, totalPages, hasNext, hasPrev, total } = pagination;

  return (
    <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
      <span>
        {total} total record{total !== 1 ? "s" : ""}
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={onPrev}
          disabled={!hasPrev}
          className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          ← Prev
        </button>
        <span className="px-2 font-medium">
          {page} / {totalPages || 1}
        </span>
        <button
          onClick={onNext}
          disabled={!hasNext}
          className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
