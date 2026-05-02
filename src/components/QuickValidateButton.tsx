import { useEffect, useState } from 'react'

interface QuickValidateButtonProps {
  onConfirm: () => Promise<void> | void
  disabled?: boolean
}

const CONFIRM_WINDOW_MS = 3500

export function QuickValidateButton({ onConfirm, disabled = false }: QuickValidateButtonProps) {
  const [armedAt, setArmedAt] = useState<number | null>(null)

  useEffect(() => {
    if (!armedAt) {
      return
    }

    const timeout = window.setTimeout(() => {
      setArmedAt(null)
    }, CONFIRM_WINDOW_MS)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [armedAt])

  const isArmed = armedAt !== null

  const handleClick = async () => {
    if (disabled) {
      return
    }

    if (!isArmed) {
      setArmedAt(Date.now())
      return
    }

    setArmedAt(null)
    await onConfirm()
  }

  return (
    <button type="button" className={isArmed ? 'ghost compact' : 'primary compact'} onClick={handleClick} disabled={disabled}>
      {isArmed ? 'Confirmer validation' : 'Valider'}
    </button>
  )
}
