import { createClient } from '@/lib/supabase/server'
import FormularioPrimerIngreso from './formulario'

// Server Component: carga el catálogo con el cliente de servidor AUTENTICADO
// (la sesión del usuario en primer ingreso). Con el cliente anónimo, RLS
// devolvería vacío y los selects saldrían sin datos (SPEC 13, riesgos).
export default async function PrimerIngresoPage() {
  const supabase = await createClient()

  const [sedesRes, areasRes, subareasRes] = await Promise.all([
    supabase.from('sedes').select('id, nombre').order('orden'),
    supabase.from('areas').select('id, sede_id, nombre').order('orden'),
    supabase.from('subareas').select('id, area_id, nombre').order('orden'),
  ])

  return (
    <FormularioPrimerIngreso
      sedes={sedesRes.data ?? []}
      areas={areasRes.data ?? []}
      subareas={subareasRes.data ?? []}
    />
  )
}
