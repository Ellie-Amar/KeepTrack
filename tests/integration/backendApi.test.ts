import { describe, expect, it } from 'vitest'
import { HttpResponse, http } from 'msw'

import { server } from '../../src/test/msw/server'
import { listTasks } from '../../src/services/backendApi'

describe('backendApi.listTasks', () => {
  it('normalizes task and validation payloads from API', async () => {
    server.use(
      http.get('/api/v1/tasks', () => {
        return HttpResponse.json([
          {
            id: 'remote-task-1',
            ownerId: 'owner-1',
            label: 'Prepare release',
            note: 'with checklist',
            category: null,
            status: 'archived',
            order: null,
            createdAt: '2026-01-01T09:00:00.000Z',
            updatedAt: '2026-01-02T09:00:00.000Z',
            validations: [
              {
                id: 'validation-1',
                taskId: 'remote-task-1',
                note: null,
                createdAt: '2026-01-02T10:00:00.000Z',
                updatedAt: '2026-01-02T11:00:00.000Z',
                user: {
                  id: 'user-1',
                  displayName: 'Jane',
                },
              },
            ],
          },
        ])
      }),
    )

    const tasks = await listTasks()

    expect(tasks).toEqual([
      {
        id: 'remote-task-1',
        owner_id: 'owner-1',
        label: 'Prepare release',
        note: 'with checklist',
        category: null,
        status: 'done',
        order: 0,
        created_at: '2026-01-01T09:00:00.000Z',
        updated_at: '2026-01-02T09:00:00.000Z',
        validations: [
          {
            id: 'validation-1',
            task_id: 'remote-task-1',
            note: null,
            created_at: '2026-01-02T10:00:00.000Z',
            updated_at: '2026-01-02T11:00:00.000Z',
            user: {
              id: 'user-1',
              display_name: 'Jane',
            },
          },
        ],
      },
    ])
  })
})

