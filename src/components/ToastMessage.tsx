import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

interface ToastRingGeometry {
  path: string
  viewBox: string
}

export interface ToastAction {
  label: string
  onClick: () => Promise<void> | void
}

export interface ToastState {
  id: number
  message: string
  action?: ToastAction
  durationMs: number
}

interface ToastMessageProps {
  toast: ToastState | null
  onAction: () => Promise<void> | void
}

const TOAST_RING_WIDTH_FALLBACK_PX = 2
const TOAST_RING_PATH_LENGTH = 100

const parseCssPixels = (value: string, fallback = 0) => {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const createRoundedRectPath = (
  left: number,
  top: number,
  right: number,
  bottom: number,
  radius: number,
) => {
  const xStart = left + radius
  const xEnd = right - radius
  const yStart = top + radius
  const yEnd = bottom - radius

  return [
    `M ${xStart} ${top}`,
    `H ${xEnd}`,
    `A ${radius} ${radius} 0 0 1 ${right} ${yStart}`,
    `V ${yEnd}`,
    `A ${radius} ${radius} 0 0 1 ${xEnd} ${bottom}`,
    `H ${xStart}`,
    `A ${radius} ${radius} 0 0 1 ${left} ${yEnd}`,
    `V ${yStart}`,
    `A ${radius} ${radius} 0 0 1 ${xStart} ${top}`,
    'Z',
  ].join(' ')
}

const buildToastRingGeometry = (element: HTMLDivElement): ToastRingGeometry | null => {
  const { width, height } = element.getBoundingClientRect()
  if (width <= 0 || height <= 0) {
    return null
  }

  const computed = window.getComputedStyle(element)
  const borderRadius = parseCssPixels(computed.borderTopLeftRadius)
  const ringWidth = parseCssPixels(computed.getPropertyValue('--toast-ring-width'), TOAST_RING_WIDTH_FALLBACK_PX)
  const inset = ringWidth / 2
  const innerWidth = Math.max(0, width - ringWidth)
  const innerHeight = Math.max(0, height - ringWidth)
  const radius = Math.min(borderRadius, innerWidth / 2, innerHeight / 2)
  const left = inset
  const top = inset
  const right = left + innerWidth
  const bottom = top + innerHeight

  return {
    viewBox: `0 0 ${width} ${height}`,
    path: createRoundedRectPath(left, top, right, bottom, radius),
  }
}

export function ToastMessage({ toast, onAction }: ToastMessageProps) {
  const toastRef = useRef<HTMLDivElement | null>(null)
  const [toastRing, setToastRing] = useState<ToastRingGeometry | null>(null)

  useEffect(() => {
    if (!toast) {
      setToastRing(null)
      return
    }

    const toastElement = toastRef.current
    if (!toastElement) {
      return
    }

    const updateToastRing = () => {
      setToastRing(buildToastRingGeometry(toastElement))
    }

    updateToastRing()
    const observer = new ResizeObserver(updateToastRing)
    observer.observe(toastElement)

    return () => {
      observer.disconnect()
    }
  }, [toast])

  if (!toast) {
    return null
  }

  return (
    <div
      ref={toastRef}
      className="toast-message"
      role="status"
      aria-live="polite"
      style={{ '--toast-duration': `${toast.durationMs}ms` } as CSSProperties}
    >
      {toastRing && (
        <svg className="toast-ring" viewBox={toastRing.viewBox} preserveAspectRatio="none" aria-hidden="true">
          <path className="toast-ring-track" d={toastRing.path} pathLength={TOAST_RING_PATH_LENGTH} />
          <path className="toast-ring-remaining" d={toastRing.path} pathLength={TOAST_RING_PATH_LENGTH} />
          <path className="toast-ring-spark" d={toastRing.path} pathLength={TOAST_RING_PATH_LENGTH} />
        </svg>
      )}
      <span className="toast-text">{toast.message}</span>
      <div className="toast-controls">
        {toast.action && (
          <button
            type="button"
            className="toast-action toast-action-undo"
            onClick={() => {
              void onAction()
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
    </div>
  )
}
