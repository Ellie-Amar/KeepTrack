import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { useState } from 'react'

import { QuickValidateButton } from '../components/QuickValidateButton'
import { useAuth } from '../auth/useAuth'
import { getTaskViews, createTaskLocal, createValidationLocal } from '../services/taskStore'
import type { TaskStatus } from '../types'

const DEFAULT_STATUS: TaskStatus = 'active'

export function TasksPage() {
  const { session } = useAuth()
  const [label, setLabel] = useState('')
  const [note, setNote] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState<TaskStatus>(DEFAULT_STATUS)
  const [error, setError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const scope = session?.scope
  const views = useLiveQuery(async () => (scope ? getTaskViews(scope) : []), [scope], [])

  if (!session || !scope) {
    return null
  }

  const filteredViews = views.filter((view) => showArchived || view.task.status !== 'archived')

  const handleCreateTask = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!label.trim()) {
      setError('Le titre est requis.')
      return
    }

    setError(null)
    await createTaskLocal(scope, {
      label,
      note,
      category,
      status,
    })

    setLabel('')
    setNote('')
    setCategory('')
    setStatus(DEFAULT_STATUS)
  }

  const handleQuickValidation = async (taskId: string) => {
    await createValidationLocal(
      scope,
      taskId,
      null,
      session.userId,
      session.mode === 'guest' ? 'Invité' : session.email,
    )
  }

  return (
    <section className="page reveal">
      <div className="section-head">
        <h1>Mes tâches</h1>
        <button type="button" className="ghost compact" onClick={() => setShowArchived((value) => !value)}>
          {showArchived ? 'Masquer archivées' : 'Voir archivées'}
        </button>
      </div>

      <form className="card grid-form" onSubmit={handleCreateTask}>
        <label className="stack gap-6">
          <span>Titre</span>
          <input value={label} onChange={(event) => setLabel(event.target.value)} />
        </label>
        <label className="stack gap-6">
          <span>Catégorie</span>
          <input value={category} onChange={(event) => setCategory(event.target.value)} />
        </label>
        <label className="stack gap-6" style={{ gridColumn: '1 / -1' }}>
          <span>Note</span>
          <textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
        <label className="stack gap-6">
          <span>Statut</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as TaskStatus)}>
            <option value="active">active</option>
            <option value="suspended">suspended</option>
            <option value="done">done</option>
            <option value="archived">archived</option>
          </select>
        </label>
        <div className="row end">
          <button className="primary" type="submit">
            Ajouter une tâche
          </button>
        </div>
        {error && (
          <p className="error" style={{ gridColumn: '1 / -1' }}>
            {error}
          </p>
        )}
      </form>

      <div className="task-list">
        {filteredViews.length === 0 && (
          <div className="card">
            <p>Aucune tâche pour le moment.</p>
          </div>
        )}
        {filteredViews.map((view) => (
          <article key={view.task.id} className="task-row">
            <div className="task-main">
              <Link className="task-title" to={`/tasks/${view.task.id}`}>
                {view.task.label}
              </Link>
              <div className="task-meta">
                <span>{view.task.status}</span>
                {view.task.category && <span>{view.task.category}</span>}
                <span>{view.validations.length} validation(s)</span>
                {view.task.pendingSync && <span>sync pending</span>}
                {view.task.syncError && <span className="error">sync failed</span>}
              </div>
            </div>
            <div className="task-actions">
              <QuickValidateButton onConfirm={() => handleQuickValidation(view.task.id)} />
              <Link className="ghost compact link-like center" to={`/tasks/${view.task.id}`}>
                Modifier
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
