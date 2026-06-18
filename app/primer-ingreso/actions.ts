'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  esEmailValido,
  esTelefonoValido,
  esUuidValido,
  MAX_PASSWORD,
  MAX_TEXTO_CORTO,
  MIN_PASSWORD,
} from '@/lib/validacion'

export type PrimerIngresoState = { error: string } | undefined

const PANEL: Record<string, string> = {
  trabajador: '/trabajador',
  tecnico: '/tecnico',
  jefe: '/jefe',
}

// Los 3 valores fijos de puesto (coinciden con el CHECK de profiles).
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

export async function completarPrimerIngreso(
  _prevState: PrimerIngresoState,
  formData: FormData,
): Promise<PrimerIngresoState> {
  // El formulario envía ids del catálogo; el nombre se resuelve en el servidor.
  const sedeId = (formData.get('sede_id') as string | null)?.trim() ?? ''
  const areaId = (formData.get('area_id') as string | null)?.trim() ?? ''
  const subareaId = (formData.get('subarea_id') as string | null)?.trim() ?? ''
  const puesto = (formData.get('puesto') as string | null)?.trim() ?? ''
  const nombre = (formData.get('nombre') as string | null)?.trim() ?? ''
  const apellido = (formData.get('apellido') as string | null)?.trim() ?? ''
  const telefono = (formData.get('telefono') as string | null)?.trim() ?? ''
  const email = (formData.get('email') as string | null)?.trim().toLowerCase() ?? ''
  const mantenerPassword = formData.get('mantenerPassword') === 'true'
  const nuevaPassword = (formData.get('nuevaPassword') as string | null)?.trim() ?? ''

  if (!sedeId) return { error: 'Selecciona una sede.' }
  if (!areaId) return { error: 'Selecciona un área.' }
  if (!subareaId) return { error: 'Selecciona una subárea.' }
  if (!puesto) return { error: 'Selecciona un puesto.' }
  if (!nombre) return { error: 'El campo Nombre no puede estar vacío.' }
  if (!apellido) return { error: 'El campo Apellido no puede estar vacío.' }
  if (!telefono) return { error: 'El campo Teléfono no puede estar vacío.' }
  if (!email) return { error: 'El campo de correo no puede estar vacío.' }

  // Puesto: uno de los 3 valores fijos (defensa además del CHECK en la base).
  if (!PUESTOS_VALIDOS.includes(puesto)) {
    return { error: 'El puesto seleccionado no es válido.' }
  }

  // Ids manipulados / no-UUID → combinación inválida (sin tocar la base).
  if (!esUuidValido(sedeId) || !esUuidValido(areaId) || !esUuidValido(subareaId)) {
    return { error: 'La combinación de sede, área y subárea no es válida.' }
  }

  // Los nombres de sede/área/subárea vienen del catálogo (canónicos): solo se
  // valida la longitud de los textos que escribe el usuario.
  const textosCortos: [string, string][] = [
    ['Nombre', nombre],
    ['Apellido', apellido],
  ]
  for (const [campo, valor] of textosCortos) {
    if (valor.length > MAX_TEXTO_CORTO) {
      return { error: `El campo ${campo} no puede superar ${MAX_TEXTO_CORTO} caracteres.` }
    }
  }

  if (!esTelefonoValido(telefono)) {
    return { error: 'Escribe un teléfono válido (solo dígitos, espacios o guiones).' }
  }

  if (!esEmailValido(email)) {
    return { error: 'Escribe un correo válido.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  if (email !== user.email?.trim().toLowerCase()) {
    return { error: 'El correo no coincide con el registrado en tu cuenta. Comunícate con el área de informática.' }
  }

  // Validar la jerarquía contra el catálogo y obtener los nombres canónicos.
  // Una sola consulta a subareas con joins inner a areas y sedes: si la
  // subárea existe, se comprueba que su area_id y el sede_id del área
  // coincidan con lo enviado (no se confía en el cliente).
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

  const sedeNombre = sub.areas.sedes.nombre
  const areaNombre = sub.areas.nombre
  const subareaNombre = sub.nombre

  if (!mantenerPassword) {
    if (!nuevaPassword) {
      return { error: 'Escribe una nueva contraseña o activa el toggle para mantener la actual.' }
    }
    if (nuevaPassword.length < MIN_PASSWORD) {
      return { error: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.` }
    }
    if (nuevaPassword.length > MAX_PASSWORD) {
      return { error: `La contraseña no puede superar ${MAX_PASSWORD} caracteres.` }
    }
    const { error: pwError } = await supabase.auth.updateUser({ password: nuevaPassword })
    if (pwError) {
      return { error: 'No se pudo actualizar la contraseña. Inténtalo de nuevo.' }
    }
  }

  const username = `${nombre} ${apellido}`

  const { error } = await supabase
    .from('profiles')
    .update({
      sede: sedeNombre,
      area: areaNombre,
      subarea: subareaNombre,
      puesto,
      username,
      telefono,
      email,
      primer_ingreso: false,
    })
    .eq('id', user.id)

  if (error) {
    if (error.code === '23505') {
      return {
        error:
          'Ya existe un usuario con ese nombre completo. Contacta al área de informática para resolver el conflicto.',
      }
    }
    // 23514 = check_violation: defensa si el puesto burlara la validación previa.
    if (error.code === '23514') {
      return { error: 'El puesto seleccionado no es válido.' }
    }
    return { error: 'No se pudo guardar la información. Inténtalo de nuevo.' }
  }

  const rol = user.user_metadata?.rol as string | undefined
  const panel = rol ? PANEL[rol] : undefined

  if (!panel) {
    return { error: 'Rol de usuario no reconocido. Contacta al administrador.' }
  }

  redirect(panel)
}
