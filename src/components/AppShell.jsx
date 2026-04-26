import { Outlet, useLocation, Link, useNavigate } from 'react-router-dom'
import {
  Home, Users, Package, Handshake, Megaphone, MoreHorizontal,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useStore } from '../store/StoreContext.jsx'

const TABS = [
  { to: '/',          label: 'Home',                 icon: Home,           mobileLabel: 'Home',      isActive: (p) => p === '/' },
  { to: '/customers', label: 'Customers',            icon: Users,          mobileLabel: 'Customers', isActive: (p) => p.startsWith('/customers') },
  { to: '/products',  label: 'Products & Services',  icon: Package,        mobileLabel: 'Products',  isActive: (p) => p.startsWith('/products') },
  { to: '/partners',  label: 'Partners',             icon: Handshake,      mobileLabel: 'Partners',  isActive: (p) => p.startsWith('/partners') },
  { to: '/marketing', label: 'Marketing',            icon: Megaphone,      mobileLabel: 'Marketing', isActive: (p) => p.startsWith('/marketing') },
  { to: '/more',      label: 'More',                 icon: MoreHorizontal, mobileLabel: 'More',      isActive: (p) => p.startsWith('/more') || p.startsWith('/assets') },
]

const MORE_LABELS = {
  profile: 'Profile',
  'sub-users': 'Sub user Management',
  influencers: 'Influencer Management',
  tcs: 'T&Cs',
}

function useNavMeta() {
  const { state } = useStore()
  const { pathname } = useLocation()
  const segs = pathname.split('/').filter(Boolean)
  const crumbs = []

  if (segs.length === 0) {
    crumbs.push({ label: 'Home', to: '/' })
  } else if (segs[0] === 'customers') {
    crumbs.push({ label: 'Customers', to: '/customers' })
    if (segs[1]) {
      const c = state.customers.find((x) => x.id === segs[1])
      crumbs.push({ label: c?.name || 'Customer', to: `/customers/${segs[1]}` })
      if (segs[2] === 'staff') {
        crumbs.push({ label: 'Company structure', to: pathname })
      } else if (segs[2] === 'products' && segs[3]) {
        const link = c?.productLinks?.find((l) => l.id === segs[3])
        const p = link ? state.products.find((p) => p.id === link.productId) : null
        crumbs.push({ label: p?.name || 'Product', to: pathname })
      }
    }
  } else if (segs[0] === 'products') {
    crumbs.push({ label: 'Products & Services', to: '/products' })
    if (segs[1]) {
      const p = state.products.find((x) => x.id === segs[1])
      crumbs.push({ label: p?.name || 'Product', to: pathname })
    }
  } else if (segs[0] === 'partners') {
    crumbs.push({ label: 'Partners', to: '/partners' })
    if (segs[1]) {
      const p = state.partners.find((x) => x.id === segs[1])
      crumbs.push({ label: p?.name || 'Partner', to: pathname })
    }
  } else if (segs[0] === 'marketing') {
    crumbs.push({ label: 'Marketing', to: '/marketing' })
    if (segs[1]) {
      const c = state.campaigns?.find((x) => x.id === segs[1])
      crumbs.push({ label: c?.name || 'Campaign', to: pathname })
    }
  } else if (segs[0] === 'assets') {
    crumbs.push({ label: 'More', to: '/more' })
    crumbs.push({ label: 'Assets Management', to: '/assets' })
  } else if (segs[0] === 'more') {
    crumbs.push({ label: 'More', to: '/more' })
    if (segs[1] && MORE_LABELS[segs[1]]) {
      crumbs.push({ label: MORE_LABELS[segs[1]], to: pathname })
    }
  } else {
    crumbs.push({ label: 'Page', to: pathname })
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
  const isDetail = level >= 2

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
          {TABS.map((t) => {
            const active = t.isActive(pathname)
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`flex items-center gap-2.5 px-3 py-2 text-sm font-semibold transition-all ${
                  active
                    ? 'bg-mint-bg text-wise-dark'
                    : 'text-near-black hover:bg-iron'
                }`}
                style={{ borderRadius: '9999px' }}
              >
                <t.icon className="w-4 h-4 shrink-0" strokeWidth={2.2} />
                <span className="truncate">{t.label}</span>
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
        {/* Top bar — white with hairline bottom border (height matches sidebar wordmark row) */}
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
          {/* Mobile: title in display weight */}
          <h1 className="md:hidden display text-2xl text-near-black truncate flex-1">
            {title}
          </h1>
          {/* Web: breadcrumb — current crumb sized to match the sidebar wordmark */}
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

        {/* Bottom nav — mobile only, white with hairline top border */}
        {!isDetail && (
          <nav
            className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-shadow"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <ul className="grid grid-cols-6 h-16">
              {TABS.map((t) => {
                const active = t.isActive(pathname)
                return (
                  <li key={t.to}>
                    <Link
                      to={t.to}
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
                        <t.icon className="w-5 h-5" strokeWidth={active ? 2.6 : 2} />
                      </span>
                      <span>{t.mobileLabel}</span>
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
