import { User, Mail, Briefcase, Pencil } from 'lucide-react'

// Hardcoded for now — replace with real auth/user data when available.
const ME = {
  name: 'You',
  email: 'laybunnavitou@kosign.com.kh',
  role: 'Chief Marketing Officer',
  initials: 'YO',
}

export default function MoreProfile() {
  return (
    <div className="space-y-4">
      <section className="card flex items-center gap-3">
        <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center text-base md:text-lg font-extrabold shrink-0">
          {ME.initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base md:text-lg font-bold truncate">{ME.name}</p>
          <p className="text-xs md:text-sm text-steel truncate">{ME.role}</p>
        </div>
        <button className="p-2 rounded-full hover:bg-iron text-steel" aria-label="Edit profile">
          <Pencil className="w-4 h-4" />
        </button>
      </section>

      <section className="card divide-y divide-shadow p-0">
        <Row icon={User} label="Display name" value={ME.name} />
        <Row icon={Mail} label="Email" value={ME.email} />
        <Row icon={Briefcase} label="Role" value={ME.role} />
      </section>

      <p className="text-[11px] text-ash text-center">
        Profile editing is coming soon. These details are stored locally on this device.
      </p>
    </div>
  )
}

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 p-3 md:p-4">
      <Icon className="w-4 h-4 text-ash shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] md:text-xs uppercase tracking-wider text-ash font-semibold">
          {label}
        </p>
        <p className="text-sm md:text-base text-white truncate">{value}</p>
      </div>
    </div>
  )
}
