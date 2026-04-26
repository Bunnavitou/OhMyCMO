import { useState, useEffect } from 'react'
import { Calendar, X } from 'lucide-react'
import DateRangeFilter, { formatDateDDMMYYYY } from './DateRangeFilter.jsx'

/**
 * Compact filter trigger.
 *
 * Props:
 * - value: { start: Date, end: Date } | null — current active range
 * - onChange(range | null): called when filter is applied or cleared
 * - storageKey?: string — localStorage key for "Save this date filtering for all time"
 * - label?: string — fallback button label when no value
 */
export default function DateFilterButton({ value, onChange, storageKey, label = 'Filter by date' }) {
  const [open, setOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Hydrate from localStorage once on mount.
  useEffect(() => {
    if (hydrated || !storageKey || value) {
      setHydrated(true)
      return
    }
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const { start, end } = JSON.parse(raw)
        const s = new Date(start)
        const e = new Date(end)
        if (!isNaN(s) && !isNaN(e)) onChange({ start: s, end: e })
      }
    } catch {
      // ignore
    }
    setHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleApply = (range, save) => {
    onChange(range)
    if (storageKey) {
      try {
        if (save) {
          localStorage.setItem(
            storageKey,
            JSON.stringify({ start: range.start.toISOString(), end: range.end.toISOString() }),
          )
        }
      } catch {
        // ignore
      }
    }
    setOpen(false)
  }

  const handleClear = (e) => {
    e?.stopPropagation()
    onChange(null)
    if (storageKey) {
      try {
        localStorage.removeItem(storageKey)
      } catch {
        // ignore
      }
    }
  }

  return (
    <>
      {value ? (
        <div className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-brand-50 border border-brand-200 text-brand-700 text-xs md:text-sm">
          <Calendar className="w-3.5 h-3.5 shrink-0" />
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="font-semibold tabular-nums whitespace-nowrap"
          >
            {formatDateDDMMYYYY(value.start)} ~ {formatDateDDMMYYYY(value.end)}
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="p-0.5 rounded hover:bg-brand-100 ml-0.5"
            aria-label="Clear date filter"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border border-shadow bg-charcoal text-white/85 hover:bg-iron"
        >
          <Calendar className="w-4 h-4" /> {label}
        </button>
      )}

      <DateRangeFilter
        open={open}
        onClose={() => setOpen(false)}
        value={value}
        onApply={handleApply}
      />
    </>
  )
}
