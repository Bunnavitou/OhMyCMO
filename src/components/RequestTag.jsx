import { MessageSquareWarning } from 'lucide-react'
import { useT } from '../i18n/LanguageContext.jsx'
import { requestAgeDays } from '../utils/tasks.js'

// "Request · 9d" on a customer request (care feature 2): amber once it has
// been open 7+ days, red at 21+ (as Customer health counts it); plain
// "Request" once done.
export default function RequestTag({ task }) {
  const { t } = useT()
  const done = task.status === 'Done'
  const days = done ? 0 : requestAgeDays(task)
  const tone = done ? 'bg-iron text-graphite'
    : days >= 21 ? 'bg-danger-100 text-danger-700'
      : days >= 7 ? 'bg-warning-100 text-warning-800'
        : 'bg-accent-100 text-accent-700'
  return (
    <span className={`pill shrink-0 inline-flex items-center gap-1 ${tone}`} title={done ? '' : t('tasks.request.openFor', { count: days })}>
      <MessageSquareWarning className="w-3 h-3" />
      {t('tasks.request')}{!done && ` · ${days}d`}
    </span>
  )
}
