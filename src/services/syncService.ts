import { createTask, createValidation, listTasks, updateTask } from './backendApi'
import { db } from './db'
import { generateUuid } from '../utils/uuid'
import {
  deleteJob,
  getQueuedJobs,
  setTaskSyncError,
  setTaskSynced,
  setValidationSyncError,
  setValidationSynced,
  updateJobStatus,
} from './taskStore'
import type { ApiTask, LocalTask, LocalValidation } from '../types'

function toLocalTask(scope: string, remote: ApiTask, existing?: LocalTask): LocalTask {
  const remoteUpdatedAt = new Date(remote.updated_at).getTime()
  const localUpdatedAt = existing ? new Date(existing.updatedAt).getTime() : 0
  const localShouldWin = Boolean(existing?.pendingSync && localUpdatedAt > remoteUpdatedAt)

  if (existing && localShouldWin) {
    return {
      ...existing,
      remoteId: remote.id,
      ownerId: remote.owner_id,
    }
  }

  return {
    id: existing?.id ?? generateUuid(),
    scope,
    remoteId: remote.id,
    ownerId: remote.owner_id,
    label: remote.label,
    note: remote.note,
    category: remote.category,
    status: remote.status,
    order: remote.order ?? 0,
    createdAt: remote.created_at,
    updatedAt: remote.updated_at,
    deleted: false,
    pendingSync: false,
    syncError: null,
  }
}

async function syncTask(task: LocalTask) {
  const payload = {
    label: task.label,
    note: task.note,
    category: task.category,
    status: task.status,
    order: task.order,
  }

  const remoteTask = task.remoteId ? await updateTask(task.remoteId, payload) : await createTask(payload)

  await db.tasks.update(task.id, {
    remoteId: remoteTask.id,
    ownerId: remoteTask.owner_id,
    label: remoteTask.label,
    note: remoteTask.note,
    category: remoteTask.category,
    status: remoteTask.status,
    order: remoteTask.order ?? task.order,
    createdAt: remoteTask.created_at,
    updatedAt: remoteTask.updated_at,
    pendingSync: false,
    syncError: null,
  })
}

async function syncValidation(validation: LocalValidation) {
  if (validation.remoteId) {
    await setValidationSynced(validation.id)
    return
  }

  const parentTask = await db.tasks.get(validation.taskId)
  if (!parentTask || !parentTask.remoteId) {
    throw new Error('Tâche distante manquante pour la validation')
  }

  const remoteValidation = await createValidation(parentTask.remoteId, validation.note)
  await db.validations.update(validation.id, {
    remoteId: remoteValidation.id,
    remoteTaskId: remoteValidation.task_id,
    note: remoteValidation.note,
    createdAt: remoteValidation.created_at,
    updatedAt: remoteValidation.updated_at,
    userId: remoteValidation.user.id,
    userDisplayName: remoteValidation.user.display_name,
    pendingSync: false,
    syncError: null,
  })
}

async function processSyncJob(scope: string, jobId: number, type: string, entityId: string) {
  if (type === 'task_upsert') {
    const task = await db.tasks.get(entityId)
    if (!task || task.scope !== scope || task.deleted) {
      await deleteJob(jobId)
      return
    }
    await syncTask(task)
    await setTaskSynced(task.id)
    await deleteJob(jobId)
    return
  }

  if (type === 'validation_create') {
    const validation = await db.validations.get(entityId)
    if (!validation || validation.scope !== scope || validation.deleted) {
      await deleteJob(jobId)
      return
    }
    await syncValidation(validation)
    await setValidationSynced(validation.id)
    await deleteJob(jobId)
  }
}

export async function runSyncCycle(scope: string) {
  const jobs = await getQueuedJobs(scope)

  for (const job of jobs) {
    if (!job.id) {
      continue
    }

    await updateJobStatus(job.id, 'processing', null)
    try {
      await processSyncJob(scope, job.id, job.type, job.entityId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur de synchronisation'
      await updateJobStatus(job.id, 'failed', message)
      if (job.type === 'task_upsert') {
        await setTaskSyncError(job.entityId, message)
      }
      if (job.type === 'validation_create') {
        await setValidationSyncError(job.entityId, message)
      }
    }
  }
}

export async function pullRemoteSnapshot(scope: string) {
  const remoteTasks = await listTasks()

  await db.transaction('rw', db.tasks, db.validations, async () => {
    for (const remoteTask of remoteTasks) {
      const existingTask = await db.tasks
        .where('[scope+remoteId]')
        .equals([scope, remoteTask.id])
        .first()

      const localTask = toLocalTask(scope, remoteTask, existingTask)
      await db.tasks.put(localTask)

      for (const remoteValidation of remoteTask.validations) {
        const existingValidation = await db.validations
          .where('[scope+remoteId]')
          .equals([scope, remoteValidation.id])
          .first()

        const nextValidation: LocalValidation = {
          id: existingValidation?.id ?? generateUuid(),
          scope,
          taskId: localTask.id,
          remoteId: remoteValidation.id,
          remoteTaskId: remoteValidation.task_id,
          note: remoteValidation.note,
          userId: remoteValidation.user.id,
          userDisplayName: remoteValidation.user.display_name,
          createdAt: remoteValidation.created_at,
          updatedAt: remoteValidation.updated_at,
          deleted: false,
          pendingSync: false,
          syncError: null,
        }

        await db.validations.put(nextValidation)
      }
    }
  })
}
