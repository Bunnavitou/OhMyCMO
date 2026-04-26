export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-6">
      {Icon && (
        <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mb-3">
          <Icon className="w-6 h-6" />
        </div>
      )}
      <p className="font-semibold text-white">{title}</p>
      {description && <p className="text-sm text-steel mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
