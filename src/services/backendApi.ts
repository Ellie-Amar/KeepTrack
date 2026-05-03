import type { ApiTask, ApiUser, ApiValidation, AuthTokens, TaskStatus } from '../types'
import { normalizeTaskStatus } from '../utils/taskStatus'

import { requestJson } from './apiClient'

interface SignupPayload {
  email: string
  password: string
  display_name?: string | null
}

interface TaskPayload {
  label: string
  note: string | null
  category: string | null
  status?: TaskStatus
  order: number
}

function normalizeAuthTokens(payload: AuthTokens): AuthTokens {
  return {
    access_token: payload.access_token || payload.accessToken || '',
    refresh_token: payload.refresh_token || payload.refreshToken || '',
    token_type: payload.token_type || payload.tokenType || 'bearer',
  }
}

function normalizeUser(user: ApiUser): ApiUser {
  return {
    id: user.id,
    email: user.email,
    display_name: user.display_name ?? user.displayName ?? null,
    is_active: user.is_active ?? user.isActive ?? true,
  }
}

function normalizeValidation(validation: ApiValidation): ApiValidation {
  return {
    id: validation.id,
    task_id: validation.task_id ?? validation.taskId,
    note: validation.note ?? null,
    created_at: validation.created_at ?? validation.createdAt,
    updated_at: validation.updated_at ?? validation.updatedAt,
    user: {
      id: validation.user.id,
      display_name: validation.user.display_name ?? validation.user.displayName ?? null,
    },
  }
}

function normalizeTask(task: ApiTask): ApiTask {
  return {
    id: task.id,
    owner_id: task.owner_id ?? task.ownerId,
    label: task.label,
    note: task.note ?? null,
    category: task.category ?? null,
    status: normalizeTaskStatus(task.status),
    order: task.order ?? 0,
    created_at: task.created_at ?? task.createdAt,
    updated_at: task.updated_at ?? task.updatedAt,
    validations: (task.validations || []).map((validation) => normalizeValidation(validation)),
  }
}

export async function signup(payload: SignupPayload) {
  const raw = await requestJson<ApiUser>('/api/v1/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  return normalizeUser(raw)
}

export async function login(email: string, password: string) {
  const form = new URLSearchParams()
  form.set('username', email)
  form.set('password', password)

  const raw = await requestJson<AuthTokens>('/api/v1/auth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
    skipAuth: true,
  })
  return normalizeAuthTokens(raw)
}

export async function listTasks() {
  const raw = await requestJson<ApiTask[]>('/api/v1/tasks')
  return raw.map((task) => normalizeTask(task))
}

export async function createTask(payload: TaskPayload) {
  const raw = await requestJson<ApiTask>('/api/v1/tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  return normalizeTask(raw)
}

export async function updateTask(taskId: string, payload: Partial<TaskPayload>) {
  const raw = await requestJson<ApiTask>(`/api/v1/tasks/${taskId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  return normalizeTask(raw)
}

export async function createValidation(taskId: string, note: string | null) {
  const raw = await requestJson<ApiValidation>(`/api/v1/tasks/${taskId}/validations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ note }),
  })
  return normalizeValidation(raw)
}

export async function deleteValidation(taskId: string, validationId: string) {
  await requestJson<void>(`/api/v1/tasks/${taskId}/validations/${validationId}`, {
    method: 'DELETE',
  })
}

export async function listTaskAssignees(taskId: string) {
  const raw = await requestJson<ApiUser[]>(`/api/v1/tasks/${taskId}/assignees`)
  return raw.map((user) => normalizeUser(user))
}

export async function assignTaskByEmail(taskId: string, email: string) {
  const raw = await requestJson<ApiUser[]>(`/api/v1/tasks/${taskId}/assignees`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_emails: [email] }),
  })
  return raw.map((user) => normalizeUser(user))
}

export async function unassignTaskUser(taskId: string, userId: string) {
  await requestJson<void>(`/api/v1/tasks/${taskId}/assignees/${userId}`, {
    method: 'DELETE',
  })
}
