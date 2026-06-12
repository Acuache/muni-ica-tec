'use client'

import PantallaError from '@/components/pantalla-error'

// Boundary raíz: cubre los segmentos sin error.tsx propio (primer ingreso,
// recuperación de contraseña, raíz).
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return <PantallaError error={error} onRetry={unstable_retry} />
}
