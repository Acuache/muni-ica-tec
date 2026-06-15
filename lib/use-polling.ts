'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Polling compartido por los 3 paneles (SPEC 11):
 * - Refresca con `router.refresh()` cada `intervalMs`.
 * - Se PAUSA cuando la pestaña está oculta (`visibilitychange`) y al volver
 *   refresca de inmediato (datos frescos) y reanuda el intervalo.
 * - `canRefresh` (opcional) permite vetar un refresco automático sin
 *   interrumpir al usuario (p. ej. el trabajador escribiendo en un campo).
 *   Se consulta vía ref para no re-suscribir el efecto en cada render. El
 *   refresco MANUAL (`refresh`) lo ignora: si el usuario pulsa, refresca.
 * - Devuelve `lastRefreshed` (hora real del último fetch) y `refresh`.
 */
export function usePolling(intervalMs: number, canRefresh?: () => boolean) {
  const router = useRouter()
  const [lastRefreshed, setLastRefreshed] = useState<Date>(() => new Date())

  const canRefreshRef = useRef(canRefresh)
  useEffect(() => {
    canRefreshRef.current = canRefresh
  }, [canRefresh])

  const refresh = useCallback(() => {
    router.refresh()
    setLastRefreshed(new Date())
  }, [router])

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null

    const tick = () => {
      const can = canRefreshRef.current
      if (!can || can()) refresh()
    }
    const start = () => {
      if (id === null) id = setInterval(tick, intervalMs)
    }
    const stop = () => {
      if (id !== null) {
        clearInterval(id)
        id = null
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        tick()
        start()
      } else {
        stop()
      }
    }

    // Solo arranca el intervalo si la pestaña está visible al montar.
    if (document.visibilityState === 'visible') start()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [refresh, intervalMs])

  return { lastRefreshed, refresh }
}
