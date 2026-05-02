import { useLiveQuery } from 'dexie-react-hooks'
import { Link, Outlet, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/useAuth'
import { db } from '../services/db'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

async function readSyncCounters(scope: string) {
  const pending = await db.syncJobs.where('[scope+status]').equals([scope, 'pending']).count()
  const failed = await db.syncJobs.where('[scope+status]').equals([scope, 'failed']).count()
  return { pending, failed }
}

export function AppLayout() {
  const online = useOnlineStatus()
  const navigate = useNavigate()
  const { session, logout, continueAsGuest } = useAuth()

  const syncStats = useLiveQuery(
    async () => (session ? readSyncCounters(session.scope) : { pending: 0, failed: 0 }),
    [session?.scope],
    { pending: 0, failed: 0 },
  )

  const handleLogout = () => {
    logout()
    void navigate('/auth')
  }

  const handleGuestSwitch = () => {
    continueAsGuest()
    void navigate('/tasks')
  }

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
          {session && (
            <span className="email-chip">{session.mode === 'guest' ? 'Invité' : session.email}</span>
          )}
          <span className="pill">Sync {syncStats.pending} pending</span>
          {syncStats.failed > 0 && <span className="pill warning">{syncStats.failed} failed</span>}
          {session?.mode === 'authenticated' && (
            <button className="ghost compact" type="button" onClick={handleGuestSwitch}>
              Mode invité
            </button>
          )}
          {session && (
            <button className="ghost compact" type="button" onClick={handleLogout}>
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
