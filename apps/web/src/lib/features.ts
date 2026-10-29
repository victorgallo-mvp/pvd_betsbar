import { useEffect, useState } from 'react'
import { api } from './api'

// Chaves de funcionalidade vindas de GET /config (features). Carregadas uma vez
// por sessão; enquanto não chegam, valem os padrões abaixo.
export interface Features { guests: boolean }

const DEFAULTS: Features = { guests: false }
let cached: Features | null = null
let pending: Promise<Features> | null = null

export function loadFeatures(): Promise<Features> {
  if (cached) return Promise.resolve(cached)
  if (!pending) {
    pending = api.get<{ features?: Partial<Features> }>('/config')
      .then((cfg) => { cached = { ...DEFAULTS, ...cfg.features }; return cached })
      .catch(() => { pending = null; return DEFAULTS })
  }
  return pending
}

export function invalidateFeatures() { cached = null; pending = null }

export function useFeatures(): Features {
  const [f, setF] = useState<Features>(cached ?? DEFAULTS)
  useEffect(() => { let alive = true; loadFeatures().then((v) => { if (alive) setF(v) }); return () => { alive = false } }, [])
  return f
}
