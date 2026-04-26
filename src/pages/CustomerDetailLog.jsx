import {
  Activity, ClipboardList, FileEdit, FileX, FilePlus, FolderOpen,
  FolderEdit, FolderX, Upload, ListChecks, RefreshCw, UserPlus, UserMinus,
  Link2, Link2Off, TrendingUp, TrendingDown,
} from 'lucide-react'

const LOG_VISUAL = {
  'activity':               { Icon: Activity,      tone: 'bg-brand-500' },
  'customer.create':        { Icon: UserPlus,      tone: 'bg-emerald-500' },
  'customer.update':        { Icon: FileEdit,      tone: 'bg-iron0' },
  'task.create':            { Icon: ClipboardList, tone: 'bg-emerald-500' },
  'task.update':            { Icon: FileEdit,      tone: 'bg-iron0' },
  'task.status':            { Icon: RefreshCw,     tone: 'bg-brand-500' },
  'task.delete':            { Icon: FileX,         tone: 'bg-rose-500' },
  'group.create':           { Icon: FolderOpen,    tone: 'bg-emerald-500' },
  'group.rename':           { Icon: FolderEdit,    tone: 'bg-iron0' },
  'group.delete':           { Icon: FolderX,       tone: 'bg-rose-500' },
  'agreement.create':       { Icon: FilePlus,      tone: 'bg-emerald-500' },
  'agreement.delete':       { Icon: FileX,         tone: 'bg-rose-500' },
  'file.upload':            { Icon: Upload,        tone: 'bg-emerald-500' },
  'file.delete':            { Icon: FileX,         tone: 'bg-rose-500' },
  'product.link':           { Icon: Link2,         tone: 'bg-emerald-500' },
  'product.unlink':         { Icon: Link2Off,      tone: 'bg-rose-500' },
  'product.income':         { Icon: TrendingUp,    tone: 'bg-emerald-500' },
  'product.income.delete':  { Icon: FileX,         tone: 'bg-rose-500' },
  'product.expense':        { Icon: TrendingDown,  tone: 'bg-amber-500' },
  'product.expense.delete': { Icon: FileX,         tone: 'bg-rose-500' },
  'staff.create':           { Icon: UserPlus,      tone: 'bg-emerald-500' },
  'staff.update':           { Icon: FileEdit,      tone: 'bg-iron0' },
  'staff.delete':           { Icon: UserMinus,     tone: 'bg-rose-500' },
}

const formatLogTime = (ts) => {
  const d = new Date(ts)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function CustomerDetailLog({ logs = [] }) {
  const sorted = [...logs].sort((a, b) => (b.ts || '').localeCompare(a.ts || ''))
  return (
    <div className="space-y-3">
      <p className="text-xs text-graphite px-1">
        Every change to this customer is recorded here automatically.
      </p>
      {sorted.length === 0 ? (
        <p className="text-center text-sm text-graphite py-6">No events recorded yet.</p>
      ) : (
        <ol className="relative ml-3 border-l-2 border-shadow space-y-3">
          {sorted.map((l) => {
            const visual = LOG_VISUAL[l.type] || { Icon: ListChecks, tone: 'bg-graphite' }
            const { Icon, tone } = visual
            return (
              <li key={l.id} className="relative pl-5">
                <span
                  className={`absolute -left-[11px] top-2 w-5 h-5 rounded-full ${tone} flex items-center justify-center ring-4 ring-iron`}
                >
                  <Icon className="w-3 h-3 text-white" strokeWidth={2.4} />
                </span>
                <div className="card !p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-snug">{l.message}</p>
                    <span className="text-[10px] text-graphite shrink-0 mt-0.5">
                      {formatLogTime(l.ts)}
                    </span>
                  </div>
                  {l.type === 'activity' && l.meta?.note && (
                    <p className="text-xs text-graphite mt-1 whitespace-pre-wrap">{l.meta.note}</p>
                  )}
                  {l.type === 'customer.update' && l.meta?.before && (
                    <ul className="text-[11px] text-graphite mt-1.5 space-y-0.5">
                      {Object.keys(l.meta.before).map((k) => (
                        <li key={k}>
                          <span className="font-medium text-graphite">{k}:</span>{' '}
                          <span className="line-through text-graphite">{String(l.meta.before[k] || '—')}</span>
                          {' → '}
                          <span className="text-near-black">{String(l.meta.after?.[k] || '—')}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {l.type === 'task.update' && l.meta?.changed?.length > 0 && (
                    <p className="text-[11px] text-graphite mt-1">
                      Fields: {l.meta.changed.join(', ')}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
