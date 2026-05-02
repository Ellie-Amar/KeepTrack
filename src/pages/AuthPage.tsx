import { useMutation } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/useAuth'
import { importGuestDataToScope } from '../services/guestImportService'

type AuthMode = 'login' | 'signup'

export function AuthPage() {
  const navigate = useNavigate()
  const { session, continueAsGuest, loginWithPassword, signupAndLogin } = useAuth()
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showGuestImportModal, setShowGuestImportModal] = useState(false)
  const [importScope, setImportScope] = useState<string | null>(null)
  const [authFlowActive, setAuthFlowActive] = useState(false)

  const authMutation = useMutation({
    mutationFn: async () => {
      if (mode === 'signup') {
        return signupAndLogin(email.trim(), password, displayName)
      }
      return loginWithPassword(email.trim(), password)
    },
    onSuccess: (result) => {
      setError(null)
      if (result.needsGuestImport) {
        setImportScope(result.session.scope)
        setShowGuestImportModal(true)
        return
      }
      setAuthFlowActive(false)
      void navigate('/tasks')
    },
    onError: (mutationError: unknown) => {
      setAuthFlowActive(false)
      const message = mutationError instanceof Error ? mutationError.message : 'Erreur inconnue'
      setError(message)
    },
  })

  useEffect(() => {
    if (session && !showGuestImportModal && !authFlowActive && !authMutation.isPending) {
      void navigate('/tasks')
    }
  }, [authFlowActive, authMutation.isPending, navigate, session, showGuestImportModal])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!email.trim() || !password.trim()) {
      setError('Email et mot de passe requis.')
      return
    }
    setAuthFlowActive(true)
    authMutation.mutate()
  }

  const handleGuest = () => {
    continueAsGuest()
    setAuthFlowActive(false)
    void navigate('/tasks')
  }

  const handleImportConfirm = async () => {
    if (importScope) {
      await importGuestDataToScope(importScope)
    }
    setShowGuestImportModal(false)
    setAuthFlowActive(false)
    void navigate('/tasks')
  }

  const handleImportSkip = () => {
    setShowGuestImportModal(false)
    setAuthFlowActive(false)
    void navigate('/tasks')
  }

  return (
    <div className="auth-card card reveal">
      <div className="stack gap-8">
        <h1>KeepTrack</h1>
        <p>{mode === 'login' ? 'Connexion' : 'Inscription'}</p>
      </div>

      <form className="stack gap-12" onSubmit={handleSubmit}>
        <label className="stack gap-6">
          <span>Email</span>
          <input value={email} type="email" autoComplete="email" onChange={(event) => setEmail(event.target.value)} />
        </label>

        {mode === 'signup' && (
          <label className="stack gap-6">
            <span>Nom affiché</span>
            <input
              value={displayName}
              type="text"
              autoComplete="name"
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>
        )}

        <label className="stack gap-6">
          <span>Mot de passe</span>
          <input
            value={password}
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {error && <p className="error">{error}</p>}

        <div className="row gap-8">
          <button className="primary" type="submit" disabled={authMutation.isPending}>
            {authMutation.isPending ? 'Connexion...' : mode === 'login' ? 'Se connecter' : "S'inscrire"}
          </button>
          <button
            className="ghost"
            type="button"
            disabled={authMutation.isPending}
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
          >
            {mode === 'login' ? 'Créer un compte' : 'Déjà un compte'}
          </button>
        </div>
        {session && (
          <button className="ghost compact" type="button" onClick={() => navigate('/tasks')}>
            Continuer vers les tâches
          </button>
        )}
      </form>

      <div className="row">
        <button className="ghost" type="button" onClick={handleGuest}>
          Continuer en invité
        </button>
      </div>

      {showGuestImportModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>Importer vos données invitées ?</h2>
            <p>Des données locales invitées ont été détectées. Voulez-vous les importer dans votre compte ?</p>
            <div className="row gap-8 end">
              <button type="button" className="ghost" onClick={handleImportSkip}>
                Ignorer
              </button>
              <button type="button" className="primary" onClick={handleImportConfirm}>
                Importer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
