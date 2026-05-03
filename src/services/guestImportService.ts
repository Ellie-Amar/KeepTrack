import { db } from './db'
import { enqueueSyncJob, hasGuestData } from './taskStore'
import { getGuestScope } from '../auth/sessionStore'
import { generateUuid } from '../utils/uuid'
import type { ImportGuestResult, LocalTask, LocalValidation } from '../types'

function nowIso() {
  return new Date().toISOString()
}

export async function hasImportableGuestData() {
  return hasGuestData(getGuestScope())
}

export async function importGuestDataToScope(targetScope: string): Promise<ImportGuestResult> {
  const guestScope = getGuestScope()
  const guestTasks = await db.tasks
    .where('scope')
    .equals(guestScope)
    .filter((task) => !task.deleted)
    .toArray()

  const guestValidations = await db.validations
    .where('scope')
    .equals(guestScope)
    .filter((validation) => !validation.deleted)
    .toArray()

  if (guestTasks.length === 0 && guestValidations.length === 0) {
    return {
      importedTasks: 0,
      importedValidations: 0,
    }
  }

  const taskIdMap = new Map<string, string>()
  const timestamp = nowIso()

  await db.transaction('rw', db.tasks, db.validations, db.syncJobs, async () => {
    for (const task of guestTasks) {
      const importedTask: LocalTask = {
        ...task,
        id: generateUuid(),
        scope: targetScope,
        remoteId: undefined,
        ownerId: undefined,
        pendingSync: true,
        syncError: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      taskIdMap.set(task.id, importedTask.id)
      await db.tasks.add(importedTask)
      await enqueueSyncJob(targetScope, 'task_upsert', importedTask.id)
    }

    for (const validation of guestValidations) {
      const mappedTaskId = taskIdMap.get(validation.taskId)
      if (!mappedTaskId) {
        continue
      }

      const importedValidation: LocalValidation = {
        ...validation,
        id: generateUuid(),
        scope: targetScope,
        taskId: mappedTaskId,
        remoteId: undefined,
        remoteTaskId: undefined,
        pendingSync: true,
        syncError: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      }

      await db.validations.add(importedValidation)
      await enqueueSyncJob(targetScope, 'validation_create', importedValidation.id)
    }

    // Import is one-shot: purge guest data to prevent duplicate re-imports.
    if (guestTasks.length > 0) {
      await db.tasks.bulkDelete(guestTasks.map((task) => task.id))
    }

    if (guestValidations.length > 0) {
      await db.validations.bulkDelete(guestValidations.map((validation) => validation.id))
    }

    const guestJobs = await db.syncJobs.where('scope').equals(guestScope).toArray()
    if (guestJobs.length > 0) {
      await db.syncJobs.bulkDelete(
        guestJobs
          .map((job) => job.id)
          .filter((jobId): jobId is number => typeof jobId === 'number'),
      )
    }
  })

  return {
    importedTasks: guestTasks.length,
    importedValidations: guestValidations.length,
  }
}
