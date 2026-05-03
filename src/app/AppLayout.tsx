import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/useAuth'
import { db } from '../services/db'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

async function readSyncCounters(scope: string) {
  const pending = await db.syncJobs.where('[scope+status]').equals([scope, 'pending']).count()
  const failed = await db.syncJobs.where('[scope+status]').equals([scope, 'failed']).count()
  return { pending, failed }
}

type ThemeMode = 'light' | 'dark'
const THEME_STORAGE_KEY = 'keeptrack.theme'

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'light'
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') {
    return stored
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function AppLayout() {
  const online = useOnlineStatus()
  const navigate = useNavigate()
  const { session, logout } = useAuth()
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme())

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  const syncStats = useLiveQuery(
    async () => (session ? readSyncCounters(session.scope) : { pending: 0, failed: 0 }),
    [session?.scope],
    { pending: 0, failed: 0 },
  )

  const handleLogout = () => {
    logout()
    void navigate('/auth')
  }

  const hasPendingSync = syncStats.pending > 0

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/tasks" className="brand">
          KeepTrack
        </Link>
        <div className="header-meta">
          <span className={`pill ${online ? 'pill-online' : 'pill-offline'}`}>
            {online ? 'En ligne' : 'Hors ligne'}
          </span>
          <label className="theme-toggle pill">
            <input
              type="checkbox"
              checked={theme === 'dark'}
              onChange={(event) => setTheme(event.target.checked ? 'dark' : 'light')}
            />
            <span>Sombre</span>
          </label>
          {session && (
            <span className="email-chip">{session.mode === 'guest' ? 'Invité' : `👤 ${session.email}`}</span>
          )}
          <span className="pill sync-pill">
            <span
              className={`sync-indicator ${hasPendingSync ? 'sync-indicator-pending' : 'sync-indicator-ok'}`}
              aria-hidden="true"
            />
            <span>Synchronisation: {hasPendingSync ? `${syncStats.pending} en attente` : 'à jour'}</span>
          </span>
          {syncStats.failed > 0 && <span className="pill warning">{syncStats.failed} échec(s)</span>}
          {session && (
            <button className="ghost compact" type="button" onClick={handleLogout}>
              <span className="logout-icon" aria-hidden="true">
                👋
              </span>{' '}
              Déconnexion
            </button>
          )}
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
