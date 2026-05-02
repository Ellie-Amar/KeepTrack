import { useEffect, useRef } from 'react'

import { useAuth } from '../auth/useAuth'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { pullRemoteSnapshot, runSyncCycle } from '../services/syncService'

const SYNC_INTERVAL_MS = 15_000

export function SyncManager() {
  const { session } = useAuth()
  const online = useOnlineStatus()
  const runningRef = useRef(false)

  useEffect(() => {
    if (!session || session.mode !== 'authenticated' || !online) {
      return
    }

    const syncOnce = async () => {
      if (runningRef.current) {
        return
      }
      runningRef.current = true
      try {
        await runSyncCycle(session.scope)
        await pullRemoteSnapshot(session.scope)
      } finally {
        runningRef.current = false
      }
    }

    void syncOnce()
    const interval = window.setInterval(() => {
      void syncOnce()
    }, SYNC_INTERVAL_MS)

    return () => {
      window.clearInterval(interval)
    }
  }, [online, session])

  return null
}
