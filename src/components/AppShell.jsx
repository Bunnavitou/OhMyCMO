import { Outlet, useLocation, Link, useNavigate } from 'react-router-dom'
import {
  Home, Users, Package, Handshake, Megaphone, MoreHorizontal,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useStore } from '../store/StoreContext.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { hasPermission } from '../auth/permissions.js'
import { useT } from '../i18n/LanguageContext.jsx'

const ALL_TABS = [
  { to: '/',          icon: Home,           labelKey: 'nav.home',      mobileLabelKey: 'nav.home',           isActive: (p) => p === '/',                                            perm: null },
  { to: '/customers', icon: Users,          labelKey: 'nav.customers', mobileLabelKey: 'nav.customers',      isActive: (p) => p.startsWith('/customers'),                           perm: 'customers' },
  { to: '/products',  icon: Package,        labelKey: 'nav.products',  mobileLabelKey: 'nav.products.short', isActive: (p) => p.startsWith('/products'),                            perm: 'products' },
  { to: '/partners',  icon: Handshake,      labelKey: 'nav.partners',  mobileLabelKey: 'nav.partners',       isActive: (p) => p.startsWith('/partners'),                            perm: 'partners' },
  { to: '/marketing', icon: Megaphone,      labelKey: 'nav.marketing', mobileLabelKey: 'nav.marketing',      isActive: (p) => p.startsWith('/marketing'),                           perm: 'marketing' },
  { to: '/more',      icon: MoreHorizontal, labelKey: 'nav.more',      mobileLabelKey: 'nav.more',           isActive: (p) => p.startsWith('/more') || p.startsWith('/assets'),     perm: null },
]

const MORE_LABEL_KEYS = {
  profile:     'more.profile',
  'sub-users': 'more.subUsers',
  influencers: 'more.influencers',
  language:    'more.language',
  tcs:         'more.tcs',
}

function useNavMeta() {
  const { state } = useStore()
  const { pathname } = useLocation()
  const { t } = useT()
  const segs = pathname.split('/').filter(Boolean)
  const crumbs = []

  if (segs.length === 0) {
    crumbs.push({ label: t('nav.home'), to: '/' })
  } else if (segs[0] === 'customers') {
    crumbs.push({ label: t('nav.customers'), to: '/customers' })
    if (segs[1]) {
      const c = state.customers.find((x) => x.id === segs[1])
      crumbs.push({ label: c?.name || t('breadcrumb.customer'), to: `/customers/${segs[1]}` })
      if (segs[2] === 'staff') {
        crumbs.push({ label: t('breadcrumb.companyStructure'), to: pathname })
      } else if (segs[2] === 'products' && segs[3]) {
        const link = c?.productLinks?.find((l) => l.id === segs[3])
        const p = link ? state.products.find((p) => p.id === link.productId) : null
        crumbs.push({ label: p?.name || t('breadcrumb.product'), to: pathname })
      }
    }
  } else if (segs[0] === 'products') {
    crumbs.push({ label: t('nav.products'), to: '/products' })
    if (segs[1]) {
      const p = state.products.find((x) => x.id === segs[1])
      crumbs.push({ label: p?.name || t('breadcrumb.product'), to: pathname })
    }
  } else if (segs[0] === 'partners') {
    crumbs.push({ label: t('nav.partners'), to: '/partners' })
    if (segs[1]) {
      const p = state.partners.find((x) => x.id === segs[1])
      crumbs.push({ label: p?.name || t('breadcrumb.partner'), to: pathname })
    }
  } else if (segs[0] === 'marketing') {
    crumbs.push({ label: t('nav.marketing'), to: '/marketing' })
    if (segs[1]) {
      const c = state.campaigns?.find((x) => x.id === segs[1])
      crumbs.push({ label: c?.name || t('breadcrumb.campaign'), to: pathname })
    }
  } else if (segs[0] === 'assets') {
    crumbs.push({ label: t('nav.more'), to: '/more' })
    crumbs.push({ label: t('breadcrumb.assets'), to: '/assets' })
  } else if (segs[0] === 'more') {
    crumbs.push({ label: t('nav.more'), to: '/more' })
    if (segs[1] && MORE_LABEL_KEYS[segs[1]]) {
      crumbs.push({ label: t(MORE_LABEL_KEYS[segs[1]]), to: pathname })
    }
  } else {
    crumbs.push({ label: t('breadcrumb.page'), to: pathname })
  }

  return {
    crumbs,
    level: crumbs.length,
    title: crumbs[crumbs.length - 1]?.label || 'OhMyCMO',
  }
}

export default function AppShell() {
  const { crumbs, level, title } = useNavMeta()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t } = useT()
  const isDetail = level >= 2

  const TABS = ALL_TABS.filter((tab) => !tab.perm || hasPermission(user, tab.perm))

  return (
    <div className="min-h-screen bg-white text-near-black md:flex">
      {/* Sidebar — web only, soft white with hairline border, mint hover/active */}
      <aside className="hidden md:flex md:fixed md:inset-y-0 md:left-0 md:w-60 md:flex-col bg-white border-r border-shadow z-30">
        <div className="h-16 flex items-center px-5 border-b border-shadow">
          <Link
            to="/"
            className="display text-[26px] leading-none text-near-black"
          >
            OhMyCMO
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {TABS.map((tab) => {
            const active = tab.isActive(pathname)
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={`flex items-center gap-2.5 px-3 py-2 text-sm font-semibold transition-all ${
                  active
                    ? 'bg-mint-bg text-wise-dark'
                    : 'text-near-black hover:bg-iron'
                }`}
                style={{ borderRadius: '9999px' }}
              >
                <tab.icon className="w-4 h-4 shrink-0" strokeWidth={2.2} />
                <span className="truncate">{t(tab.labelKey)}</span>
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-shadow">
          <p className="text-[11px] text-graphite font-semibold">v0.1 · local</p>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 md:ml-60 flex flex-col min-h-screen bg-white">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-shadow h-12 md:h-16 flex items-center px-3 md:px-6">
          {isDetail && (
            <button
              onClick={() => navigate(-1)}
              className="md:hidden -ml-1 mr-1 p-2 hover:bg-iron text-near-black rounded-full"
              aria-label="Back"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <h1 className="md:hidden display text-2xl text-near-black truncate flex-1">
            {title}
          </h1>
          <nav className="hidden md:flex items-center gap-2 flex-1 min-w-0">
            {crumbs.map((c, i) => {
              const isLast = i === crumbs.length - 1
              return (
                <span key={`${c.to}-${i}`} className="flex items-center gap-2 min-w-0">
                  {i > 0 && <ChevronRight className="w-5 h-5 text-ash shrink-0" />}
                  {isLast ? (
                    <span className="display text-[26px] leading-none text-near-black truncate">
                      {c.label}
                    </span>
                  ) : (
                    <Link
                      to={c.to}
                      className="display text-[26px] leading-none text-graphite hover:text-near-black truncate"
                    >
                      {c.label}
                    </Link>
                  )}
                </span>
              )
            })}
          </nav>
        </header>

        {/* Content area */}
        <main
          className={`flex-1 px-3 md:px-6 py-4 md:py-6 ${!isDetail ? 'pb-24 md:pb-6' : ''}`}
        >
          <Outlet />
        </main>

        {/* Bottom nav — mobile only */}
        {!isDetail && (
          <nav
            className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-shadow"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <ul
              className="grid h-16"
              style={{ gridTemplateColumns: `repeat(${TABS.length}, minmax(0, 1fr))` }}
            >
              {TABS.map((tab) => {
                const active = tab.isActive(pathname)
                return (
                  <li key={tab.to}>
                    <Link
                      to={tab.to}
                      className={`flex flex-col items-center justify-center gap-0.5 h-full text-[10px] font-bold transition-colors ${
                        active ? 'text-wise-dark' : 'text-graphite'
                      }`}
                    >
                      <span
                        className={`flex items-center justify-center transition-all ${
                          active ? 'bg-mint w-9 h-7' : 'w-9 h-7'
                        }`}
                        style={{ borderRadius: active ? '9999px' : '0' }}
                      >
                        <tab.icon className="w-5 h-5" strokeWidth={active ? 2.6 : 2} />
                      </span>
                      <span>{t(tab.mobileLabelKey)}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
        )}
      </div>
    </div>
  )
}
