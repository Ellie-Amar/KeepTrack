import { db } from './db'
import type {
  LocalTask,
  LocalValidation,
  SyncJob,
  SyncJobStatus,
  SyncJobType,
  SyncStats,
  TaskDraft,
  TaskView,
} from '../types'

function nowIso() {
  return new Date().toISOString()
}

function createId() {
  return crypto.randomUUID()
}

function isServerScope(scope: string) {
  return scope.startsWith('user:')
}

async function findExistingJob(scope: string, type: SyncJobType, entityId: string) {
  const jobs = await db.syncJobs
    .where('scope')
    .equals(scope)
    .and((job) => job.type === type && job.entityId === entityId && job.status !== 'processing')
    .toArray()

  return jobs[0]
}

export async function enqueueSyncJob(scope: string, type: SyncJobType, entityId: string) {
  const existing = await findExistingJob(scope, type, entityId)
  const timestamp = nowIso()

  if (existing?.id) {
    await db.syncJobs.update(existing.id, {
      status: 'pending',
      error: null,
      updatedAt: timestamp,
    })
    return
  }

  const job: SyncJob = {
    scope,
    type,
    entityId,
    status: 'pending',
    error: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  await db.syncJobs.add(job)
}

export async function createTaskLocal(scope: string, draft: TaskDraft) {
  const timestamp = nowIso()
  const task: LocalTask = {
    id: createId(),
    scope,
    label: draft.label.trim(),
    note: draft.note?.trim() || null,
    category: draft.category?.trim() || null,
    status: draft.status,
    order: Date.now(),
    createdAt: timestamp,
    updatedAt: timestamp,
    deleted: false,
    pendingSync: true,
    syncError: null,
  }

  await db.tasks.add(task)

  if (isServerScope(scope)) {
    await enqueueSyncJob(scope, 'task_upsert', task.id)
  }

  return task
}

export async function updateTaskLocal(scope: string, taskId: string, patch: Partial<TaskDraft>) {
  const current = await db.tasks.get(taskId)
  if (!current || current.scope !== scope || current.deleted) {
    throw new Error('Task introuvable')
  }

  const next: LocalTask = {
    ...current,
    label: patch.label !== undefined ? patch.label.trim() : current.label,
    note: patch.note !== undefined ? patch.note?.trim() || null : current.note,
    category: patch.category !== undefined ? patch.category?.trim() || null : current.category,
    status: patch.status ?? current.status,
    updatedAt: nowIso(),
    pendingSync: true,
    syncError: null,
  }

  await db.tasks.put(next)

  if (isServerScope(scope)) {
    await enqueueSyncJob(scope, 'task_upsert', taskId)
  }

  return next
}

export async function createValidationLocal(
  scope: string,
  taskId: string,
  note: string | null,
  userId: string | null,
  userDisplayName: string | null,
) {
  const task = await db.tasks.get(taskId)
  if (!task || task.scope !== scope || task.deleted) {
    throw new Error('Task introuvable')
  }

  const timestamp = nowIso()
  const validation: LocalValidation = {
    id: createId(),
    scope,
    taskId,
    note: note?.trim() || null,
    userId,
    userDisplayName,
    createdAt: timestamp,
    updatedAt: timestamp,
    deleted: false,
    pendingSync: true,
    syncError: null,
  }

  await db.transaction('rw', db.validations, db.tasks, async () => {
    await db.validations.add(validation)

    await db.tasks.update(taskId, {
      updatedAt: timestamp,
      pendingSync: task.pendingSync || isServerScope(scope),
    })
  })

  if (isServerScope(scope)) {
    await enqueueSyncJob(scope, 'validation_create', validation.id)
  }

  return validation
}

export async function getTaskViews(scope: string) {
  const tasks = await db.tasks.where('scope').equals(scope).filter((task) => !task.deleted).toArray()
  tasks.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  const views: TaskView[] = []
  for (const task of tasks) {
    const validations = await db.validations
      .where('[scope+taskId]')
      .equals([scope, task.id])
      .filter((item) => !item.deleted)
      .toArray()

    validations.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    views.push({ task, validations })
  }

  return views
}

export async function getTaskView(scope: string, taskId: string) {
  const task = await db.tasks.get(taskId)
  if (!task || task.scope !== scope || task.deleted) {
    return null
  }

  const validations = await db.validations
    .where('[scope+taskId]')
    .equals([scope, taskId])
    .filter((item) => !item.deleted)
    .toArray()

  validations.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return { task, validations }
}

export async function getSyncStats(scope: string): Promise<SyncStats> {
  const pending = await db.syncJobs.where('[scope+status]').equals([scope, 'pending']).count()
  const failed = await db.syncJobs.where('[scope+status]').equals([scope, 'failed']).count()
  return { pending, failed }
}

export async function getQueuedJobs(scope: string) {
  return db.syncJobs
    .where('scope')
    .equals(scope)
    .and((job) => job.status === 'pending' || job.status === 'failed')
    .sortBy('createdAt')
}

export async function updateJobStatus(jobId: number, status: SyncJobStatus, error: string | null) {
  await db.syncJobs.update(jobId, {
    status,
    error,
    updatedAt: nowIso(),
  })
}

export async function deleteJob(jobId: number) {
  await db.syncJobs.delete(jobId)
}

export async function setTaskSyncError(taskId: string, error: string | null) {
  await db.tasks.update(taskId, {
    syncError: error,
  })
}

export async function setTaskSynced(taskId: string) {
  await db.tasks.update(taskId, {
    pendingSync: false,
    syncError: null,
  })
}

export async function setValidationSyncError(validationId: string, error: string | null) {
  await db.validations.update(validationId, {
    syncError: error,
  })
}

export async function setValidationSynced(validationId: string) {
  await db.validations.update(validationId, {
    pendingSync: false,
    syncError: null,
  })
}

export async function hasGuestData(scope: string) {
  const taskCount = await db.tasks.where('scope').equals(scope).filter((task) => !task.deleted).count()
  if (taskCount > 0) {
    return true
  }

  const validationCount = await db.validations
    .where('scope')
    .equals(scope)
    .filter((validation) => !validation.deleted)
    .count()
  return validationCount > 0
}
