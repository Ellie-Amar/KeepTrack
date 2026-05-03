import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/useAuth'
import { createTaskLocal } from '../services/taskStore'
import type { TaskStatus } from '../types'
import { getTaskStatusLabel } from '../utils/taskStatusLabel'

const DEFAULT_STATUS: TaskStatus = 'active'

export function NewTaskPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [label, setLabel] = useState('')
  const [note, setNote] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState<TaskStatus>(DEFAULT_STATUS)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scope = session?.scope

  if (!session || !scope) {
    return null
  }

  const handleCreateTask = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!label.trim()) {
      setError('Le titre est requis.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const task = await createTaskLocal(scope, {
        label,
        note,
        category,
        status,
      })
      void navigate(`/tasks/${task.id}`)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Erreur de création')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="page reveal">
      <div className="section-head">
        <h1>Nouvelle tâche</h1>
        <Link className="ghost compact link-like center" to="/tasks">
          Retour liste
        </Link>
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
          <textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
        <label className="stack gap-6">
          <span>Statut</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as TaskStatus)}>
            <option value="active">{getTaskStatusLabel('active')}</option>
            <option value="suspended">{getTaskStatusLabel('suspended')}</option>
            <option value="done">{getTaskStatusLabel('done')}</option>
            <option value="archived">{getTaskStatusLabel('archived')}</option>
          </select>
        </label>
        <div className="row end">
          <button className="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Création...' : 'Créer la tâche'}
          </button>
        </div>
        {error && (
          <p className="error" style={{ gridColumn: '1 / -1' }}>
            {error}
          </p>
        )}
      </form>
    </section>
  )
}
