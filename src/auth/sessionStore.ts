import type { AuthTokens, JwtClaims, Session } from '../types'

const SESSION_KEY = 'keeptrack.session.v1'
const GUEST_SCOPE = 'guest:local'

type SessionListener = (session: Session | null) => void

const listeners = new Set<SessionListener>()

function decodeJwtClaims(token: string): JwtClaims {
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('Access token manquant dans la réponse API')
  }

  const payload = token.split('.')[1]
  if (!payload) {
    throw new Error('Token payload is missing')
  }

  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const decoded = atob(padded)
  return JSON.parse(decoded) as JwtClaims
}

function safeDecodeJwtClaims(token: string): JwtClaims | null {
  try {
    return decodeJwtClaims(token)
  } catch {
    return null
  }
}

function parseSession(value: string | null): Session | null {
  if (!value) {
    return null
  }

  try {
    return JSON.parse(value) as Session
  } catch {
    return null
  }
}

let currentSession: Session | null = parseSession(localStorage.getItem(SESSION_KEY))

function emitSessionChange() {
  for (const listener of listeners) {
    listener(currentSession)
  }
}

export function getGuestScope() {
  return GUEST_SCOPE
}

export function createGuestSession(): Session {
  return {
    mode: 'guest',
    scope: GUEST_SCOPE,
    userId: null,
    email: null,
    accessToken: null,
    refreshToken: null,
    tokenType: 'bearer',
  }
}

export function createAuthenticatedSession(tokens: AuthTokens, fallbackEmail?: string): Session {
  const accessToken = tokens.access_token || tokens.accessToken || ''
  const refreshToken = tokens.refresh_token || tokens.refreshToken || null
  const tokenType = tokens.token_type || tokens.tokenType || 'bearer'
  const claims = safeDecodeJwtClaims(accessToken)
  const userId = claims?.sub || null
  const email = claims?.email || fallbackEmail?.trim().toLowerCase() || null
  const scope = userId ? `user:${userId}` : `user:email:${email || 'unknown'}`

  return {
    mode: 'authenticated',
    scope,
    userId,
    email,
    accessToken,
    refreshToken,
    tokenType,
  }
}

export function getSession() {
  return currentSession
}

export function setSession(session: Session | null) {
  currentSession = session

  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } else {
    localStorage.removeItem(SESSION_KEY)
  }

  emitSessionChange()
}

export function updateSessionTokens(tokens: AuthTokens) {
  if (!currentSession || currentSession.mode !== 'authenticated') {
    return
  }

  const nextAccessToken = tokens.access_token || tokens.accessToken || currentSession.accessToken
  const nextRefreshToken = tokens.refresh_token || tokens.refreshToken || currentSession.refreshToken

  currentSession = {
    ...currentSession,
    accessToken: nextAccessToken,
    refreshToken: nextRefreshToken,
    tokenType: tokens.token_type || tokens.tokenType || currentSession.tokenType,
  }

  localStorage.setItem(SESSION_KEY, JSON.stringify(currentSession))
  emitSessionChange()
}

export function subscribeSession(listener: SessionListener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
