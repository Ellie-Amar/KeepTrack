import type { TaskStatus } from '../types'

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  suspended: 'Suspendue',
  done: 'Terminée',
}

export function getTaskStatusLabel(status: TaskStatus): string {
  return STATUS_LABELS[status] ?? status
}
