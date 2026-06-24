'use server'

import { revalidatePath } from 'next/cache'
import { autorizar, PANEL_POR_ROL, type RolApp } from '@/lib/autorizacion'
import {
  esTelefonoValido,
  esUuidValido,
  MAX_PASSWORD,
  MAX_TEXTO_CORTO,
  MIN_PASSWORD,
} from '@/lib/validacion'

// Las dos acciones del perfil comparten forma de estado para `useActionState`.
export type PerfilState = { error: string } | { ok: true } | undefined

// El perfil lo edita cualquiera de los 3 roles, cada uno solo el suyo (RLS:
// profiles_update_own). El correo y el rol NO se tocan aquí a propósito: el
// correo queda fijo (lo entrega informática) y `rol` es inmutable para el
// usuario (SPEC 10, H-11). Por eso el GRANT de columnas no incluye `rol`.
const TODOS_LOS_ROLES: RolApp[] = ['jefe', 'tecnico', 'trabajador']

// Los 3 valores fijos de puesto (coinciden con el CHECK de profiles, SPEC 13).
const PUESTOS_VALIDOS = ['Jefe de área', 'Secretaria', 'Trabajador']

// Forma de la jerarquía subárea → área → sede que devuelve el catálogo.
type SubareaJerarquia = {
  nombre: string
  area_id: string
  areas: {
    nombre: string
    sede_id: string
    sedes: { nombre: string }
  }
}

/**
 * Actualiza los datos editables del perfil: nombre (`username`), teléfono y la
 * ubicación (sede·área·subárea, resuelta y validada contra el catálogo) +
 * puesto. Todas estas columnas están en el GRANT UPDATE de `authenticated`.
 */
export async function actualizarDatosPerfil(
  _prevState: PerfilState,
  formData: FormData,
): Promise<PerfilState> {
  const nombre = (formData.get('nombre') as string | null)?.trim() ?? ''
  const telefono = (formData.get('telefono') as string | null)?.trim() ?? ''
  // El formulario envía ids del catálogo; el nombre canónico se resuelve aquí.
  const sedeId = (formData.get('sede_id') as string | null)?.trim() ?? ''
  const areaId = (formData.get('area_id') as string | null)?.trim() ?? ''
  const subareaId = (formData.get('subarea_id') as string | null)?.trim() ?? ''
  const puesto = (formData.get('puesto') as string | null)?.trim() ?? ''

  if (!nombre) return { error: 'El campo Nombre no puede estar vacío.' }
  if (nombre.length > MAX_TEXTO_CORTO) {
    return { error: `El nombre no puede superar ${MAX_TEXTO_CORTO} caracteres.` }
  }
  if (!telefono) return { error: 'El campo Teléfono no puede estar vacío.' }
  if (!esTelefonoValido(telefono)) {
    return { error: 'Escribe un teléfono válido (solo dígitos, espacios o guiones).' }
  }
  if (!sedeId) return { error: 'Selecciona una sede.' }
  if (!areaId) return { error: 'Selecciona un área.' }
  if (!subareaId) return { error: 'Selecciona una subárea.' }
  if (!puesto) return { error: 'Selecciona un puesto.' }
  if (!PUESTOS_VALIDOS.includes(puesto)) {
    return { error: 'El puesto seleccionado no es válido.' }
  }
  // Ids manipulados / no-UUID → combinación inválida (sin tocar la base).
  if (!esUuidValido(sedeId) || !esUuidValido(areaId) || !esUuidValido(subareaId)) {
    return { error: 'La combinación de sede, área y subárea no es válida.' }
  }

  const auth = await autorizar(TODOS_LOS_ROLES)
  if (!auth.ok) return { error: auth.error }
  const { supabase, user, rol } = auth

  // Validar la jerarquía contra el catálogo y obtener los nombres canónicos
  // (no se confía en el cliente): una consulta a subareas con joins inner.
  const { data: subData, error: subError } = await supabase
    .from('subareas')
    .select('nombre, area_id, areas!inner(nombre, sede_id, sedes!inner(nombre))')
    .eq('id', subareaId)
    .maybeSingle()

  if (subError) {
    return { error: 'No se pudo validar la ubicación seleccionada. Inténtalo de nuevo.' }
  }

  const sub = subData as unknown as SubareaJerarquia | null
  if (!sub || sub.area_id !== areaId || sub.areas.sede_id !== sedeId) {
    return { error: 'La combinación de sede, área y subárea no es válida.' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      username: nombre,
      telefono,
      sede: sub.areas.sedes.nombre,
      area: sub.areas.nombre,
      subarea: sub.nombre,
      puesto,
    })
    .eq('id', user.id)

  if (error) {
    // 23514 = check_violation: defensa si el puesto burlara la validación previa.
    if (error.code === '23514') {
      return { error: 'El puesto seleccionado no es válido.' }
    }
    return { error: 'No se pudieron guardar los cambios. Inténtalo de nuevo.' }
  }

  // Refresca la página de perfil (y su layout/header, que muestra el nombre).
  revalidatePath(`${PANEL_POR_ROL[rol]}/perfil`)
  return { ok: true }
}

/**
 * Cambia la contraseña del usuario actual. Pasa por Supabase Auth (no es una
 * columna de profiles); exige confirmación y respeta los límites compartidos.
 * No cierra la sesión: el usuario sigue autenticado tras el cambio.
 */
export async function cambiarContrasena(
  _prevState: PerfilState,
  formData: FormData,
): Promise<PerfilState> {
  const password = (formData.get('password') as string | null) ?? ''
  const confirmacion = (formData.get('confirmacion') as string | null) ?? ''

  if (!password) return { error: 'Escribe la nueva contraseña.' }
  if (password.length < MIN_PASSWORD) {
    return { error: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.` }
  }
  if (password.length > MAX_PASSWORD) {
    return { error: `La contraseña no puede superar ${MAX_PASSWORD} caracteres.` }
  }
  if (password !== confirmacion) {
    return { error: 'Las contraseñas no coinciden.' }
  }

  const auth = await autorizar(TODOS_LOS_ROLES)
  if (!auth.ok) return { error: auth.error }
  const { supabase } = auth

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    // Supabase rechaza reusar la contraseña actual: lo traducimos al usuario.
    if (error.message?.toLowerCase().includes('different')) {
      return { error: 'La nueva contraseña debe ser distinta de la actual.' }
    }
    return { error: 'No se pudo actualizar la contraseña. Inténtalo de nuevo.' }
  }

  return { ok: true }
}
