import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { QuickValidateButton } from '../components/QuickValidateButton'
import { useAuth } from '../auth/useAuth'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { assignTaskByEmail, listTaskAssignees } from '../services/backendApi'
import { getTaskView, updateTaskLocal, createValidationLocal } from '../services/taskStore'
import type { TaskStatus } from '../types'

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
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canUseAssignees = Boolean(
    session?.mode === 'authenticated' && online && view?.task.remoteId && view.task.status !== 'archived',
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
    mutationFn: async () => {
      if (!view?.task.remoteId) {
        throw new Error("La tâche n'est pas encore synchronisée.")
      }
      return assignTaskByEmail(view.task.remoteId, assignEmail.trim())
    },
    onSuccess: () => {
      setAssignEmail('')
      setMessage('Assignation ajoutée.')
      setError(null)
      void queryClient.invalidateQueries({ queryKey: ['assignees', view?.task.remoteId] })
    },
    onError: (mutationError: unknown) => {
      setMessage(null)
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
    setMessage('Tâche mise à jour.')
    setError(null)
  }

  const handleValidation = async () => {
    await createValidationLocal(
      scope,
      view.task.id,
      validationNote,
      session.userId,
      session.mode === 'guest' ? 'Invité' : session.email,
    )
    setValidationNote('')
    setMessage('Validation ajoutée.')
    setError(null)
  }

  const handleAssign = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!assignEmail.trim()) {
      setError("L'email est requis.")
      return
    }
    setError(null)
    assignMutation.mutate()
  }

  return (
    <section className="page reveal">
      <div className="section-head">
        <h1>Détail tâche</h1>
        <Link className="ghost compact link-like center" to="/tasks">
          Retour liste
        </Link>
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
            <option value="active">active</option>
            <option value="suspended">suspended</option>
            <option value="done">done</option>
            <option value="archived">archived</option>
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
          <div className="task-meta">
            {assigneesQuery.data.map((assignee) => (
              <span key={assignee.id}>{assignee.email}</span>
            ))}
          </div>
        )}
      </div>

      <div className="card stack gap-12">
        <h2>Timeline validations</h2>
        <ul className="timeline">
          {view.validations.map((validation) => (
            <li key={validation.id}>
              <div className="timeline-head">
                <span>{validation.userDisplayName || validation.userId || 'Utilisateur'}</span>
                <span>{new Date(validation.createdAt).toLocaleString('fr-FR')}</span>
              </div>
              <p>{validation.note || 'Aucune note'}</p>
            </li>
          ))}
          {view.validations.length === 0 && <li>Aucune validation pour cette tâche.</li>}
        </ul>
      </div>

      {message && (
        <p className="pill" style={{ width: 'fit-content' }}>
          {message}
        </p>
      )}
      {error && (
        <p className="error" style={{ width: 'fit-content' }}>
          {error}
        </p>
      )}
    </section>
  )
}
