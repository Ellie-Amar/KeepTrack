import { describe, expect, it } from 'vitest'

import { KNOWN_TASK_STATUSES, normalizeTaskStatus } from '../../src/utils/taskStatus'

describe('normalizeTaskStatus', () => {
  it('maps archived to done', () => {
    expect(normalizeTaskStatus('archived')).toBe('done')
  })

  it('falls back to active when status is missing', () => {
    expect(normalizeTaskStatus(undefined)).toBe('active')
    expect(normalizeTaskStatus(null)).toBe('active')
  })

  it('keeps known statuses unchanged', () => {
    for (const status of KNOWN_TASK_STATUSES) {
      expect(normalizeTaskStatus(status)).toBe(status)
    }
  })
})

