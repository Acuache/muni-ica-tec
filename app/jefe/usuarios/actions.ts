'use server'

import { autorizar, type RolApp } from '@/lib/autorizacion'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  esEmailValido,
  esTelefonoValido,
  esUuidValido,
  MAX_TEXTO_CORTO,
} from '@/lib/validacion'
import { PASSWORD_POR_ROL } from './constantes'

const ROLES_VALIDOS: RolApp[] = ['trabajador', 'tecnico', 'jefe']

// Los 3 valores fijos de puesto (coinciden con el CHECK de profiles y con SPEC 13).
const PUESTOS_VALIDOS = ['Jefe de área', 'Secretaria', 'Trabajador']

// Tope de correos por pegado en el alta masiva (acota la duración de la Server
// Action; los ya creados no se duplican en un reintento). (SPEC 14, riesgos)
const MAX_CORREOS_MASIVO = 200

type AdminClient = ReturnType<typeof createAdminClient>

type UbicacionResuelta = {
  sede: string | null
  area: string | null
  subarea: string | null
}

// Formas de la jerarquía que devuelve el catálogo (joins !inner).
type SubareaJerarquia = {
  nombre: string
  area_id: string
  areas: { nombre: string; sede_id: string; sedes: { nombre: string } }
}
type AreaJerarquia = { nombre: string; sede_id: string; sedes: { nombre: string } }

const UBICACION_INVALIDA = 'La combinación de sede, área y subárea no es válida.'

/**
 * Valida contra el catálogo la jerarquía Sede→Área→Subárea (no se confía en el
 * cliente) y devuelve los nombres canónicos de los niveles presentes. Acepta
 * una cadena parcial (nada, sede sola, o sede+área) porque en "crear" la
 * sección de primer ingreso es opcional; un nivel profundo exige los
 * superiores. Reutiliza la lógica de validación de SPEC 13.
 */
async function resolverUbicacion(
  admin: AdminClient,
  ids: { sedeId: string; areaId: string; subareaId: string },
): Promise<{ ok: true; ubic: UbicacionResuelta } | { ok: false; error: string }> {
  const { sedeId, areaId, subareaId } = ids

  // Ids manipulados / no-UUID → inválido (sin tocar la base).
  for (const id of [sedeId, areaId, subareaId]) {
    if (id && !esUuidValido(id)) return { ok: false, error: UBICACION_INVALIDA }
  }
  // Coherencia de la cadena: subárea exige área+sede; área exige sede.
  if (subareaId && (!areaId || !sedeId)) return { ok: false, error: UBICACION_INVALIDA }
  if (areaId && !sedeId) return { ok: false, error: UBICACION_INVALIDA }

  if (subareaId) {
    const { data, error } = await admin
      .from('subareas')
      .select('nombre, area_id, areas!inner(nombre, sede_id, sedes!inner(nombre))')
      .eq('id', subareaId)
      .maybeSingle()
    if (error) return { ok: false, error: 'No se pudo validar la ubicación. Inténtalo de nuevo.' }
    const sub = data as unknown as SubareaJerarquia | null
    if (!sub || sub.area_id !== areaId || sub.areas.sede_id !== sedeId) {
      return { ok: false, error: UBICACION_INVALIDA }
    }
    return {
      ok: true,
      ubic: { sede: sub.areas.sedes.nombre, area: sub.areas.nombre, subarea: sub.nombre },
    }
  }

  if (areaId) {
    const { data, error } = await admin
      .from('areas')
      .select('nombre, sede_id, sedes!inner(nombre)')
      .eq('id', areaId)
      .maybeSingle()
    if (error) return { ok: false, error: 'No se pudo validar la ubicación. Inténtalo de nuevo.' }
    const ar = data as unknown as AreaJerarquia | null
    if (!ar || ar.sede_id !== sedeId) return { ok: false, error: UBICACION_INVALIDA }
    return { ok: true, ubic: { sede: ar.sedes.nombre, area: ar.nombre, subarea: null } }
  }

  if (sedeId) {
    const { data, error } = await admin
      .from('sedes')
      .select('nombre')
      .eq('id', sedeId)
      .maybeSingle()
    if (error) return { ok: false, error: 'No se pudo validar la ubicación. Inténtalo de nuevo.' }
    const sede = data as { nombre: string } | null
    if (!sede) return { ok: false, error: UBICACION_INVALIDA }
    return { ok: true, ubic: { sede: sede.nombre, area: null, subarea: null } }
  }

  return { ok: true, ubic: { sede: null, area: null, subarea: null } }
}

/** Detecta el error de "correo ya registrado" de auth.admin.createUser. */
function esErrorCorreoExistente(
  error: { message?: string; code?: string } | null,
): boolean {
  if (!error) return false
  if (error.code === 'email_exists') return true
  const msg = (error.message ?? '').toLowerCase()
  return msg.includes('already') && (msg.includes('registered') || msg.includes('exists'))
}

export type CrearIndividualState =
  | { ok: true; email: string; password: string }
  | { ok: false; error: string }
  | undefined

/**
 * Crea una cuenta individual con la llave admin. Correo + Rol obligatorios;
 * la sección de primer ingreso (nombre/apellido/teléfono/ubicación/puesto) es
 * opcional: si viene COMPLETA → primer_ingreso=false y username="Nombre
 * Apellido"; si viene parcial o vacía → primer_ingreso=true, username=correo y
 * se guardan solo los campos presentes. (SPEC 14)
 */
export async function crearUsuarioIndividual(
  _prevState: CrearIndividualState,
  formData: FormData,
): Promise<CrearIndividualState> {
  const auth = await autorizar(['jefe'])
  if (!auth.ok) return { ok: false, error: auth.error }

  const email = (formData.get('email') as string | null)?.trim().toLowerCase() ?? ''
  const rol = ((formData.get('rol') as string | null) ?? '') as RolApp

  if (!email) return { ok: false, error: 'Escribe el correo de la cuenta.' }
  if (!esEmailValido(email)) return { ok: false, error: 'Escribe un correo válido.' }
  if (!ROLES_VALIDOS.includes(rol)) return { ok: false, error: 'Selecciona un rol válido.' }

  // Sección opcional de primer ingreso.
  const nombre = (formData.get('nombre') as string | null)?.trim() ?? ''
  const apellido = (formData.get('apellido') as string | null)?.trim() ?? ''
  const telefono = (formData.get('telefono') as string | null)?.trim() ?? ''
  const sedeId = (formData.get('sede_id') as string | null)?.trim() ?? ''
  const areaId = (formData.get('area_id') as string | null)?.trim() ?? ''
  const subareaId = (formData.get('subarea_id') as string | null)?.trim() ?? ''
  const puesto = (formData.get('puesto') as string | null)?.trim() ?? ''

  // "Completa" = los 7 campos de la sección presentes.
  const seccionCompleta =
    !!nombre && !!apellido && !!telefono && !!sedeId && !!areaId && !!subareaId && !!puesto

  // Validaciones de los campos presentes (defensa además del cliente y la base).
  if (puesto && !PUESTOS_VALIDOS.includes(puesto)) {
    return { ok: false, error: 'El puesto seleccionado no es válido.' }
  }
  if (telefono && !esTelefonoValido(telefono)) {
    return { ok: false, error: 'Escribe un teléfono válido (solo dígitos, espacios o guiones).' }
  }
  for (const [campo, valor] of [
    ['Nombre', nombre],
    ['Apellido', apellido],
  ] as const) {
    if (valor.length > MAX_TEXTO_CORTO) {
      return { ok: false, error: `El campo ${campo} no puede superar ${MAX_TEXTO_CORTO} caracteres.` }
    }
  }

  const admin = createAdminClient()

  // Validar la ubicación contra el catálogo (los niveles presentes).
  const ubicResult = await resolverUbicacion(admin, { sedeId, areaId, subareaId })
  if (!ubicResult.ok) return { ok: false, error: ubicResult.error }
  const { ubic } = ubicResult

  // username = "Nombre Apellido" solo si la sección vino completa; si no, el
  // correo (temporal, lo reemplaza el usuario en su primer ingreso).
  const username = seccionCompleta ? `${nombre} ${apellido}` : email
  const password = PASSWORD_POR_ROL[rol]

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { rol, username },
  })

  if (createError || !created?.user) {
    if (esErrorCorreoExistente(createError)) {
      return { ok: false, error: 'Ya existe una cuenta con ese correo.' }
    }
    return { ok: false, error: 'No se pudo crear la cuenta. Inténtalo de nuevo.' }
  }

  // El trigger handle_new_user ya creó el profile (primer_ingreso=true,
  // activo=true) y, si rol=tecnico, su fila en technician_status. Ahora se
  // guardan los datos presentes de la sección de primer ingreso.
  const updates: {
    telefono?: string
    sede?: string
    area?: string
    subarea?: string
    puesto?: string
    primer_ingreso?: boolean
  } = {}
  if (telefono) updates.telefono = telefono
  if (ubic.sede) updates.sede = ubic.sede
  if (ubic.area) updates.area = ubic.area
  if (ubic.subarea) updates.subarea = ubic.subarea
  if (puesto) updates.puesto = puesto
  if (seccionCompleta) updates.primer_ingreso = false

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await admin
      .from('profiles')
      .update(updates)
      .eq('id', created.user.id)
    if (updateError) {
      return {
        ok: false,
        error:
          'La cuenta se creó, pero no se pudieron guardar los datos de primer ingreso. Complétalos desde Buscar.',
      }
    }
  }

  return { ok: true, email, password }
}

export type CrearMasivoState =
  | { ok: true; agregados: string[]; omitidos: string[]; invalidos: string[] }
  | { ok: false; error: string }
  | undefined

/**
 * Crea muchas cuentas pegando correos (separados por saltos de línea, comas,
 * espacios o `;`). Se quitan duplicados; cada correo se crea uno por uno como
 * trabajador (contraseña trabajador-muni, primer_ingreso=true, username=correo).
 * Los inválidos y los que ya existen se omiten sin abortar el resto. (SPEC 14)
 */
export async function crearUsuariosMasivo(
  _prevState: CrearMasivoState,
  formData: FormData,
): Promise<CrearMasivoState> {
  const auth = await autorizar(['jefe'])
  if (!auth.ok) return { ok: false, error: auth.error }

  const raw = (formData.get('correos') as string | null) ?? ''
  // Separadores: saltos de línea, comas, espacios, punto y coma.
  const tokens = raw
    .split(/[\s,;]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)

  // Dedup preservando el orden de aparición.
  const unicos = [...new Set(tokens)]

  if (unicos.length === 0) return { ok: false, error: 'Pega al menos un correo.' }
  if (unicos.length > MAX_CORREOS_MASIVO) {
    return {
      ok: false,
      error: `Pega como máximo ${MAX_CORREOS_MASIVO} correos por vez (recibidos ${unicos.length}).`,
    }
  }

  const admin = createAdminClient()
  const password = PASSWORD_POR_ROL.trabajador

  const agregados: string[] = []
  const omitidos: string[] = []
  const invalidos: string[] = []

  for (const correo of unicos) {
    if (!esEmailValido(correo)) {
      invalidos.push(correo)
      continue
    }
    const { error } = await admin.auth.admin.createUser({
      email: correo,
      password,
      email_confirm: true,
      user_metadata: { rol: 'trabajador', username: correo },
    })
    if (!error) {
      agregados.push(correo)
    } else if (esErrorCorreoExistente(error)) {
      omitidos.push(correo)
    } else {
      // Otro error de creación (p. ej. correo rechazado por auth): se cuenta
      // como inválido para no abortar el resto del lote.
      invalidos.push(correo)
    }
  }

  return { ok: true, agregados, omitidos, invalidos }
}

/**
 * Cuenta los jefes activos DISTINTOS del usuario objetivo. Sirve para la
 * invariante "≥1 jefe activo": si quitar el rol o desactivar a este usuario
 * dejaría 0, la acción se bloquea. Se cuenta en el servidor con el cliente
 * admin (no se confía en el cliente). (SPEC 14)
 */
async function hayOtroJefeActivo(admin: AdminClient, userId: string): Promise<boolean> {
  const { count, error } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('rol', 'jefe')
    .eq('activo', true)
    .neq('id', userId)
  if (error) throw new Error('conteo de jefes falló')
  return (count ?? 0) > 0
}

export type EditarUsuarioState = { ok: true } | { ok: false; error: string } | undefined

/**
 * Edita los datos de perfil de una cuenta (nombre→username, teléfono, ubicación,
 * puesto) y su rol. El correo NO se edita aquí. Aplica la invariante "≥1 jefe
 * activo" al quitar el rol jefe y crea la fila de technician_status al pasar a
 * técnico. Corre con el cliente admin tras autorizar(['jefe']). (SPEC 14)
 */
export async function editarUsuario(
  _prevState: EditarUsuarioState,
  formData: FormData,
): Promise<EditarUsuarioState> {
  const auth = await autorizar(['jefe'])
  if (!auth.ok) return { ok: false, error: auth.error }

  const userId = (formData.get('id') as string | null)?.trim() ?? ''
  if (!esUuidValido(userId)) return { ok: false, error: 'Usuario no válido.' }

  const nombre = (formData.get('nombre') as string | null)?.trim() ?? ''
  const apellido = (formData.get('apellido') as string | null)?.trim() ?? ''
  const telefono = (formData.get('telefono') as string | null)?.trim() ?? ''
  const sedeId = (formData.get('sede_id') as string | null)?.trim() ?? ''
  const areaId = (formData.get('area_id') as string | null)?.trim() ?? ''
  const subareaId = (formData.get('subarea_id') as string | null)?.trim() ?? ''
  const puesto = (formData.get('puesto') as string | null)?.trim() ?? ''
  const rol = ((formData.get('rol') as string | null) ?? '') as RolApp

  // username no puede quedar vacío (la columna es NOT NULL): exigir nombre.
  if (!nombre) return { ok: false, error: 'El nombre no puede estar vacío.' }
  if (!ROLES_VALIDOS.includes(rol)) return { ok: false, error: 'Selecciona un rol válido.' }
  if (puesto && !PUESTOS_VALIDOS.includes(puesto)) {
    return { ok: false, error: 'El puesto seleccionado no es válido.' }
  }
  if (telefono && !esTelefonoValido(telefono)) {
    return { ok: false, error: 'Escribe un teléfono válido (solo dígitos, espacios o guiones).' }
  }
  for (const [campo, valor] of [
    ['Nombre', nombre],
    ['Apellido', apellido],
  ] as const) {
    if (valor.length > MAX_TEXTO_CORTO) {
      return { ok: false, error: `El campo ${campo} no puede superar ${MAX_TEXTO_CORTO} caracteres.` }
    }
  }

  const admin = createAdminClient()

  const ubicResult = await resolverUbicacion(admin, { sedeId, areaId, subareaId })
  if (!ubicResult.ok) return { ok: false, error: ubicResult.error }
  const { ubic } = ubicResult

  // Estado actual del usuario objetivo (rol/activo) para la invariante.
  const { data: actual, error: actualError } = await admin
    .from('profiles')
    .select('rol, activo')
    .eq('id', userId)
    .maybeSingle()
  if (actualError || !actual) return { ok: false, error: 'No se encontró la cuenta a editar.' }
  const actualTyped = actual as { rol: string; activo: boolean }

  // Invariante: no quitar el rol al último jefe activo.
  if (actualTyped.rol === 'jefe' && actualTyped.activo && rol !== 'jefe') {
    try {
      if (!(await hayOtroJefeActivo(admin, userId))) {
        return { ok: false, error: 'No puedes quitar el rol al último jefe activo.' }
      }
    } catch {
      return { ok: false, error: 'No se pudo verificar el número de jefes. Inténtalo de nuevo.' }
    }
  }

  const username = apellido ? `${nombre} ${apellido}` : nombre

  const { error: updateError } = await admin
    .from('profiles')
    .update({
      username,
      telefono: telefono || null,
      sede: ubic.sede,
      area: ubic.area,
      subarea: ubic.subarea,
      puesto: puesto || null,
      rol,
    })
    .eq('id', userId)
  if (updateError) {
    if (updateError.code === '23514') {
      return { ok: false, error: 'El puesto seleccionado no es válido.' }
    }
    return { ok: false, error: 'No se pudieron guardar los cambios. Inténtalo de nuevo.' }
  }

  // Al pasar a técnico, asegurar su fila en technician_status (si no existe).
  // Al salir de técnico se deja la fila (inofensiva; las lecturas filtran por rol).
  if (rol === 'tecnico') {
    const { error: tsError } = await admin
      .from('technician_status')
      .upsert({ tecnico_id: userId }, { onConflict: 'tecnico_id', ignoreDuplicates: true })
    if (tsError) {
      return { ok: false, error: 'Se guardó el perfil, pero no se pudo crear el estado de técnico.' }
    }
  }

  return { ok: true }
}

/**
 * Restablece la contraseña de una cuenta a la contraseña por defecto de su rol
 * actual (auth.admin.updateUserById). Corre con el cliente admin tras
 * autorizar(['jefe']). (SPEC 14)
 */
export async function restablecerPassword({
  userId,
}: {
  userId: string
}): Promise<{ ok: true; password: string } | { ok: false; error: string }> {
  const auth = await autorizar(['jefe'])
  if (!auth.ok) return { ok: false, error: auth.error }
  if (!esUuidValido(userId)) return { ok: false, error: 'Usuario no válido.' }

  const admin = createAdminClient()
  const { data: actual, error } = await admin
    .from('profiles')
    .select('rol')
    .eq('id', userId)
    .maybeSingle()
  if (error || !actual) return { ok: false, error: 'No se encontró la cuenta.' }

  const password = PASSWORD_POR_ROL[(actual as { rol: RolApp }).rol]
  if (!password) return { ok: false, error: 'El rol de la cuenta no es válido.' }

  const { error: updError } = await admin.auth.admin.updateUserById(userId, { password })
  if (updError) {
    return { ok: false, error: 'No se pudo restablecer la contraseña. Inténtalo de nuevo.' }
  }

  return { ok: true, password }
}

// Ban ≈100 años: bloquea el acceso en auth además del flag `activo` (SPEC 14).
const BAN_DURATION = '876000h'

/**
 * Desactiva una cuenta (soft-delete): valida la invariante "≥1 jefe activo",
 * cancela la(s) solicitud(es) activa(s) del trabajador, pone activo=false y
 * banea al usuario en auth. Corre con el cliente admin tras autorizar(['jefe']).
 * (SPEC 14)
 */
export async function desactivarUsuario({
  userId,
}: {
  userId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await autorizar(['jefe'])
  if (!auth.ok) return { ok: false, error: auth.error }
  if (!esUuidValido(userId)) return { ok: false, error: 'Usuario no válido.' }

  const admin = createAdminClient()

  const { data: actual, error: actualError } = await admin
    .from('profiles')
    .select('rol, activo')
    .eq('id', userId)
    .maybeSingle()
  if (actualError || !actual) return { ok: false, error: 'No se encontró la cuenta.' }
  const actualTyped = actual as { rol: string; activo: boolean }

  if (!actualTyped.activo) return { ok: false, error: 'La cuenta ya está desactivada.' }

  // Invariante: no desactivar al último jefe activo.
  if (actualTyped.rol === 'jefe') {
    try {
      if (!(await hayOtroJefeActivo(admin, userId))) {
        return { ok: false, error: 'No puedes desactivar al último jefe activo.' }
      }
    } catch {
      return { ok: false, error: 'No se pudo verificar el número de jefes. Inténtalo de nuevo.' }
    }
  }

  // Cancelar la(s) solicitud(es) activa(s) del trabajador desactivado.
  const { error: cancelError } = await admin
    .from('solicitudes')
    .update({ estado: 'cancelado' })
    .eq('trabajador_id', userId)
    .in('estado', ['en_espera', 'en_proceso'])
  if (cancelError) {
    return { ok: false, error: 'No se pudo cancelar la solicitud activa. Inténtalo de nuevo.' }
  }

  // Soft-delete.
  const { error: updError } = await admin
    .from('profiles')
    .update({ activo: false })
    .eq('id', userId)
  if (updError) return { ok: false, error: 'No se pudo desactivar la cuenta. Inténtalo de nuevo.' }

  // Ban en auth (defensa en capas con el chequeo de `activo` en el login).
  const { error: banError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: BAN_DURATION,
  })
  if (banError) {
    return {
      ok: false,
      error: 'La cuenta se marcó como desactivada, pero no se pudo bloquear el acceso. Reinténtalo.',
    }
  }

  return { ok: true }
}

/**
 * Reactiva una cuenta desactivada: activo=true y quita el ban en auth.
 * Corre con el cliente admin tras autorizar(['jefe']). (SPEC 14)
 */
export async function reactivarUsuario({
  userId,
}: {
  userId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await autorizar(['jefe'])
  if (!auth.ok) return { ok: false, error: auth.error }
  if (!esUuidValido(userId)) return { ok: false, error: 'Usuario no válido.' }

  const admin = createAdminClient()

  const { error: updError } = await admin
    .from('profiles')
    .update({ activo: true })
    .eq('id', userId)
  if (updError) return { ok: false, error: 'No se pudo reactivar la cuenta. Inténtalo de nuevo.' }

  const { error: banError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: 'none',
  })
  if (banError) {
    return {
      ok: false,
      error: 'La cuenta se reactivó, pero no se pudo quitar el bloqueo de acceso. Reinténtalo.',
    }
  }

  return { ok: true }
}
