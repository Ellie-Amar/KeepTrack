import Dexie, { type Table } from 'dexie'

import type { LocalTask, LocalValidation, SyncJob } from '../types'

class KeepTrackDb extends Dexie {
  tasks!: Table<LocalTask, string>
  validations!: Table<LocalValidation, string>
  syncJobs!: Table<SyncJob, number>

  constructor() {
    super('keeptrack-db')

    this.version(1).stores({
      tasks:
        'id, scope, remoteId, updatedAt, deleted, pendingSync, [scope+updatedAt], [scope+remoteId]',
      validations:
        'id, scope, taskId, remoteId, remoteTaskId, updatedAt, deleted, pendingSync, [scope+taskId], [scope+remoteId]',
      syncJobs: '++id, scope, type, entityId, status, updatedAt, [scope+status], [scope+updatedAt]',
    })
  }
}

export const db = new KeepTrackDb()
