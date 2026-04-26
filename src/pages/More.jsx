import { Link } from 'react-router-dom'
import {
  User, Users, Boxes, Sparkles, FileText, LogOut, ChevronRight,
} from 'lucide-react'

const items = [
  { to: '/more/profile',     icon: User,      label: 'Profile',              iconBg: 'bg-brand-50 text-brand-700' },
  { to: '/more/sub-users',   icon: Users,     label: 'Sub user Management',  iconBg: 'bg-violet-100 text-violet-700' },
  { to: '/assets',           icon: Boxes,     label: 'Assets Management',    iconBg: 'bg-sky-100 text-sky-700' },
  { to: '/more/influencers', icon: Sparkles,  label: 'Influencer Management',iconBg: 'bg-amber-100 text-amber-700' },
  { to: '/more/tcs',         icon: FileText,  label: 'T&Cs',                 iconBg: 'bg-iron text-white/85' },
]

export default function More() {
  const handleLogout = () => {
    if (!confirm('Sign out and reset all local data on this device?')) return
    try {
      localStorage.removeItem('ohmycmo:v1')
    } catch {
      // ignore
    }
    window.location.assign('/')
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
              <span className="flex-1 text-sm md:text-base font-medium text-white truncate">
                {item.label}
              </span>
              <ChevronRight className="w-4 h-4 text-ash shrink-0" />
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
        <span className="flex-1 text-left text-sm md:text-base font-semibold">Logout</span>
      </button>

      <p className="text-[11px] text-ash text-center pt-2">
        OhMyCMO · v0.1
      </p>
    </div>
  )
}
