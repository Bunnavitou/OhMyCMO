import { Link, useNavigate } from 'react-router-dom'
import {
  User, Users, FileText, LogOut, ChevronRight,
  Megaphone, Folder, Globe,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'
import { hasPermission } from '../auth/permissions.js'
import { useT } from '../i18n/LanguageContext.jsx'

const ALL_ITEMS = [
  { to: '/more/profile',     icon: User,      key: 'more.profile',     iconBg: 'bg-brand-50 text-brand-700',    perm: null },
  { to: '/more/sub-users',   icon: Users,     key: 'more.subUsers',    iconBg: 'bg-violet-100 text-violet-700', perm: 'subUsers' },
  { to: '/more/influencers', icon: Megaphone, key: 'more.influencers', iconBg: 'bg-amber-100 text-amber-700',   perm: 'marketing' },
  { to: '/assets',           icon: Folder,    key: 'more.assets',      iconBg: 'bg-sky-100 text-sky-700',       perm: 'assets' },
  { to: '/more/language',    icon: Globe,     key: 'more.language',    iconBg: 'bg-sky-100 text-sky-700',       perm: null },
  { to: '/more/tcs',         icon: FileText,  key: 'more.tcs',         iconBg: 'bg-iron text-near-black',       perm: null },
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
          <li key={item.to}>
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
        className="card w-full flex items-center gap-3 p-3 md:p-4 text-rose-600 hover:bg-rose-50 active:bg-rose-100"
      >
        <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-rose-100 flex items-center justify-center shrink-0">
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
