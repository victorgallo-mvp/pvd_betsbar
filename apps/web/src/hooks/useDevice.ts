import { useState, useEffect } from 'react'

// Detects whether the app is running on a portrait/POS device (width < 640 or
// portrait orientation) vs a landscape tablet. Components use this to switch
// between side-by-side (tablet) and stacked/tabbed (POS) layouts.
function check(): boolean {
  return window.matchMedia('(max-width: 639px), (orientation: portrait)').matches
}

export function useDevice() {
  const [isPOS, setIsPOS] = useState<boolean>(check)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px), (orientation: portrait)')
    const handler = () => setIsPOS(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return { isPOS, isTablet: !isPOS }
}
