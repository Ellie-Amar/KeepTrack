import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { db } from '../../src/services/db'
import {
  createTaskLocal,
  createValidationLocal,
  getQueuedJobs,
  getValidationLocal,
  removeValidationLocal,
} from '../../src/services/taskStore'

describe('taskStore (IndexedDB)', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  afterEach(async () => {
    await db.delete()
  })

  it('creates a local task and enqueues sync in server scope', async () => {
    const task = await createTaskLocal('user:42', {
      label: '  Prepare release  ',
      note: '  check changelog  ',
      category: '  ops  ',
      status: 'active',
    })

    const jobs = await getQueuedJobs('user:42')

    expect(task.label).toBe('Prepare release')
    expect(task.note).toBe('check changelog')
    expect(task.category).toBe('ops')
    expect(task.pendingSync).toBe(true)
    expect(jobs).toHaveLength(1)
    expect(jobs[0]).toMatchObject({
      type: 'task_upsert',
      entityId: task.id,
      status: 'pending',
    })
  })

  it('does not enqueue sync job for guest scope', async () => {
    await createTaskLocal('guest:local', {
      label: 'Guest task',
      note: null,
      category: null,
      status: 'active',
    })

    const jobs = await getQueuedJobs('guest:local')
    expect(jobs).toHaveLength(0)
  })

  it('removes validation and its pending sync job', async () => {
    const scope = 'user:42'
    const task = await createTaskLocal(scope, {
      label: 'Task with validation',
      note: null,
      category: null,
      status: 'active',
    })

    await db.syncJobs.clear()

    const validation = await createValidationLocal(scope, task.id, '  LGTM  ', 'user-2', 'Jane')
    const beforeDeletionJobs = await getQueuedJobs(scope)
    expect(beforeDeletionJobs).toHaveLength(1)
    expect(beforeDeletionJobs[0]?.entityId).toBe(validation.id)

    await removeValidationLocal(scope, validation.id)

    const deletedValidation = await getValidationLocal(scope, validation.id)
    const afterDeletionJobs = await getQueuedJobs(scope)

    expect(deletedValidation).toBeNull()
    expect(afterDeletionJobs).toHaveLength(0)
  })
})

