import { Link, useNavigate } from 'react-router-dom'
import {
  User, Users, FileText, LogOut, ChevronRight,
  Megaphone, Folder, Globe, Mail, FileBarChart,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'
import { hasPermission } from '../auth/permissions.js'
import { useT } from '../i18n/LanguageContext.jsx'

// `mobileOnly` items duplicate a sidebar tab that the mobile bottom bar
// leaves out (see AppShell `desktopOnly`).
const ALL_ITEMS = [
  { to: '/reports',            icon: FileBarChart, key: 'nav.reports',    iconBg: 'bg-danger-100 text-danger-700',     perm: 'reports', mobileOnly: true },
  { to: '/more/profile',       icon: User,      key: 'more.profile',       iconBg: 'bg-brand-50 text-brand-700',    perm: null },
  { to: '/more/sub-users',     icon: Users,     key: 'more.subUsers',      iconBg: 'bg-accent-100 text-accent-700', perm: 'subUsers' },
  { to: '/more/mail-settings', icon: Mail,      key: 'more.mailSettings',  iconBg: 'bg-success-100 text-success-700', perm: null },
  { to: '/more/influencers',   icon: Megaphone, key: 'more.influencers',   iconBg: 'bg-warning-100 text-warning-700',   perm: 'marketing' },
  { to: '/assets',             icon: Folder,    key: 'more.assets',        iconBg: 'bg-info-100 text-info-700',       perm: 'assets' },
  { to: '/more/language',      icon: Globe,     key: 'more.language',      iconBg: 'bg-info-100 text-info-700',       perm: null },
  { to: '/more/tcs',           icon: FileText,  key: 'more.tcs',           iconBg: 'bg-iron text-near-black',       perm: null },
]

export default function More() {
  const { user, logout } = useAuth()
  const { t } = useT()
  const navigate = useNavigate()

  const items = ALL_ITEMS.filter((it) => !it.perm || hasPermission(user, it.perm))

  const handleLogout = async () => {
    if (!confirm(t('more.confirmLogout'))) return
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="space-y-3">
      <ul className="card divide-y divide-shadow p-0">
        {items.map((item) => (
          <li key={item.to} className={item.mobileOnly ? 'md:hidden' : undefined}>
            <Link
              to={item.to}
              className="flex items-center gap-3 p-3 md:p-4 active:bg-iron hover:bg-iron"
            >
              <div className={`w-9 h-9 md:w-10 md:h-10 rounded-lg flex items-center justify-center shrink-0 ${item.iconBg}`}>
                <item.icon className="w-4 h-4 md:w-5 md:h-5" />
              </div>
              <span className="flex-1 text-sm md:text-base font-medium text-near-black truncate">
                {t(item.key)}
              </span>
              <ChevronRight className="w-4 h-4 text-graphite shrink-0" />
            </Link>
          </li>
        ))}
      </ul>

      <button
        onClick={handleLogout}
        className="card w-full flex items-center gap-3 p-3 md:p-4 text-danger-600 hover:bg-danger-50 active:bg-danger-100"
      >
        <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-danger-100 flex items-center justify-center shrink-0">
          <LogOut className="w-4 h-4 md:w-5 md:h-5" />
        </div>
        <span className="flex-1 text-left text-sm md:text-base font-semibold">
          {t('more.logout')}
        </span>
      </button>

      <p className="text-[11px] text-graphite text-center pt-2">
        {t('more.versionLine')}
      </p>
    </div>
  )
}
