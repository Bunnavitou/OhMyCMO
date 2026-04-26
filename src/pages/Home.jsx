import { Link } from 'react-router-dom'
import {
  Users, Package, Handshake, Megaphone, Boxes,
  TrendingUp, TrendingDown, ArrowRight, CheckCircle2, Circle,
} from 'lucide-react'
import { useStore } from '../store/StoreContext.jsx'

const fmtMoney = (n) => `$${Number(n || 0).toLocaleString()}`
const monoCaps = 'font-mono uppercase tracking-[0.18em]'

export default function Home() {
  const { state } = useStore()

  const totalIncome = state.products.reduce(
    (sum, p) => sum + p.income.reduce((s, i) => s + Number(i.amount || 0), 0),
    0,
  )
  const totalExpense = state.products.reduce(
    (sum, p) => sum + p.expenses.reduce((s, e) => s + Number(e.amount || 0), 0),
    0,
  )
  const net = totalIncome - totalExpense

  const allTasks = [
    ...state.customers.flatMap((c) =>
      c.tasks
        .filter((t) => t.status !== 'Done')
        .map((t) => ({
          title: t.name,
          due: t.due,
          done: t.status === 'Done',
          owner: c.name,
          link: `/customers/${c.id}`,
        })),
    ),
    ...state.partners.flatMap((p) =>
      p.tasks
        .filter((t) => !t.done)
        .map((t) => ({
          title: t.name || t.title,
          due: t.due,
          done: t.done,
          owner: p.name,
          link: `/partners/${p.id}`,
        })),
    ),
  ]
    .sort((a, b) => (a.due || '').localeCompare(b.due || ''))
    .slice(0, 5)

  // Saturated story-tile color blocks — Verge's hazard-tape rotation.
  const tiles = [
    {
      to: '/customers',
      icon: Users,
      label: 'Customers',
      count: state.customers.length,
      bg: '#3CFFD0', // mint
      fg: '#000',
      kicker: 'Relationships',
    },
    {
      to: '/products',
      icon: Package,
      label: 'Products',
      count: state.products.length,
      bg: '#5200FF', // ultraviolet
      fg: '#fff',
      kicker: 'Catalogue',
    },
    {
      to: '/partners',
      icon: Handshake,
      label: 'Partners',
      count: state.partners.length,
      bg: '#FFE500', // yellow
      fg: '#000',
      kicker: 'Vendors',
    },
    {
      to: '/marketing',
      icon: Megaphone,
      label: 'Marketing',
      count: (state.campaigns || []).length,
      bg: '#FF8AD8', // pink
      fg: '#000',
      kicker: 'Campaigns',
    },
    {
      to: '/assets',
      icon: Boxes,
      label: 'Assets',
      count: state.assets.length,
      bg: '#FFFFFF', // white spotlight
      fg: '#131313',
      kicker: 'Inventory',
    },
  ]

  return (
    <div className="space-y-8 md:space-y-10">
      {/* Hero — wordmark moment */}
      <section>
        <p className={`text-[10px] md:text-xs ${monoCaps} text-mint`}>
          Cmo Cockpit · Today
        </p>
        <h1
          className="font-display text-white mt-2 leading-[0.92]"
          style={{ fontSize: 'clamp(48px, 12vw, 107px)', letterSpacing: '0.01em' }}
        >
          OHMYCMO
        </h1>
      </section>

      {/* Net P&L panel — full mint hazard tile */}
      <section
        className="p-5 md:p-8 border border-mint-edge"
        style={{ backgroundColor: '#3CFFD0', color: '#000', borderRadius: '24px' }}
      >
        <p className={`text-[10px] md:text-xs ${monoCaps}`}>
          Net P&amp;L · This period
        </p>
        <p
          className="font-display leading-[0.92] mt-2 md:mt-3"
          style={{ fontSize: 'clamp(56px, 14vw, 120px)', letterSpacing: '0.01em' }}
        >
          {fmtMoney(net)}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3 max-w-md">
          <div className="bg-black/10 p-3 rounded-2xl">
            <p className={`text-[10px] ${monoCaps} flex items-center gap-1.5`}>
              <TrendingUp className="w-3 h-3" /> Income
            </p>
            <p className="font-display text-2xl md:text-3xl mt-1.5">
              {fmtMoney(totalIncome)}
            </p>
          </div>
          <div className="bg-black/10 p-3 rounded-2xl">
            <p className={`text-[10px] ${monoCaps} flex items-center gap-1.5`}>
              <TrendingDown className="w-3 h-3" /> Expense
            </p>
            <p className="font-display text-2xl md:text-3xl mt-1.5">
              {fmtMoney(totalExpense)}
            </p>
          </div>
        </div>
      </section>

      {/* Workspaces — saturated color-block tile rotation */}
      <section>
        <h2 className={`text-[11px] md:text-xs ${monoCaps} text-steel font-bold mb-3`}>
          Workspaces
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
          {tiles.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className="group block p-4 md:p-5 transition-transform hover:scale-[1.02]"
              style={{
                backgroundColor: t.bg,
                color: t.fg,
                borderRadius: '20px',
              }}
            >
              <t.icon className="w-5 h-5" strokeWidth={2.4} />
              <p
                className={`text-[10px] ${monoCaps} font-bold mt-3`}
                style={{ opacity: 0.7 }}
              >
                {t.kicker} · {t.count}
              </p>
              <p
                className="font-display text-2xl md:text-3xl leading-[0.95] mt-1"
                style={{ letterSpacing: '0.01em' }}
              >
                {t.label}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* StoryStream — upcoming tasks as pill cards on a purple rail */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-[11px] md:text-xs ${monoCaps} text-steel font-bold`}>
            Upcoming · Live feed
          </h2>
          <Link
            to="/customers"
            className={`text-[10px] ${monoCaps} text-mint font-bold flex items-center gap-1 hover:underline`}
          >
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {allTasks.length === 0 ? (
          <div
            className="p-6 text-center border border-white/15"
            style={{ borderRadius: '20px' }}
          >
            <p className={`text-[10px] ${monoCaps} text-steel`}>No open tasks</p>
          </div>
        ) : (
          <ol className="relative pl-5 space-y-3">
            <span
              className="absolute left-0 top-2 bottom-2 w-px"
              style={{ background: '#3D00BF' }}
              aria-hidden
            />
            {allTasks.map((t, i) => (
              <li key={i} className="relative">
                <span
                  className="absolute -left-[22px] top-4 w-3 h-3 rounded-full bg-mint border-2 border-abyss"
                  aria-hidden
                />
                <Link
                  to={t.link}
                  className="block bg-charcoal border border-white/15 p-4 transition-colors hover:border-mint"
                  style={{ borderRadius: '20px' }}
                >
                  <p className={`text-[10px] ${monoCaps} text-mint font-bold mb-1`}>
                    {t.owner}
                    {t.due ? ` · DUE ${t.due}` : ''}
                  </p>
                  <p className="text-sm md:text-base font-bold text-white leading-snug">
                    {t.title}
                  </p>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
