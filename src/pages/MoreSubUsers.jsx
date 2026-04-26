import { UserPlus, Mail, Shield, Users } from 'lucide-react'

// Placeholder roster — wire up real auth + invitations later.
const SAMPLE_USERS = [
  { id: 'u-1', name: 'You', email: 'laybunnavitou@kosign.com.kh', role: 'Owner',  active: true },
  { id: 'u-2', name: 'BD Lead', email: 'bd@example.com',          role: 'Manager', active: true },
  { id: 'u-3', name: 'Brand Coordinator', email: 'brand@example.com', role: 'Member', active: false },
]

export default function MoreSubUsers() {
  return (
    <div className="space-y-3">
      <button
        onClick={() => alert('Inviting sub users is coming soon.')}
        className="btn-primary w-full"
      >
        <UserPlus className="w-4 h-4" /> Invite teammate
      </button>

      <ul className="card divide-y divide-shadow p-0">
        {SAMPLE_USERS.map((u) => (
          <li key={u.id} className="flex items-center gap-3 p-3 md:p-4">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-sm shrink-0">
              {u.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm md:text-base font-semibold truncate">
                {u.name}
                {u.role === 'Owner' && (
                  <span className="ml-1.5 pill bg-brand-100 text-brand-700">You</span>
                )}
              </p>
              <p className="text-xs text-graphite truncate flex items-center gap-1">
                <Mail className="w-3 h-3" /> {u.email}
              </p>
            </div>
            <span
              className={`pill ${
                u.active ? 'bg-emerald-100 text-emerald-700' : 'bg-iron text-graphite'
              }`}
            >
              <Shield className="w-3 h-3 mr-1" /> {u.role}
            </span>
          </li>
        ))}
      </ul>

      <div className="card text-center py-6 text-graphite">
        <Users className="w-8 h-8 mx-auto mb-2 text-graphite" />
        <p className="text-xs md:text-sm">
          Role-based access and invitations are still being built.
        </p>
      </div>
    </div>
  )
}
