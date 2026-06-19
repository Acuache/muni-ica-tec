'use client'

import { useState } from 'react'

// Selects en cascada Sede → Área → Subárea, extraídos de primer ingreso (SPEC 13)
// para reutilizarlos en crear/editar usuarios (SPEC 14). Se trabaja con ids del
// catálogo; el Server Action resuelve y valida los nombres canónicos.

const inputCls =
  'mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400'

const labelCls = 'block text-sm font-medium text-zinc-700'

export type Sede = { id: string; nombre: string }
export type Area = { id: string; sede_id: string; nombre: string }
export type Subarea = { id: string; area_id: string; nombre: string }

type Props = {
  sedes: Sede[]
  areas: Area[]
  subareas: Subarea[]
  /** En primer ingreso los 3 selects son obligatorios; en "crear" la sección
   *  de primer ingreso es opcional, así que por defecto no son required. */
  required?: boolean
  defaultSedeId?: string
  defaultAreaId?: string
  defaultSubareaId?: string
}

export default function SelectsUbicacion({
  sedes,
  areas,
  subareas,
  required = false,
  defaultSedeId = '',
  defaultAreaId = '',
  defaultSubareaId = '',
}: Props) {
  // Cascade: se trabaja con id; el Server Action resuelve los nombres.
  const [sedeId, setSedeId] = useState(defaultSedeId)
  const [areaId, setAreaId] = useState(defaultAreaId)
  const [subareaId, setSubareaId] = useState(defaultSubareaId)

  // El catálogo llega pre-ordenado por `orden`; filtrar preserva ese orden.
  const areasDeSede = sedeId ? areas.filter((a) => a.sede_id === sedeId) : []
  const subareasDeArea = areaId ? subareas.filter((sa) => sa.area_id === areaId) : []

  function handleSedeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSedeId(e.target.value)
    setAreaId('')
    setSubareaId('')
  }

  function handleAreaChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setAreaId(e.target.value)
    setSubareaId('')
  }

  return (
    <>
      <div>
        <label htmlFor="sede_id" className={labelCls}>
          Sede
        </label>
        <select
          id="sede_id"
          name="sede_id"
          required={required}
          value={sedeId}
          onChange={handleSedeChange}
          className={inputCls}
        >
          <option value="">Selecciona una sede…</option>
          {sedes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="area_id" className={labelCls}>
          Área
        </label>
        <select
          id="area_id"
          name="area_id"
          required={required}
          value={areaId}
          onChange={handleAreaChange}
          disabled={!sedeId}
          className={inputCls}
        >
          <option value="">
            {sedeId ? 'Selecciona un área…' : 'Primero elige una sede'}
          </option>
          {areasDeSede.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="subarea_id" className={labelCls}>
          Subárea
        </label>
        <select
          id="subarea_id"
          name="subarea_id"
          required={required}
          value={subareaId}
          onChange={(e) => setSubareaId(e.target.value)}
          disabled={!areaId}
          className={inputCls}
        >
          <option value="">
            {areaId ? 'Selecciona una subárea…' : 'Primero elige un área'}
          </option>
          {subareasDeArea.map((sa) => (
            <option key={sa.id} value={sa.id}>
              {sa.nombre}
            </option>
          ))}
        </select>
      </div>
    </>
  )
}
