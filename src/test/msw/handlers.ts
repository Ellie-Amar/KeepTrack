import { HttpResponse, http } from 'msw'

export const handlers = [
  http.get('/api/v1/tasks', () => {
    return HttpResponse.json([])
  }),
]

