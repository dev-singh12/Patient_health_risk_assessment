export default function Card({ title, children, className = "" }) {
  return (
    <div className={`bg-white rounded-xl shadow-md p-4 ${className}`}>
      {title && (
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          {title}
        </h2>
      )}
      {children}
    </div>
  );
}
