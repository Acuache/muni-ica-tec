'use client'

import React, { useEffect, useRef, useState } from 'react'
import {
  IconPaperclip,
  IconPhoto,
  IconFileTypePdf,
  IconTrash,
  IconEye,
} from '@tabler/icons-react'
import {
  comprimirImagenAWebp,
  validarPdf,
  IMG_INPUT_TYPES,
} from '@/lib/adjuntos/comprimir'
import { formatTamano } from '@/lib/adjuntos/tipos'

/** Archivo preparado en memoria, aún sin subir a Storage. */
export type StagedAdjunto = {
  localId: string
  tipo: 'imagen' | 'pdf'
  nombre: string // nombre que se guardará (.webp para imágenes)
  tamano: number
  blob: Blob // bytes a subir (blob webp para imágenes, el File para PDFs)
  previewUrl: string | null // objectURL solo para imágenes
}

const ACCEPT = [...IMG_INPUT_TYPES, 'application/pdf'].join(',')

export default function AdjuntosSelector({
  staged,
  setStaged,
  disabled,
}: {
  staged: StagedAdjunto[]
  setStaged: React.Dispatch<React.SetStateAction<StagedAdjunto[]>>
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [procesando, setProcesando] = useState(false)
  const [preview, setPreview] = useState<StagedAdjunto | null>(null)

  // Revocar los objectURL al desmontar para no filtrar memoria.
  const stagedRef = useRef(staged)
  useEffect(() => {
    stagedRef.current = staged
  }, [staged])
  useEffect(
    () => () => {
      stagedRef.current.forEach((s) => {
        if (s.previewUrl) URL.revokeObjectURL(s.previewUrl)
      })
    },
    [],
  )

  async function handleArchivos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = '' // permite volver a elegir el mismo archivo
    if (files.length === 0) return

    setError(null)
    setProcesando(true)
    try {
      for (const file of files) {
        if (file.type === 'application/pdf') {
          const v = validarPdf(file)
          if (!v.ok) {
            setError(v.error)
            continue
          }
          setStaged((prev) => [
            ...prev,
            {
              localId: crypto.randomUUID(),
              tipo: 'pdf',
              nombre: file.name,
              tamano: file.size,
              blob: file,
              previewUrl: null,
            },
          ])
        } else {
          const r = await comprimirImagenAWebp(file)
          if (!r.ok) {
            setError(r.error)
            continue
          }
          const item: StagedAdjunto = {
            localId: crypto.randomUUID(),
            tipo: 'imagen',
            nombre: r.nombre,
            tamano: r.tamano,
            blob: r.blob,
            previewUrl: URL.createObjectURL(r.blob),
          }
          setStaged((prev) => [...prev, item])
          setPreview(item) // abre el modal de previsualización de la imagen
        }
      }
    } finally {
      setProcesando(false)
    }
  }

  function quitar(localId: string) {
    setStaged((prev) => {
      const item = prev.find((s) => s.localId === localId)
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
      return prev.filter((s) => s.localId !== localId)
    })
    setPreview((p) => (p?.localId === localId ? null : p))
  }

  return (
    <div>
      <p className="block text-sm font-medium text-gray-700">
        Archivos{' '}
        <span className="font-normal text-gray-400">(Opcional)</span>
      </p>
      <p className="mt-0.5 text-xs text-gray-500">
        Imágenes (se comprimen, máx. 1 MB) o PDF (máx. 3 MB).
      </p>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        onChange={handleArchivos}
        className="hidden"
      />

      <button
        type="button"
        disabled={disabled || procesando}
        onClick={() => inputRef.current?.click()}
        className="mt-2 inline-flex items-center gap-2 rounded-lg border border-dashed border-gray-400 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-blue-400 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <IconPaperclip size={18} />
        {procesando ? 'Procesando…' : 'Agregar archivos'}
      </button>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {staged.length > 0 && (
        <ul className="mt-3 space-y-2">
          {staged.map((s) => (
            <li
              key={s.localId}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
            >
              {s.tipo === 'imagen' ? (
                <IconPhoto size={18} className="shrink-0 text-blue-600" />
              ) : (
                <IconFileTypePdf size={18} className="shrink-0 text-red-600" />
              )}
              <span className="min-w-0 flex-1 truncate text-sm text-gray-800">
                {s.nombre}
              </span>
              <span className="shrink-0 text-xs text-gray-400">
                {formatTamano(s.tamano)}
              </span>
              {s.tipo === 'imagen' && (
                <button
                  type="button"
                  onClick={() => setPreview(s)}
                  aria-label="Ver imagen"
                  className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-blue-600"
                >
                  <IconEye size={18} />
                </button>
              )}
              <button
                type="button"
                onClick={() => quitar(s.localId)}
                aria-label={s.tipo === 'imagen' ? 'Eliminar imagen' : 'Quitar PDF'}
                className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-red-600"
              >
                <IconTrash size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Modal de previsualización de imagen */}
      {preview && preview.previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-2 text-sm font-semibold text-gray-900">
              Revisa la imagen
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.previewUrl}
              alt={preview.nombre}
              className="max-h-[60vh] w-full rounded-lg object-contain"
            />
            <p className="mt-2 truncate text-xs text-gray-500">
              {preview.nombre} · {formatTamano(preview.tamano)}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => quitar(preview.localId)}
                className="inline-flex items-center gap-1 rounded-lg border border-red-400 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
              >
                <IconTrash size={16} />
                Eliminar
              </button>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
