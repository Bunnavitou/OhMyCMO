import { Link } from 'react-router-dom'
import {
  Users, Package, Handshake, Megaphone, Boxes,
  TrendingUp, TrendingDown, ArrowRight, CheckCircle2, Circle, ArrowUpRight,
} from 'lucide-react'
import { useStore } from '../store/StoreContext.jsx'
import { useT } from '../i18n/LanguageContext.jsx'

const fmtMoney = (n) => `$${Number(n || 0).toLocaleString()}`

export default function Home() {
  const { state } = useStore()
  const { t } = useT()

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
        .filter((task) => task.status !== 'Done')
        .map((task) => ({
          title: task.name,
          due: task.due,
          done: task.status === 'Done',
          owner: c.name,
          link: `/customers/${c.id}`,
        })),
    ),
    ...state.partners.flatMap((p) =>
      p.tasks
        .filter((task) => !task.done)
        .map((task) => ({
          title: task.name || task.title,
          due: task.due,
          done: task.done,
          owner: p.name,
          link: `/partners/${p.id}`,
        })),
    ),
  ]
    .sort((a, b) => (a.due || '').localeCompare(b.due || ''))
    .slice(0, 5)

  // Workspace tiles — Wise mixes light mint backgrounds with the bright signature green.
  const tiles = [
    { to: '/customers',  icon: Users,     labelKey: 'nav.customers',      count: state.customers.length,         bg: '#9FE870', fg: '#163300', kickerKey: 'home.workspace.customers' },
    { to: '/products',   icon: Package,   labelKey: 'nav.products.short', count: state.products.length,           bg: '#E2F6D5', fg: '#0E0F0C', kickerKey: 'home.workspace.products' },
    { to: '/partners',   icon: Handshake, labelKey: 'nav.partners',       count: state.partners.length,           bg: '#CDFFAD', fg: '#0E0F0C', kickerKey: 'home.workspace.partners' },
    { to: '/marketing',  icon: Megaphone, labelKey: 'nav.marketing',      count: (state.campaigns || []).length, bg: '#163300', fg: '#FFFFFF', kickerKey: 'home.workspace.marketing' },
    { to: '/assets',     icon: Boxes,     labelKey: 'nav.more',           count: state.assets.length,             bg: '#FFFFFF', fg: '#0E0F0C', kickerKey: 'home.workspace.assets', ring: true },
  ]
  // Override Assets label since it isn't in the top nav
  tiles[4] = { ...tiles[4], labelKey: 'asset.title' }

  return (
    <div className="space-y-10 md:space-y-14">
      {/* Hero */}
      <section className="pt-2 md:pt-6">
        <p className="text-sm font-semibold text-graphite mb-3">
          {t('home.kicker')}
        </p>
        <h1
          className="display text-near-black"
          style={{ fontSize: 'clamp(56px, 13vw, 126px)' }}
        >
          OhMyCMO.
        </h1>
        <p className="text-base md:text-lg text-graphite mt-4 max-w-2xl">
          {t('home.tagline')}
        </p>
      </section>

      {/* Net P&L */}
      <section
        className="p-6 md:p-10"
        style={{
          backgroundColor: '#9FE870',
          color: '#163300',
          borderRadius: '40px',
        }}
      >
        <p className="text-sm font-semibold opacity-80">{t('home.netPnl')}</p>
        <p
          className="display mt-2 md:mt-3"
          style={{
            fontSize: 'clamp(64px, 16vw, 140px)',
            color: '#163300',
          }}
        >
          {fmtMoney(net)}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3 max-w-md">
          <div
            className="p-4"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.5)',
              borderRadius: '20px',
            }}
          >
            <p className="text-xs font-bold flex items-center gap-1.5" style={{ color: '#163300' }}>
              <TrendingUp className="w-3.5 h-3.5" /> {t('product.metric.income')}
            </p>
            <p className="display text-2xl md:text-3xl mt-1.5" style={{ color: '#163300' }}>
              {fmtMoney(totalIncome)}
            </p>
          </div>
          <div
            className="p-4"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.5)',
              borderRadius: '20px',
            }}
          >
            <p className="text-xs font-bold flex items-center gap-1.5" style={{ color: '#163300' }}>
              <TrendingDown className="w-3.5 h-3.5" /> {t('product.metric.expense')}
            </p>
            <p className="display text-2xl md:text-3xl mt-1.5" style={{ color: '#163300' }}>
              {fmtMoney(totalExpense)}
            </p>
          </div>
        </div>
      </section>

      {/* Workspaces */}
      <section>
        <div className="flex items-end justify-between mb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-graphite">
              {t('home.workspaces')}
            </p>
            <h2 className="display text-3xl md:text-5xl text-near-black mt-1">
              {t('home.workspacesH')}
            </h2>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
          {tiles.map((tile) => (
            <Link
              key={tile.to}
              to={tile.to}
              className="group block p-5 md:p-6 transition-transform hover:scale-[1.02]"
              style={{
                backgroundColor: tile.bg,
                color: tile.fg,
                borderRadius: '30px',
                border: tile.ring ? '1px solid rgba(14, 15, 12, 0.12)' : 'none',
              }}
            >
              <div className="flex items-start justify-between">
                <tile.icon className="w-6 h-6" strokeWidth={2.2} />
                <ArrowUpRight className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-xs font-bold mt-6" style={{ opacity: 0.7 }}>
                {t(tile.kickerKey)} · {tile.count}
              </p>
              <p className="display text-2xl md:text-3xl mt-1" style={{ color: tile.fg }}>
                {t(tile.labelKey)}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Upcoming tasks */}
      <section>
        <div className="flex items-end justify-between mb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-graphite">
              {t('home.upcoming')}
            </p>
            <h2 className="display text-3xl md:text-5xl text-near-black mt-1">
              {t('home.upcomingH')}
            </h2>
          </div>
          <Link
            to="/customers"
            className="text-sm font-semibold text-wise-dark hover:underline flex items-center gap-1"
          >
            {t('common.viewAll')} <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {allTasks.length === 0 ? (
          <div className="card text-center py-10">
            <p className="text-sm text-graphite">{t('home.allClear')}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {allTasks.map((task, i) => (
              <li key={i}>
                <Link
                  to={task.link}
                  className="card flex items-center gap-3 transition-transform hover:scale-[1.01]"
                >
                  {task.done ? (
                    <CheckCircle2 className="w-5 h-5 text-wise-dark shrink-0" />
                  ) : (
                    <Circle className="w-5 h-5 text-ash shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm md:text-base font-semibold text-near-black truncate">
                      {task.title}
                    </p>
                    <p className="text-xs text-graphite truncate mt-0.5">
                      {task.owner}{task.due ? ` · ${t('home.dueOn', { date: task.due })}` : ''}
                    </p>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-graphite shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
