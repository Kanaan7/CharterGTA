export default function StatusBanner({ tone = "info", title, children, onDismiss }) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "error"
        ? "border-red-200 bg-red-50 text-red-900"
        : tone === "warning"
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-sky-200 bg-sky-50 text-sky-900";

  return (
    <div className={`rounded-2xl border px-4 py-3 shadow-sm ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          {title ? <div className="text-sm font-bold">{title}</div> : null}
          {children ? <div className="text-sm leading-relaxed">{children}</div> : null}
        </div>

        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full px-2 py-1 text-xs font-semibold text-current/70 hover:bg-white/60 hover:text-current"
          >
            Dismiss
          </button>
        ) : null}
      </div>
    </div>
  );
}
