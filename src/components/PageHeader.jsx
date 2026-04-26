// Page-body header: subtitle + action row only.
// The app shell handles the screen title, back button, and breadcrumb.
export default function PageHeader({ subtitle, action }) {
  if (!subtitle && !action) return null
  return (
    <div className="flex items-center justify-between gap-3 mb-3 md:mb-4">
      {subtitle ? (
        <div className="text-xs md:text-sm text-steel min-w-0 truncate">{subtitle}</div>
      ) : (
        <span />
      )}
      {action && <div className="flex items-center gap-1 shrink-0">{action}</div>}
    </div>
  )
}
