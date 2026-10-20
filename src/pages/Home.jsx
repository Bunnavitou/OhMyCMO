import { Link } from 'react-router-dom'
import {
  Users, Package, Handshake, Megaphone, Boxes,
  TrendingUp, TrendingDown, ArrowRight, Circle, ArrowUpRight,
  AlertTriangle, Clock, Loader2, Ban,
} from 'lucide-react'
import { useStore } from '../store/StoreContext.jsx'
import { useT } from '../i18n/LanguageContext.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { hasPermission } from '../auth/permissions.js'
import { useFollowups } from '../api/sales.js'
import { collectTasks, dueBucket, dueTextStyle, sourceStyle } from '../utils/tasks.js'
import { fmtMoney as fmtAmount } from '../utils/email.js'

const fmtMoney = (n) => `$${fmtAmount(n)}`

export default function Home() {
  const { state } = useStore()
  const { t } = useT()
  const { user } = useAuth()
  const showFollowups = hasPermission(user, 'sales')

  const totalIncome = state.products.reduce(
    (sum, p) => sum + p.income.reduce((s, i) => s + Number(i.amount || 0), 0),
    0,
  )
  const totalExpense = state.products.reduce(
    (sum, p) => sum + p.expenses.reduce((s, e) => s + Number(e.amount || 0), 0),
    0,
  )
  const net = totalIncome - totalExpense

  const taskStats = (() => {
    const s = { overdue: 0, today: 0, inProgress: 0, blocked: 0 }
    for (const task of collectTasks(state)) {
      if (task.status === 'Done') continue
      const b = dueBucket(task.due, task.status)
      if (b === 'overdue') s.overdue++
      if (b === 'today') s.today++
      if (task.status === 'In Progress') s.inProgress++
      if (task.status === 'Blocked') s.blocked++
    }
    return s
  })()

  const taskTiles = [
    { key: 'overdue',    icon: AlertTriangle, value: taskStats.overdue,    labelKey: 'tasks.stat.overdue',    tone: 'bg-danger-100 text-danger-800', to: '/tasks?due=overdue' },
    { key: 'today',      icon: Clock,         value: taskStats.today,      labelKey: 'tasks.stat.today',      tone: 'bg-warning-100 text-warning-800', to: '/tasks?due=today' },
    { key: 'inProgress', icon: Loader2,       value: taskStats.inProgress, labelKey: 'tasks.stat.inProgress', tone: 'bg-brand-100 text-success-800', to: '/tasks?status=In+Progress' },
    { key: 'blocked',    icon: Ban,           value: taskStats.blocked,    labelKey: 'tasks.stat.blocked',    tone: 'bg-neutral-100 text-neutral-700', to: '/tasks?status=Blocked' },
  ]

  const allTasks = collectTasks(state)
    .filter((task) => task.status !== 'Done')
    .map((task) => ({
      title: task.name,
      due: task.due,
      owner: task.ownerName,
      link: task.link,
      source: task.source,
      sourceLabel: task.ownerLabel,
    }))
    .sort((a, b) => (a.due || '').localeCompare(b.due || ''))
    .slice(0, 5)

  // Workspace tiles — Wise mixes light mint backgrounds with the bright signature green.
  const tiles = [
    { to: '/customers',  icon: Users,     labelKey: 'nav.customers',      count: state.customers.length,         tone: 'bg-brand-500 text-brand-800', kickerKey: 'home.workspace.customers' },
    { to: '/products',   icon: Package,   labelKey: 'nav.products.short', count: state.products.length,           tone: 'bg-brand-100 text-near-black', kickerKey: 'home.workspace.products' },
    { to: '/partners',   icon: Handshake, labelKey: 'nav.partners',       count: state.partners.length,           tone: 'bg-brand-200 text-near-black', kickerKey: 'home.workspace.partners' },
    { to: '/marketing',  icon: Megaphone, labelKey: 'nav.marketing',      count: (state.campaigns || []).length, tone: 'bg-brand-800 text-white', kickerKey: 'home.workspace.marketing' },
    { to: '/assets',     icon: Boxes,     labelKey: 'nav.more',           count: state.assets.length,             tone: 'bg-white text-near-black border border-shadow', kickerKey: 'home.workspace.assets' },
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
          WeCRM.
        </h1>
        <p className="text-base md:text-lg text-graphite mt-4 max-w-2xl">
          {t('home.tagline')}
        </p>
      </section>

      {/* Net P&L */}
      <section className="p-6 md:p-10 bg-brand-500 text-brand-800 rounded-section">
        <p className="text-sm font-semibold opacity-80">{t('home.netPnl')}</p>
        <p
          className="display mt-2 md:mt-3 text-brand-800"
          style={{ fontSize: 'clamp(64px, 16vw, 140px)' }}
        >
          {fmtMoney(net)}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3 max-w-md">
          <div className="p-4 bg-white/50 rounded-toggle">
            <p className="text-xs font-bold flex items-center gap-1.5 text-brand-800">
              <TrendingUp className="w-3.5 h-3.5" /> {t('product.metric.income')}
            </p>
            <p className="display text-2xl md:text-3xl mt-1.5 text-brand-800">
              {fmtMoney(totalIncome)}
            </p>
          </div>
          <div className="p-4 bg-white/50 rounded-toggle">
            <p className="text-xs font-bold flex items-center gap-1.5 text-brand-800">
              <TrendingDown className="w-3.5 h-3.5" /> {t('product.metric.expense')}
            </p>
            <p className="display text-2xl md:text-3xl mt-1.5 text-brand-800">
              {fmtMoney(totalExpense)}
            </p>
          </div>
        </div>
      </section>

      {showFollowups && <FollowupBox userId={user?.ownerId ? user.id : undefined} />}

      {/* Task pulse */}
      <section>
        <div className="flex items-end justify-between mb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-graphite">
              {t('home.tasks.kicker')}
            </p>
            <h2 className="display text-3xl md:text-5xl text-near-black mt-1">
              {t('home.tasksH')}
            </h2>
          </div>
          <Link
            to="/tasks"
            className="text-sm font-semibold text-wise-dark hover:underline flex items-center gap-1"
          >
            {t('home.tasks.viewBoard')} <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {taskTiles.map((tile) => (
            <Link
              key={tile.key}
              to={tile.to}
              className={`block p-5 rounded-feature transition-transform hover:scale-[1.02] ${tile.tone}`}
            >
              <div className="flex items-center justify-between">
                <tile.icon className="w-5 h-5" strokeWidth={2.2} />
                <span className="display text-3xl md:text-4xl">{tile.value}</span>
              </div>
              <p className="text-xs font-bold mt-3" style={{ opacity: 0.85 }}>
                {t(tile.labelKey)}
              </p>
            </Link>
          ))}
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
              className={`group block p-5 md:p-6 rounded-feature transition-transform hover:scale-[1.02] ${tile.tone}`}
            >
              <div className="flex items-start justify-between">
                <tile.icon className="w-6 h-6" strokeWidth={2.2} />
                <ArrowUpRight className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-xs font-bold mt-6" style={{ opacity: 0.7 }}>
                {t(tile.kickerKey)} · {tile.count}
              </p>
              <p className="display text-2xl md:text-3xl mt-1 text-inherit">
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
                  <Circle className="w-5 h-5 text-ash shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm md:text-base font-semibold text-near-black truncate">
                      {task.title}
                    </p>
                    <p className="text-xs truncate mt-0.5 flex items-center gap-1.5">
                      <span className={`pill shrink-0 text-[10px] ${sourceStyle(task.source)}`}>{task.sourceLabel}</span>
                      <span className="text-graphite truncate">{task.owner}</span>
                      {task.due && (
                        <span className={`shrink-0 ${dueTextStyle(dueBucket(task.due))}`}>
                          {' · '}{t('home.dueOn', { date: task.due })}
                        </span>
                      )}
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

// Sales follow-ups at a glance (Excel BR-10): a rep sees their own, the
// owner sees the whole team. Each count opens the Follow-ups tab.
function FollowupBox({ userId }) {
  const { t } = useT()
  const { groups, loading } = useFollowups({ userId })
  if (loading) return null
  const items = [
    { key: 'overdue', tone: 'bg-danger-100 text-danger-800' },
    { key: 'today', tone: 'bg-warning-100 text-warning-800' },
    { key: 'upcoming', tone: 'bg-brand-100 text-success-800' },
  ]
  return (
    <section>
      <div className="flex items-end justify-between mb-4">
        <h2 className="display text-3xl md:text-5xl text-near-black">{t('sales.followup.box')}</h2>
        <Link to="/sales?tab=week" className="text-sm font-semibold text-wise-dark hover:underline flex items-center gap-1">
          {t('sales.tab.week')} <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        {items.map((i) => (
          <Link key={i.key} to="/sales" className={`block p-5 rounded-feature transition-transform hover:scale-[1.02] ${i.tone}`}>
            <span className="display text-3xl md:text-4xl">{groups[i.key].length}</span>
            <p className="text-xs font-bold mt-2" style={{ opacity: 0.85 }}>{t(`sales.followup.${i.key}`)}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
