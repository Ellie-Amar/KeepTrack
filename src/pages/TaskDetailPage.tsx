import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'

import { QuickValidateButton } from '../components/QuickValidateButton'
import { ToastMessage } from '../components/ToastMessage'
import type { ToastAction, ToastState } from '../components/ToastMessage'
import { useAuth } from '../auth/useAuth'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { assignTaskByEmail, deleteValidation, listTaskAssignees, unassignTaskUser } from '../services/backendApi'
import {
  createValidationLocal,
  getTaskView,
  getValidationLocal,
  removeValidationLocal,
  restoreValidationLocal,
  updateTaskLocal,
} from '../services/taskStore'
import type { TaskStatus } from '../types'
import { getTaskStatusLabel } from '../utils/taskStatusLabel'

const TOAST_DURATION_MS = 5000
const TOAST_UNDO_DURATION_MS = 3000
const USER_ACCENTS = [
  '#2ec4b6',
  '#ff8f00',
  '#ffd400',
  '#8ac926',
  '#06d6a0',
  '#e76f51',
  '#00d1b2',
  '#ffb703',
  '#7bd389',
  '#ff6b35',
  '#c3d82c',
  '#f4a261',
  '#ff6b6b',
  '#55d6be',
  '#f77f00',
  '#b8de6f',
  '#44af69',
]

function hashString(input: string): number {
  let hash = 0
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) | 0
  }
  return Math.abs(hash)
}

function getUserAccent(userId: string | null): string | null {
  if (!userId) {
    return null
  }
  return USER_ACCENTS[hashString(userId) % USER_ACCENTS.length]
}

function getUserAccentStyle(userId: string | null): CSSProperties | undefined {
  const accent = getUserAccent(userId)
  if (!accent) {
    return undefined
  }
  return { '--user-accent': accent } as CSSProperties
}

export function TaskDetailPage() {
  const { session } = useAuth()
  const { taskId } = useParams()
  const online = useOnlineStatus()
  const queryClient = useQueryClient()

  const scope = session?.scope
  const view = useLiveQuery(
    async () => (scope && taskId ? getTaskView(scope, taskId) : null),
    [scope, taskId],
    null,
  )

  const [assignEmail, setAssignEmail] = useState('')
  const [validationNote, setValidationNote] = useState('')
  const [deletingValidationId, setDeletingValidationId] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pendingRemoteValidationDeletesRef = useRef<Map<string, number>>(new Map())

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

  useEffect(
    () => () => {
      for (const timeoutId of pendingRemoteValidationDeletesRef.current.values()) {
        window.clearTimeout(timeoutId)
      }
      pendingRemoteValidationDeletesRef.current.clear()
    },
    [],
  )

  const showToast = (message: string, action?: ToastAction, durationMs = TOAST_DURATION_MS) => {
    setToast({
      id: Date.now(),
      message,
      action,
      durationMs,
    })
  }

  const canUseAssignees = Boolean(
    session?.mode === 'authenticated' &&
      online &&
      view?.task.remoteId &&
      view.task.status !== 'archived' &&
      (view.task.ownerId ? view.task.ownerId === session.userId : true),
  )

  const assigneesQuery = useQuery({
    queryKey: ['assignees', view?.task.remoteId],
    queryFn: async () => {
      if (!view?.task.remoteId) {
        return []
      }
      return listTaskAssignees(view.task.remoteId)
    },
    enabled: canUseAssignees,
  })

  const assignMutation = useMutation({
    mutationFn: async (email: string) => {
      if (!view?.task.remoteId) {
        throw new Error("La tâche n'est pas encore synchronisée.")
      }
      return assignTaskByEmail(view.task.remoteId, email)
    },
    onSuccess: (users, assignedEmail) => {
      setAssignEmail('')
      const normalizedEmail = assignedEmail.toLowerCase()
      const addedUser = users.find((user) => user.email.toLowerCase() === normalizedEmail) || users[0]
      const remoteTaskId = view?.task.remoteId

      if (addedUser && remoteTaskId) {
        showToast('Assignation ajoutée.', {
          label: 'Annuler',
          onClick: async () => {
            await unassignTaskUser(remoteTaskId, addedUser.id)
            showToast('Assignation annulée.', undefined, TOAST_UNDO_DURATION_MS)
            void queryClient.invalidateQueries({ queryKey: ['assignees', remoteTaskId] })
          },
        })
      } else {
        showToast('Assignation ajoutée.')
      }

      setError(null)
      void queryClient.invalidateQueries({ queryKey: ['assignees', view?.task.remoteId] })
    },
    onError: (mutationError: unknown) => {
      setToast(null)
      setError(mutationError instanceof Error ? mutationError.message : 'Erreur assignation')
    },
  })

  if (!session || !scope || !taskId) {
    return null
  }

  if (!view) {
    return (
      <section className="card reveal">
        <p>Tâche introuvable.</p>
        <Link to="/tasks" className="link-like">
          Retour à la liste
        </Link>
      </section>
    )
  }

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const data = new FormData(event.currentTarget)
    const nextLabel = String(data.get('label') || '').trim()
    const nextNote = String(data.get('note') || '').trim()
    const nextCategory = String(data.get('category') || '').trim()
    const nextStatus = String(data.get('status') || 'active') as TaskStatus

    if (!nextLabel) {
      setError('Le titre est requis.')
      return
    }

    await updateTaskLocal(scope, view.task.id, {
      label: nextLabel,
      note: nextNote,
      category: nextCategory,
      status: nextStatus,
    })
    showToast('Tâche mise à jour.')
    setError(null)
  }

  const handleValidation = async () => {
    const created = await createValidationLocal(
      scope,
      view.task.id,
      validationNote,
      session.userId,
      session.mode === 'guest' ? 'Invité' : session.email,
    )
    setValidationNote('')
    showToast('Validation ajoutée.', {
      label: 'Annuler',
      onClick: async () => {
        const current = await getValidationLocal(scope, created.id)
        if (!current) {
          showToast("Impossible d'annuler: validation introuvable.", undefined, TOAST_UNDO_DURATION_MS)
          return
        }

        if (current.remoteId && view.task.remoteId && session.mode === 'authenticated') {
          await deleteValidation(view.task.remoteId, current.remoteId)
        }

        await removeValidationLocal(scope, created.id)
        showToast('Validation annulée.', undefined, TOAST_UNDO_DURATION_MS)
      },
    })
    setError(null)
  }

  const handleAssign = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!assignEmail.trim()) {
      setError('L\'email est requis.')
      return
    }
    setError(null)
    assignMutation.mutate(assignEmail.trim())
  }

  const canDeleteValidation = (validationUserId: string | null, validationRemoteId?: string) => {
    if (session.mode === 'guest') {
      return !validationRemoteId
    }

    return validationUserId === session.userId
  }

  const clearPendingRemoteDelete = (validationId: string) => {
    const timeoutId = pendingRemoteValidationDeletesRef.current.get(validationId)
    if (!timeoutId) {
      return
    }
    window.clearTimeout(timeoutId)
    pendingRemoteValidationDeletesRef.current.delete(validationId)
  }

  const scheduleRemoteDelete = (taskRemoteId: string, validationRemoteId: string, validationId: string) => {
    const timeoutId = window.setTimeout(() => {
      pendingRemoteValidationDeletesRef.current.delete(validationId)
      void (async () => {
        try {
          await deleteValidation(taskRemoteId, validationRemoteId)
        } catch (deleteError) {
          setError(deleteError instanceof Error ? deleteError.message : 'Erreur suppression validation')
        }
      })()
    }, TOAST_DURATION_MS)

    pendingRemoteValidationDeletesRef.current.set(validationId, timeoutId)
  }

  const handleDeleteValidation = async (validationId: string) => {
    const validation = await getValidationLocal(scope, validationId)
    if (!validation) {
      setError('Validation introuvable.')
      return
    }

    setDeletingValidationId(validationId)

    try {
      let remoteDeletePayload: { taskRemoteId: string; validationRemoteId: string } | null = null
      if (session.mode === 'authenticated' && validation.remoteId) {
        if (!online) {
          throw new Error('Mode hors ligne: suppression indisponible pour une validation synchronisée.')
        }
        if (!view.task.remoteId) {
          throw new Error("La tâche n'est pas encore synchronisée.")
        }
        remoteDeletePayload = {
          taskRemoteId: view.task.remoteId,
          validationRemoteId: validation.remoteId,
        }
      }

      await removeValidationLocal(scope, validation.id)
      if (remoteDeletePayload) {
        scheduleRemoteDelete(remoteDeletePayload.taskRemoteId, remoteDeletePayload.validationRemoteId, validation.id)
      }

      showToast('Validation supprimée.', {
        label: 'Annuler',
        onClick: async () => {
          clearPendingRemoteDelete(validation.id)
          await restoreValidationLocal(scope, validation)
          showToast('Suppression annulée.', undefined, TOAST_UNDO_DURATION_MS)
        },
      })
      setError(null)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Erreur suppression validation')
    } finally {
      setDeletingValidationId((current) => (current === validationId ? null : current))
    }
  }

  const handleToastAction = async () => {
    if (!toast?.action) {
      return
    }

    try {
      await toast.action.onClick()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Impossible d'annuler cette action")
      setToast(null)
    }
  }

  return (
    <section className="page">
      <div className="page-body reveal">
        <div className="section-head section-head-back">
          <Link className="back-link" to="/tasks" aria-label="Retour à la liste">
            <span aria-hidden="true">←</span>
            <span>Retour</span>
          </Link>
          <h1>Détail tâche</h1>
        </div>

        <form key={`${view.task.id}:${view.task.updatedAt}`} className="card stack gap-12" onSubmit={handleSave}>
          <label className="stack gap-6">
            <span>Titre</span>
            <input name="label" defaultValue={view.task.label} />
          </label>

          <label className="stack gap-6">
            <span>Catégorie</span>
            <input name="category" defaultValue={view.task.category ?? ''} />
          </label>

          <label className="stack gap-6">
            <span>Note</span>
            <textarea name="note" rows={3} defaultValue={view.task.note ?? ''} />
          </label>

          <label className="stack gap-6">
            <span>Statut</span>
            <select name="status" defaultValue={view.task.status}>
              <option value="active">{getTaskStatusLabel('active')}</option>
              <option value="suspended">{getTaskStatusLabel('suspended')}</option>
              <option value="done">{getTaskStatusLabel('done')}</option>
              <option value="archived">{getTaskStatusLabel('archived')}</option>
            </select>
          </label>

          <div className="row end">
            <button className="primary" type="submit">
              Enregistrer
            </button>
          </div>
        </form>

        <div className="card stack gap-12">
          <h2>Validation rapide</h2>
          <label className="stack gap-6">
            <span>Note de validation (optionnel)</span>
            <input
              value={validationNote}
              onChange={(event) => setValidationNote(event.target.value)}
              placeholder="Ex: Revue terminée"
            />
          </label>
          <div className="row end">
            <QuickValidateButton onConfirm={handleValidation} />
          </div>
        </div>

        <div className="card stack gap-12">
          <h2>Assignation par email</h2>
          {session.mode !== 'authenticated' && <p className="warning">Connectez-vous pour assigner des utilisateurs.</p>}
          {session.mode === 'authenticated' && view.task.ownerId && view.task.ownerId !== session.userId && (
            <p className="warning">Seul le propriétaire de la tâche peut assigner des utilisateurs.</p>
          )}
          {session.mode === 'authenticated' && !online && <p className="warning">Mode hors ligne: assignation indisponible.</p>}
          {session.mode === 'authenticated' && !view.task.remoteId && (
            <p className="warning">La tâche doit être synchronisée avant assignation.</p>
          )}

          <form className="row gap-8 center" onSubmit={handleAssign}>
            <input
              type="email"
              value={assignEmail}
              placeholder="email@exemple.com"
              onChange={(event) => setAssignEmail(event.target.value)}
              disabled={!canUseAssignees || assignMutation.isPending}
            />
            <button type="submit" className="primary compact" disabled={!canUseAssignees || assignMutation.isPending}>
              Assigner
            </button>
          </form>

          {assigneesQuery.isSuccess && assigneesQuery.data.length > 0 && (
            <div className="assignee-list">
              {assigneesQuery.data.map((assignee) => {
                const [localPart = assignee.email, domainPart = ''] = assignee.email.split('@')
                return (
                  <span
                    key={assignee.id}
                    className="assignee-chip assignee-chip-user"
                    title={assignee.email}
                    style={getUserAccentStyle(assignee.id)}
                  >
                    <span className="assignee-local">{localPart}</span>
                    {domainPart && <span className="assignee-domain">@{domainPart}</span>}
                  </span>
                )
              })}
            </div>
          )}
        </div>

        <div className="card stack gap-12">
          <h2>Historique des validations</h2>
          <ul className="timeline">
            {view.validations.map((validation) => (
              <li
                key={validation.id}
                className={validation.userId ? 'timeline-item-user' : undefined}
                style={getUserAccentStyle(validation.userId)}
              >
                <div className="timeline-head">
                  <div className="timeline-head-meta">
                    <span>{validation.userDisplayName || validation.userId || 'Utilisateur'}</span>
                    <span>{new Date(validation.createdAt).toLocaleString('fr-FR')}</span>
                  </div>
                  {canDeleteValidation(validation.userId, validation.remoteId) && (
                    <QuickValidateButton
                      onConfirm={() => handleDeleteValidation(validation.id)}
                      disabled={deletingValidationId === validation.id}
                      idleLabel="Supprimer"
                      armedLabel="Recliquez pour supprimer"
                      idleClassName="ghost compact timeline-delete"
                    />
                  )}
                </div>
                <p>{validation.note || '-'}</p>
              </li>
            ))}
            {view.validations.length === 0 && <li>Aucune validation pour cette tâche.</li>}
          </ul>
        </div>

        {error && (
          <p className="error" style={{ width: 'fit-content' }}>
            {error}
          </p>
        )}
      </div>

      <ToastMessage toast={toast} onAction={handleToastAction} />
    </section>
  )
}
