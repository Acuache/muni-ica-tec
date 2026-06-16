// Tipos compartidos de adjuntos (SPEC 12) entre el cliente y las Server Actions.

/** Metadatos de un archivo ya subido a Storage, listo para registrar en DB. */
export type AdjuntoMeta = {
  tipo: 'imagen' | 'pdf'
  storage_path: string
  nombre_original: string
  tamano_bytes: number
}

/** Adjunto tal como se muestra y descarga en la UI. */
export type AdjuntoVista = {
  id: string
  tipo: 'imagen' | 'pdf'
  nombre_original: string
  tamano_bytes: number
}

/** Formatea bytes a un texto corto (KB / MB) para la UI. */
export function formatTamano(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}
