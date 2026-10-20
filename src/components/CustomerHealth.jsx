import { HeartPulse, CircleAlert } from 'lucide-react'
import { useT } from '../i18n/LanguageContext.jsx'

// Customer health (care proposal, feature 1). The API decides each status;
// these only show it.

const DOT = { green: 'bg-success-500', amber: 'bg-warning-500', red: 'bg-danger-500' }
const PILL = {
  green: 'bg-success-100 text-success-700',
  amber: 'bg-warning-100 text-warning-800',
  red: 'bg-danger-100 text-danger-700',
}

export function HealthDot({ status, className = '' }) {
  return <span aria-hidden className={`inline-block w-2 h-2 rounded-full shrink-0 ${DOT[status]} ${className}`} />
}

// "● At risk" pill for the Customers list.
export function HealthPill({ health }) {
  const { t } = useT()
  if (!health) return null
  return (
    <span className={`pill inline-flex items-center gap-1.5 ${PILL[health.status]}`}>
      <HealthDot status={health.status} /> {t(`health.status.${health.status}`)}
    </span>
  )
}

// Card on Customer detail: the overall status, then each signal and why.
export function HealthCard({ health, thresholds }) {
  const { t } = useT()
  if (!health) return null
  const { contact, overdue, invoice, products } = health
  const ago = (days) => (days === 0 ? t('health.today') : t('health.daysAgo', { count: days }))

  const rows = [
    {
      key: 'contact',
      status: contact.status,
      label: t('health.contact'),
      value: contact.lastAt ? ago(contact.days) : t('health.contact.none'),
    },
    {
      key: 'overdue',
      status: overdue.status,
      label: t('health.overdue'),
      value: overdue.count
        ? t('health.overdue.some', { count: overdue.count, d: overdue.oldestDays })
        : t('health.overdue.none'),
    },
    {
      key: 'invoice',
      status: invoice.status,
      label: t('health.invoice'),
      value: invoice.lastDate ? ago(invoice.days) : t('health.invoice.none'),
    },
  ]

  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <p className="section-title flex items-center gap-1.5">
            <HeartPulse className="w-4 h-4" /> {t('health.title')}
          </p>
          {thresholds && <HealthRules thresholds={thresholds} />}
        </div>
        <HealthPill health={health} />
      </div>
      <ul className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {rows.map((r) => (
          <li key={r.key} className="rounded-xl bg-iron px-3 py-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-graphite flex items-center gap-1.5">
              <HealthDot status={r.status} /> {r.label}
            </p>
            <p className="text-sm mt-1">{r.value}</p>
          </li>
        ))}
        <li className="rounded-xl bg-iron px-3 py-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-graphite">{t('health.products')}</p>
          <p className="text-sm mt-1">{products.count}</p>
        </li>
      </ul>
    </section>
  )
}

// "!" next to the card title; hover, focus or tap shows how health is decided.
function HealthRules({ thresholds: th }) {
  const { t } = useT()
  const groups = [
    { status: 'amber', lines: [
      t('health.rules.noContact', { n: th.contactAmberDays }),
      t('health.rules.overdue'),
      t('health.rules.noInvoice', { n: th.invoiceAmberDays }),
    ] },
    { status: 'red', lines: [
      t('health.rules.noContact', { n: th.contactRedDays }),
      t('health.rules.late', { n: th.overdueRedDays }),
      t('health.rules.twoSignals'),
    ] },
  ]
  return (
    <span className="relative group inline-flex">
      <button
        type="button"
        aria-label={t('health.rules.title')}
        aria-describedby="health-rules"
        className="text-graphite hover:text-near-black focus:outline-none focus-visible:text-near-black"
      >
        <CircleAlert className="w-4 h-4" />
      </button>
      <div
        id="health-rules"
        role="tooltip"
        className="hidden group-hover:block group-focus-within:block absolute left-0 top-full mt-2 z-30 w-72 rounded-xl border border-shadow bg-white shadow-lg p-3 text-xs text-near-black space-y-2.5"
      >
        <p className="font-bold">{t('health.rules.title')}</p>
        {groups.map((g) => (
          <div key={g.status}>
            <p className="font-semibold flex items-center gap-1.5">
              <HealthDot status={g.status} /> {t(`health.status.${g.status}`)} — {t('health.rules.anyOf')}
            </p>
            <ul className="mt-1 ml-3.5 list-disc pl-3 text-graphite space-y-0.5">
              {g.lines.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </div>
        ))}
        <p className="text-graphite border-t border-shadow pt-2">{t('health.rules.missing')}</p>
      </div>
    </span>
  )
}
