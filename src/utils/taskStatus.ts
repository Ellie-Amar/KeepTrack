import type { TaskStatus } from '../types'

export const KNOWN_TASK_STATUSES: TaskStatus[] = ['active', 'suspended', 'done']

export function normalizeTaskStatus(status: string | null | undefined): TaskStatus {
  if (status === 'archived') {
    return 'done'
  }
  if (status === 'active' || status === 'suspended' || status === 'done') {
    return status
  }
  return (status || 'active') as TaskStatus
}
