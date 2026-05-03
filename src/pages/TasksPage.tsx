import { useQueries } from '@tanstack/react-query'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'

import { QuickValidateButton } from '../components/QuickValidateButton'
import { ToastMessage } from '../components/ToastMessage'
import type { ToastAction, ToastState } from '../components/ToastMessage'
import { useAuth } from '../auth/useAuth'
import { deleteValidation, listTaskAssignees } from '../services/backendApi'
import { getTaskViews, createValidationLocal, getValidationLocal, removeValidationLocal } from '../services/taskStore'
import type { TaskStatus } from '../types'
import { getTaskStatusLabel } from '../utils/taskStatusLabel'
import { KNOWN_TASK_STATUSES } from '../utils/taskStatus'

const TOAST_DURATION_MS = 5000
const TOAST_UNDO_DURATION_MS = 3000
const STATUS_FILTER_STORAGE_KEY_PREFIX = 'keeptrack.statusFilters'
const STATUS_FILTER_TAGS: Array<{ status: TaskStatus; label: string }> = [
  { status: 'active', label: 'Actives' },
  { status: 'suspended', label: 'Suspendues' },
  { status: 'done', label: 'Terminées' },
]
const DEFAULT_ENABLED_STATUSES: TaskStatus[] = ['active', 'suspended']

function getStorageKey(scope: string): string {
  return `${STATUS_FILTER_STORAGE_KEY_PREFIX}.${scope}`
}

function normalizeStatusFilters(value: unknown): TaskStatus[] {
  if (!Array.isArray(value)) {
    return DEFAULT_ENABLED_STATUSES
  }

  const allowed = new Set<string>(KNOWN_TASK_STATUSES)
  const deduped = value.filter((item): item is TaskStatus => typeof item === 'string' && allowed.has(item))
  return Array.from(new Set(deduped))
}

function readStoredStatusFilters(scope: string): TaskStatus[] {
  if (typeof window === 'undefined') {
    return DEFAULT_ENABLED_STATUSES
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(scope))
    if (!raw) {
      return DEFAULT_ENABLED_STATUSES
    }

    const parsed = JSON.parse(raw) as unknown
    return normalizeStatusFilters(parsed)
  } catch {
    return DEFAULT_ENABLED_STATUSES
  }
}

function getTaskStatusClassName(status: string): string {
  switch (status) {
    case 'active':
      return 'task-status-active'
    case 'suspended':
      return 'task-status-suspended'
    case 'done':
      return 'task-status-done'
    default:
      return 'task-status-unknown'
  }
}

function formatValidationDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR')
}

function getValidationAuthorName(userDisplayName: string | null, userId: string | null): string {
  return userDisplayName || userId || 'Utilisateur'
}

export function TasksPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [enabledStatuses, setEnabledStatuses] = useState<TaskStatus[]>(DEFAULT_ENABLED_STATUSES)
  const [toast, setToast] = useState<ToastState | null>(null)
  const hydratedScopeRef = useRef<string | null>(null)

  const scope = session?.scope
  const views = useLiveQuery(async () => (scope ? getTaskViews(scope) : []), [scope], [])

  useEffect(() => {
    if (!scope || typeof window === 'undefined') {
      hydratedScopeRef.current = null
      return
    }

    if (hydratedScopeRef.current !== scope) {
      hydratedScopeRef.current = scope
      setEnabledStatuses(readStoredStatusFilters(scope))
      return
    }

    window.localStorage.setItem(getStorageKey(scope), JSON.stringify(enabledStatuses))
  }, [enabledStatuses, scope])

  useEffect(() => {
    if (!toast) {
      return
    }

    const timeout = window.setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current))
    }, toast.durationMs)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [toast])

  const enabledStatusSet = new Set<string>(enabledStatuses)
  const filteredViews = views.filter((view) => enabledStatusSet.has(view.task.status))
  const hasAnyTask = views.length > 0
  const assigneeQueries = useQueries({
    queries: filteredViews.map((view) => ({
      queryKey: ['assignees', view.task.remoteId],
      queryFn: async () => {
        if (!view.task.remoteId) {
          return []
        }
        return listTaskAssignees(view.task.remoteId)
      },
      enabled: Boolean(session?.mode === 'authenticated' && view.task.remoteId),
      staleTime: 60_000,
    })),
  })
  const assigneeCountByTaskId = new Map(
    filteredViews.map((view, index) => [view.task.id, assigneeQueries[index]?.data?.length ?? 0]),
  )

  if (!session || !scope) {
    return null
  }

  const showToast = (message: string, action?: ToastAction, durationMs = TOAST_DURATION_MS) => {
    setToast({
      id: Date.now(),
      message,
      action,
      durationMs,
    })
  }

  const handleQuickValidation = async (taskId: string, remoteTaskId?: string) => {
    const created = await createValidationLocal(
      scope,
      taskId,
      null,
      session.userId,
      session.mode === 'guest' ? 'Invité' : session.email,
    )

    showToast('Validation ajoutée.', {
      label: 'Annuler',
      onClick: async () => {
        const current = await getValidationLocal(scope, created.id)
        if (!current) {
          showToast("Impossible d'annuler: validation introuvable.", undefined, TOAST_UNDO_DURATION_MS)
          return
        }

        if (current.remoteId && remoteTaskId && session.mode === 'authenticated') {
          await deleteValidation(remoteTaskId, current.remoteId)
        }

        await removeValidationLocal(scope, created.id)
        showToast('Validation annulée.', undefined, TOAST_UNDO_DURATION_MS)
      },
    })
  }

  const handleToastAction = async () => {
    if (!toast?.action) {
      return
    }

    try {
      await toast.action.onClick()
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : "Impossible d'annuler cette action"
      showToast(message, undefined, TOAST_UNDO_DURATION_MS)
    }
  }

  const handleRowClick = (event: React.MouseEvent<HTMLElement>, taskId: string) => {
    const target = event.target as HTMLElement
    if (target.closest('button, a, input, textarea, select, label')) {
      return
    }
    void navigate(`/tasks/${taskId}`)
  }

  const handleRowKeyDown = (event: React.KeyboardEvent<HTMLElement>, taskId: string) => {
    const target = event.target as HTMLElement
    if (target.closest('button, a, input, textarea, select, label')) {
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      void navigate(`/tasks/${taskId}`)
    }
  }

  const toggleStatusFilter = (status: TaskStatus) => {
    setEnabledStatuses((current) =>
      current.includes(status) ? current.filter((value) => value !== status) : [...current, status],
    )
  }

  return (
    <section className="page page-with-fab">
      <div className="page-body reveal">
        <div className="section-head">
          <h1>Mes tâches</h1>
          <div className="status-filters" role="group" aria-label="Filtrer les tâches par statut">
            {STATUS_FILTER_TAGS.map((tag) => {
              const isActive = enabledStatusSet.has(tag.status)
              return (
                <button
                  key={tag.status}
                  type="button"
                  className={`ghost compact status-filter-tag ${isActive ? 'status-filter-tag-active' : ''}`}
                  aria-pressed={isActive}
                  onClick={() => toggleStatusFilter(tag.status)}
                >
                  {tag.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="task-list">
          {filteredViews.length === 0 && (
            <div className="card">
              <p>{hasAnyTask ? 'Aucune tâche ne correspond aux statuts sélectionnés.' : 'Aucune tâche pour le moment.'}</p>
            </div>
          )}
          {filteredViews.map((view) => {
            const latestValidation = view.validations[0]
            const hasMultipleAssignees = (assigneeCountByTaskId.get(view.task.id) ?? 0) > 1

            return (
              <article
                key={view.task.id}
                className="task-row task-row-clickable"
                role="link"
                tabIndex={0}
                onClick={(event) => handleRowClick(event, view.task.id)}
                onKeyDown={(event) => handleRowKeyDown(event, view.task.id)}
              >
                <div className="task-main">
                  <div className="task-head">
                    <div className="task-head-main">
                      <p className="task-title">{view.task.label}</p>
                      {view.task.category && <span className="task-category-tag">{view.task.category}</span>}
                    </div>
                    <span className={`task-status-badge ${getTaskStatusClassName(view.task.status)}`}>
                      {getTaskStatusLabel(view.task.status)}
                    </span>
                  </div>
                  <div className="task-meta">
                    {latestValidation ? (
                      <span>
                        Dernière validation:{' '}
                        <span className="task-last-validation-date">
                          {formatValidationDateTime(latestValidation.createdAt)}
                        </span>
                        {hasMultipleAssignees
                          ? ` · par ${getValidationAuthorName(latestValidation.userDisplayName, latestValidation.userId)}`
                          : ''}
                      </span>
                    ) : (
                      <span>Aucune validation</span>
                    )}
                    {view.task.syncError && <span className="error">échec de synchronisation</span>}
                  </div>
                </div>
                <div className="task-actions">
                  <QuickValidateButton onConfirm={() => handleQuickValidation(view.task.id, view.task.remoteId)} />
                </div>
              </article>
            )
          })}
        </div>
      </div>

      <Link className="fab-add" to="/tasks/new" aria-label="Créer une tâche" title="Créer une tâche">
        <span className="fab-add-circle" aria-hidden="true">
          +
        </span>
        <span className="fab-add-label">Créer tâche</span>
      </Link>
      <ToastMessage toast={toast} onAction={handleToastAction} />
    </section>
  )
}
