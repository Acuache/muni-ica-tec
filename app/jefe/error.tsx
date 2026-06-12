'use client'

import PantallaError from '@/components/pantalla-error'

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return <PantallaError error={error} onRetry={unstable_retry} />
}
