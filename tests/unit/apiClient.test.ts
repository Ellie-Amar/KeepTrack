import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getSession, setSession } from '../../src/auth/sessionStore'
import { requestJson } from '../../src/services/apiClient'
import type { Session } from '../../src/types'

const authenticatedSession: Session = {
  mode: 'authenticated',
  scope: 'user:42',
  userId: '42',
  email: 'jane@example.com',
  accessToken: 'access-old',
  refreshToken: 'refresh-token',
  tokenType: 'bearer',
}

describe('requestJson', () => {
  beforeEach(() => {
    setSession(null)
  })

  afterEach(() => {
    setSession(null)
  })

  it('sends Authorization header when authenticated', async () => {
    setSession(authenticatedSession)

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await requestJson('/api/v1/tasks')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const options = fetchMock.mock.calls[0]?.[1]
    const headers = new Headers(options?.headers)
    expect(headers.get('Authorization')).toBe('Bearer access-old')
  })

  it('refreshes access token and retries request on 401', async () => {
    setSession(authenticatedSession)

    const taskPayload = [{ id: 'task-1' }]
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input)

      if (url === '/api/v1/tasks') {
        const headers = new Headers(init?.headers)
        if (headers.get('Authorization') === 'Bearer access-new') {
          return new Response(JSON.stringify(taskPayload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        return new Response(JSON.stringify({ detail: 'expired' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (url === '/api/v1/auth/refresh') {
        return new Response(
          JSON.stringify({
            access_token: 'access-new',
            refresh_token: 'refresh-new',
            token_type: 'bearer',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      return new Response('not-found', { status: 404 })
    })

    const response = await requestJson<Array<{ id: string }>>('/api/v1/tasks')

    expect(response).toEqual(taskPayload)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(getSession()?.accessToken).toBe('access-new')
    expect(getSession()?.refreshToken).toBe('refresh-new')
  })

  it('clears session when refresh fails', async () => {
    setSession(authenticatedSession)

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)

      if (url === '/api/v1/tasks') {
        return new Response(JSON.stringify({ detail: 'expired' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (url === '/api/v1/auth/refresh') {
        return new Response(JSON.stringify({ detail: 'invalid refresh token' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return new Response('not-found', { status: 404 })
    })

    await expect(requestJson('/api/v1/tasks')).rejects.toMatchObject({
      status: 401,
      message: 'Session expirée. Reconnectez-vous.',
    })

    expect(getSession()).toBeNull()
  })
})
