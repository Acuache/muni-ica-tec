import type { createClient } from '@/lib/supabase/server'
import type { Sede, Area, Subarea } from '@/components/selects-ubicacion'

type ServerClient = Awaited<ReturnType<typeof createClient>>

export type UbicacionPerfil = {
  sedes: Sede[]
  areas: Area[]
  subareas: Subarea[]
  defaultSedeId: string
  defaultAreaId: string
  defaultSubareaId: string
}

/**
 * Carga el catálogo de ubicación y resuelve los ids actuales del perfil a
 * partir de los nombres guardados (modelo snapshot: profiles.sede/area/subarea
 * son texto). Si un nombre ya no existe en el catálogo, su id queda vacío y el
 * usuario deberá reelegir. Compartido por las 3 páginas de perfil.
 */
export async function cargarUbicacionPerfil(
  supabase: ServerClient,
  profile: { sede: string | null; area: string | null; subarea: string | null },
): Promise<UbicacionPerfil> {
  const [sedesRes, areasRes, subareasRes] = await Promise.all([
    supabase.from('sedes').select('id, nombre').order('orden'),
    supabase.from('areas').select('id, sede_id, nombre').order('orden'),
    supabase.from('subareas').select('id, area_id, nombre').order('orden'),
  ])

  const sedes = (sedesRes.data ?? []) as Sede[]
  const areas = (areasRes.data ?? []) as Area[]
  const subareas = (subareasRes.data ?? []) as Subarea[]

  // Resolver por jerarquía (un nombre de área/subárea puede repetirse entre
  // sedes): se acota cada nivel por el id del padre ya resuelto.
  const sede = sedes.find((s) => s.nombre === profile.sede)
  const area = areas.find((a) => a.sede_id === sede?.id && a.nombre === profile.area)
  const subarea = subareas.find(
    (sa) => sa.area_id === area?.id && sa.nombre === profile.subarea,
  )

  return {
    sedes,
    areas,
    subareas,
    defaultSedeId: sede?.id ?? '',
    defaultAreaId: area?.id ?? '',
    defaultSubareaId: subarea?.id ?? '',
  }
}
