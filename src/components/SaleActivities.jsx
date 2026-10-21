import { useEffect, useRef, useState } from 'react'
import { Plus, X, Calendar, UserRound, ListChecks } from 'lucide-react'
import { useStore } from '../store/StoreContext.jsx'
import { useT } from '../i18n/LanguageContext.jsx'
import { memberName, memberLabel } from '../utils/tasks.js'
import { ACTIVITY_TYPES, ACTIVITY_STATUSES, OTHER, activityStyle, fmtDay, todayKey } from '../utils/sales.js'
import Select from './Select.jsx'

const newId = () => `new-${Math.random().toString(36).slice(2, 10)}`

// The activities of a sale — the steps (call, meeting, demo, Deal Won …),
// each with a status, due date and person in charge. "+ Add activity" adds a
// row whose name is typed in; picking a type (Call, Customer Care …) is
// optional and is what the weekly KPIs and check-ins count. No type = Other,
// where the typed name is required.
export default function SaleActivities({ value, onChange }) {
  const { t } = useT()
  const [focusId, setFocusId] = useState(null) // newly added row to focus

  const patch = (id, p) => onChange(value.map((a) => (a.id === id ? { ...a, ...p } : a)))
  const remove = (id) => onChange(value.filter((a) => a.id !== id))
  const add = () => {
    const id = newId()
    onChange([...value, { id, type: OTHER, title: '', status: 'New', dueDate: null, assigneeId: null }])
    setFocusId(id)
  }

  return (
    <div className="px-4 py-3 space-y-2">
      <p className="text-xs font-bold uppercase tracking-wider text-graphite flex items-center gap-1.5">
        <ListChecks className="w-3.5 h-3.5" /> {t('sales.activities')}
      </p>
      {value.map((a) => (
        <ActivityRow key={a.id} a={a} autoFocus={a.id === focusId} onPatch={(p) => patch(a.id, p)} onRemove={() => remove(a.id)} />
      ))}
      <button type="button" className="btn-ghost !py-1.5 text-sm" onClick={add}>
        <Plus className="w-4 h-4" /> {t('sales.addActivity')}
      </button>
    </div>
  )
}

function ActivityRow({ a, autoFocus, onPatch, onRemove }) {
  const { state } = useStore()
  const { t, lang } = useT()
  const titleRef = useRef(null)
  const dateRef = useRef(null)
  const done = a.status === 'Done'
  const other = a.type === OTHER
  const person = (state.team || []).find((m) => m.id === a.assigneeId)
  const overdue = a.dueDate && !done && a.dueDate < todayKey()

  useEffect(() => { if (autoFocus) titleRef.current?.focus() }, [autoFocus])

  return (
    // Phone: name + ✕ on the first line, status / date / person below.
    // Wider screens: one line, in the order status, name, date, person, ✕.
    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 rounded-2xl border border-shadow p-1.5">
      <Select
        aria-label={t('sales.activityStatus')}
        value={a.status}
        onChange={(e) => onPatch({ status: e.target.value })}
        className={`order-3 sm:order-1 shrink-0 rounded-xl px-2 py-1.5 text-xs font-semibold border-0 cursor-pointer ${activityStyle(a.status)}`}
      >
        {ACTIVITY_STATUSES.map((st) => <option key={st} value={st}>{t(`sales.activityStatus.${st}`)}</option>)}
      </Select>

      {/* Type, then details — for Other, the typed name is the activity. */}
      <div className={`order-1 sm:order-2 basis-[calc(100%-2.5rem)] sm:basis-0 flex-1 min-w-0 flex items-center gap-2 px-1 ${done ? 'line-through text-graphite' : ''}`}>
        <Select
          aria-label={t('sales.activityType')}
          value={a.type}
          // Straight on to the name, so typing after a pick doesn't land on the menu.
          onChange={(e) => { onPatch({ type: e.target.value }); titleRef.current?.focus() }}
          className={`shrink-0 max-w-[45%] rounded-lg bg-iron px-2 py-1 text-xs font-semibold cursor-pointer ${other ? 'text-graphite' : 'text-near-black'}`}
        >
          <option value={OTHER}>{t('sales.activityType.none')}</option>
          {ACTIVITY_TYPES.map((type) => <option key={type} value={type}>{t(`activity.type.${type}`)}</option>)}
        </Select>
        <input
          ref={titleRef}
          className="flex-1 min-w-0 bg-transparent outline-none text-sm py-1"
          placeholder={other ? t('sales.otherName') : done ? '' : t('sales.activityDetails')}
          aria-label={other ? t('sales.otherName') : t('sales.activityDetails')}
          value={a.title || ''}
          onChange={(e) => onPatch({ title: e.target.value })}
        />
      </div>

      {/* Due date — icon until set, then the date; opens the native picker */}
      <div className="order-4 sm:order-3 relative shrink-0">
        <button
          type="button"
          title={t('sales.field.dueDate')}
          onClick={() => dateRef.current?.showPicker?.() ?? dateRef.current?.focus()}
          className={`h-8 rounded-lg border border-shadow px-2 flex items-center gap-1 text-xs hover:bg-iron ${overdue ? 'text-danger-700 font-semibold' : 'text-graphite'}`}
        >
          <Calendar className="w-3.5 h-3.5" />
          {a.dueDate && <span className="tabular-nums">{fmtDay(a.dueDate, lang, { day: 'numeric', month: 'short' })}</span>}
        </button>
        <input
          ref={dateRef}
          type="date"
          tabIndex={-1}
          aria-hidden
          className="absolute inset-0 opacity-0 pointer-events-none"
          value={a.dueDate || ''}
          onChange={(e) => onPatch({ dueDate: e.target.value || null })}
        />
      </div>

      {/* Person in charge — avatar until set; a transparent select on top */}
      <div className="order-5 sm:order-4 relative shrink-0" title={person ? memberName(person) : t('sales.inCharge')}>
        <span className={`h-8 min-w-8 rounded-lg border border-shadow px-2 flex items-center gap-1 text-xs ${person ? 'text-near-black' : 'text-graphite'}`}>
          {person
            ? <><span className="w-5 h-5 rounded-full bg-near-black text-white text-[10px] font-bold flex items-center justify-center">{memberName(person).charAt(0).toUpperCase()}</span>
                <span className="hidden sm:inline max-w-[80px] truncate">{memberName(person)}</span></>
            : <UserRound className="w-3.5 h-3.5" />}
        </span>
        <Select
          aria-label={t('sales.inCharge')}
          className="absolute inset-0 opacity-0 cursor-pointer"
          value={a.assigneeId || ''}
          onChange={(e) => onPatch({ assigneeId: e.target.value || null })}
        >
          <option value="">{t('sales.nobody')}</option>
          {(state.team || []).filter((m) => m.active !== false || m.id === a.assigneeId)
            .map((m) => <option key={m.id} value={m.id}>{memberLabel(m, t('role.admin'))}</option>)}
        </Select>
      </div>

      <button type="button" onClick={onRemove} aria-label={t('common.delete')} className="order-2 sm:order-5 shrink-0 p-1 text-graphite hover:text-danger-700">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
