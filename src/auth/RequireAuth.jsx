import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'

export default function RequireAuth({ children }) {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-graphite text-sm">
        Loading…
      </div>
    )
  }

  if (status !== 'authed') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}
