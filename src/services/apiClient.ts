import { getSession, setSession, updateSessionTokens } from '../auth/sessionStore'
import type { AuthTokens } from '../types'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

interface JsonRequestOptions extends RequestInit {
  skipAuth?: boolean
  retried?: boolean
}

function toHeaders(headers?: HeadersInit): Headers {
  return new Headers(headers)
}

async function parseError(response: Response) {
  const text = await response.text()
  if (!text) {
    return `HTTP ${response.status}`
  }

  try {
    const parsed = JSON.parse(text) as { detail?: string }
    return parsed.detail || text
  } catch {
    return text
  }
}

async function refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
  const response = await fetch('/api/v1/auth/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })

  if (!response.ok) {
    throw new ApiError(await parseError(response), response.status)
  }

  return (await response.json()) as AuthTokens
}

async function request(path: string, options: JsonRequestOptions = {}): Promise<Response> {
  const session = getSession()
  const headers = toHeaders(options.headers)

  if (!options.skipAuth && session?.mode === 'authenticated' && session.accessToken) {
    headers.set('Authorization', `Bearer ${session.accessToken}`)
  }

  const response = await fetch(path, {
    ...options,
    headers,
  })

  if (
    response.status === 401 &&
    !options.skipAuth &&
    !options.retried &&
    session?.mode === 'authenticated' &&
    session.refreshToken
  ) {
    try {
      const refreshed = await refreshAccessToken(session.refreshToken)
      updateSessionTokens(refreshed)
      return request(path, {
        ...options,
        retried: true,
      })
    } catch {
      setSession(null)
      throw new ApiError('Session expirée. Reconnectez-vous.', 401)
    }
  }

  return response
}

export async function requestJson<T>(path: string, options: JsonRequestOptions = {}): Promise<T> {
  const response = await request(path, options)

  if (!response.ok) {
    throw new ApiError(await parseError(response), response.status)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}
