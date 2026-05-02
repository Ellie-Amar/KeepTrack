import { Navigate } from 'react-router-dom'
import type { ReactElement } from 'react'

import { useAuth } from '../auth/useAuth'

export function RootRedirect() {
  const { session } = useAuth()
  return <Navigate to={session ? '/tasks' : '/auth'} replace />
}

export function RequireSession({ children }: { children: ReactElement }) {
  const { session } = useAuth()
  if (!session) {
    return <Navigate to="/auth" replace />
  }
  return children
}
