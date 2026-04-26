import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, ArrowRight, Info } from 'lucide-react'
import Modal from './Modal.jsx'

const PRESETS = ['Today', 'Yesterday', 'Week', 'Last Week', 'This Month', 'Last Month', 'This Year']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

const startOfDay = (d) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

const endOfDay = (d) => {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

export function presetRange(name) {
  const today = startOfDay(new Date())
  switch (name) {
    case 'Today':
      return { start: today, end: today }
    case 'Yesterday': {
      const y = new Date(today); y.setDate(y.getDate() - 1)
      return { start: y, end: y }
    }
    case 'Week': {
      const dow = today.getDay() || 7
      const monday = new Date(today); monday.setDate(today.getDate() - (dow - 1))
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
      return { start: monday, end: sunday }
    }
    case 'Last Week': {
      const dow = today.getDay() || 7
      const monday = new Date(today); monday.setDate(today.getDate() - (dow - 1) - 7)
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
      return { start: monday, end: sunday }
    }
    case 'This Month':
      return {
        start: new Date(today.getFullYear(), today.getMonth(), 1),
        end: new Date(today.getFullYear(), today.getMonth() + 1, 0),
      }
    case 'Last Month':
      return {
        start: new Date(today.getFullYear(), today.getMonth() - 1, 1),
        end: new Date(today.getFullYear(), today.getMonth(), 0),
      }
    case 'This Year':
      return {
        start: new Date(today.getFullYear(), 0, 1),
        end: new Date(today.getFullYear(), 11, 31),
      }
    default:
      return null
  }
}

const monthRange = (m, y) => ({
  start: new Date(y, m, 1),
  end: new Date(y, m + 1, 0),
})

export const formatDateDDMMYYYY = (d) => {
  if (!d) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}-${mm}-${d.getFullYear()}`
}

const sameDay = (a, b) =>
  a && b &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

function getCalendarGrid(month, year) {
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7 // Mon=0
  const totalDays = new Date(year, month + 1, 0).getDate()
  const days = []
  for (let i = 0; i < firstDow; i++) days.push(null)
  for (let d = 1; d <= totalDays; d++) days.push(d)
  while (days.length % 7) days.push(null)
  return days
}

const YEARS = Array.from({ length: 21 }, (_, i) => 2015 + i)

function MiniCalendar({ month, year, setMonth, setYear, start, end, role, onPick }) {
  const grid = useMemo(() => getCalendarGrid(month, year), [month, year])

  const startMs = startOfDay(start).getTime()
  const endMs = startOfDay(end).getTime()
  const lo = Math.min(startMs, endMs)
  const hi = Math.max(startMs, endMs)

  const stepMonth = (delta) => {
    let m = month + delta
    let y = year
    while (m < 0) { m += 12; y -= 1 }
    while (m > 11) { m -= 12; y += 1 }
    setMonth(m); setYear(y)
  }

  return (
    <div className="border border-shadow rounded-2xl p-3">
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={() => stepMonth(-1)}
          className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-abyss text-white flex items-center justify-center shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="flex-1 input !py-1.5 !text-sm appearance-none pr-7"
          style={{ backgroundImage: 'none' }}
        >
          {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="flex-1 input !py-1.5 !text-sm appearance-none pr-7"
          style={{ backgroundImage: 'none' }}
        >
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <button
          type="button"
          onClick={() => stepMonth(1)}
          className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-abyss text-white flex items-center justify-center shrink-0"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="text-[10px] font-bold text-ash text-center py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {grid.map((d, i) => {
          if (d === null) return <div key={i} aria-hidden />
          const date = new Date(year, month, d)
          const ms = startOfDay(date).getTime()
          const isStart = sameDay(date, start)
          const isEnd = sameDay(date, end)
          const inRange = ms > lo && ms < hi
          return (
            <button
              key={i}
              type="button"
              onClick={() => onPick(date)}
              className={`aspect-square rounded text-xs md:text-sm font-medium transition ${
                isStart || isEnd
                  ? 'bg-brand-600 text-white shadow-sm'
                  : inRange
                  ? 'bg-brand-100 text-brand-700'
                  : 'border border-shadow text-white/85 hover:bg-iron'
              }`}
            >
              {d}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function DateRangeFilter({ open, onClose, value, onApply, defaultPreset = 'This Month' }) {
  const initial = value || presetRange(defaultPreset)

  const [start, setStart] = useState(initial.start)
  const [end, setEnd] = useState(initial.end)
  const [activePreset, setActivePreset] = useState(value ? '' : defaultPreset)
  const [save, setSave] = useState(false)

  const [startMonth, setStartMonth] = useState(initial.start.getMonth())
  const [startYear, setStartYear] = useState(initial.start.getFullYear())
  const [endMonth, setEndMonth] = useState(initial.end.getMonth())
  const [endYear, setEndYear] = useState(initial.end.getFullYear())

  const applyPreset = (name) => {
    const r = presetRange(name)
    if (!r) return
    setStart(r.start); setEnd(r.end)
    setStartMonth(r.start.getMonth()); setStartYear(r.start.getFullYear())
    setEndMonth(r.end.getMonth());     setEndYear(r.end.getFullYear())
    setActivePreset(name)
  }

  const applyMonth = (m) => {
    const y = new Date().getFullYear()
    const r = monthRange(m, y)
    setStart(r.start); setEnd(r.end)
    setStartMonth(m); setStartYear(y)
    setEndMonth(m);   setEndYear(y)
    setActivePreset('')
  }

  const onPickStart = (d) => {
    setStart(d)
    if (d > end) setEnd(d)
    setActivePreset('')
  }
  const onPickEnd = (d) => {
    setEnd(d)
    if (d < start) setStart(d)
    setActivePreset('')
  }

  const handleApply = () => {
    onApply({ start: startOfDay(start), end: endOfDay(end) }, save)
  }

  return (
    <Modal open={open} onClose={onClose} title="Filter by date" size="3xl">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 px-3 md:px-4 py-2.5 md:py-3 rounded-xl bg-iron">
          <span className="text-xs md:text-sm font-bold text-steel">Range</span>
          <span className="text-sm md:text-base font-bold text-white tabular-nums">
            {formatDateDDMMYYYY(start)} ~ {formatDateDDMMYYYY(end)}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 md:gap-2">
          {PRESETS.map((p) => {
            const active = activePreset === p
            return (
              <button
                key={p}
                type="button"
                onClick={() => applyPreset(p)}
                className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-semibold border transition ${
                  active
                    ? 'bg-iron border-graphite text-white'
                    : 'bg-charcoal border-shadow text-white/85 hover:bg-iron'
                }`}
              >
                {p}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {MONTHS.map((m, i) => (
            <button
              key={m}
              type="button"
              onClick={() => applyMonth(i)}
              className="px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold border border-shadow bg-charcoal text-white/85 hover:bg-iron"
            >
              {m}
            </button>
          ))}
        </div>

        <div className="md:flex md:items-stretch md:gap-3 space-y-3 md:space-y-0">
          <div className="flex-1 min-w-0">
            <MiniCalendar
              month={startMonth} year={startYear}
              setMonth={setStartMonth} setYear={setStartYear}
              start={start} end={end}
              role="start" onPick={onPickStart}
            />
          </div>
          <div className="hidden md:flex items-center justify-center px-1">
            <ArrowRight className="w-4 h-4 text-ash" />
          </div>
          <div className="flex-1 min-w-0">
            <MiniCalendar
              month={endMonth} year={endYear}
              setMonth={setEndMonth} setYear={setEndYear}
              start={start} end={end}
              role="end" onPick={onPickEnd}
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-3 border-t border-shadow">
          <label className="flex items-center gap-2 flex-1 text-xs md:text-sm text-white/85 cursor-pointer">
            <input
              type="checkbox"
              checked={save}
              onChange={(e) => setSave(e.target.checked)}
              className="w-4 h-4 rounded accent-brand-600"
            />
            Save this date filtering for all time
            <Info className="w-3 h-3 text-ash" aria-hidden />
          </label>
          <div className="flex gap-1 sm:gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-50 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="btn-primary"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
