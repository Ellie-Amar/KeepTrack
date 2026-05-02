import { useEffect, useMemo, useState, type ReactNode } from 'react'

import {
  createAuthenticatedSession,
  createGuestSession,
  getSession,
  setSession,
  subscribeSession,
} from './sessionStore'
import { AuthContext, type AuthContextValue } from './context'
import { hasImportableGuestData } from '../services/guestImportService'
import { login, signup } from '../services/backendApi'
import type { Session } from '../types'

async function createSessionFromLogin(email: string, password: string) {
  const tokens = await login(email, password)
  const session = createAuthenticatedSession(tokens, email)
  setSession(session)
  const needsGuestImport = await hasImportableGuestData()
  return { session, needsGuestImport }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(() => getSession())

  useEffect(() => {
    return subscribeSession(setSessionState)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loginWithPassword: async (email, password) => createSessionFromLogin(email, password),
      signupAndLogin: async (email, password, displayName) => {
        await signup({
          email,
          password,
          display_name: displayName.trim() || null,
        })
        return createSessionFromLogin(email, password)
      },
      continueAsGuest: () => {
        setSession(createGuestSession())
      },
      logout: () => {
        setSession(null)
      },
    }),
    [session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
