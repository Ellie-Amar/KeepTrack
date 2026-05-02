export type TaskStatus = 'active' | 'done' | 'suspended' | 'archived' | (string & {})

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
  accessToken?: string
  refreshToken?: string
  tokenType?: string
}

export interface JwtClaims {
  sub: string
  email: string
  type: string
  exp: number
  iat: number
  iss: string
}

export interface Session {
  mode: 'guest' | 'authenticated'
  scope: string
  userId: string | null
  email: string | null
  accessToken: string | null
  refreshToken: string | null
  tokenType: string
}

export interface ApiValidation {
  id: string
  task_id: string
  taskId?: string
  note: string | null
  created_at: string
  updated_at: string
  createdAt?: string
  updatedAt?: string
  user: {
    id: string
    display_name: string | null
    displayName?: string
  }
}

export interface ApiTask {
  id: string
  owner_id: string
  ownerId?: string
  label: string
  note: string | null
  category: string | null
  status: TaskStatus
  order: number | null
  created_at: string
  updated_at: string
  createdAt?: string
  updatedAt?: string
  validations: ApiValidation[]
}

export interface ApiUser {
  id: string
  email: string
  display_name: string | null
  displayName?: string
  is_active: boolean
  isActive?: boolean
}

export interface LocalTask {
  id: string
  scope: string
  remoteId?: string
  ownerId?: string
  label: string
  note: string | null
  category: string | null
  status: TaskStatus
  order: number
  createdAt: string
  updatedAt: string
  deleted: boolean
  pendingSync: boolean
  syncError: string | null
}

export interface LocalValidation {
  id: string
  scope: string
  taskId: string
  remoteId?: string
  remoteTaskId?: string
  note: string | null
  userId: string | null
  userDisplayName: string | null
  createdAt: string
  updatedAt: string
  deleted: boolean
  pendingSync: boolean
  syncError: string | null
}

export type SyncJobType = 'task_upsert' | 'validation_create'

export type SyncJobStatus = 'pending' | 'processing' | 'failed'

export interface SyncJob {
  id?: number
  scope: string
  type: SyncJobType
  entityId: string
  status: SyncJobStatus
  error: string | null
  createdAt: string
  updatedAt: string
}

export interface SyncStats {
  pending: number
  failed: number
}

export interface TaskView {
  task: LocalTask
  validations: LocalValidation[]
}

export interface TaskDraft {
  label: string
  note: string | null
  category: string | null
  status: TaskStatus
}

export interface ImportGuestResult {
  importedTasks: number
  importedValidations: number
}
