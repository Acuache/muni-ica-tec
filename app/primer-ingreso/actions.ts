'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  esEmailValido,
  esTelefonoValido,
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

export async function completarPrimerIngreso(
  _prevState: PrimerIngresoState,
  formData: FormData,
): Promise<PrimerIngresoState> {
  const lugar = (formData.get('lugar') as string | null)?.trim() ?? ''
  const area = (formData.get('area') as string | null)?.trim() ?? ''
  const puesto = (formData.get('puesto') as string | null)?.trim() ?? ''
  const nombre = (formData.get('nombre') as string | null)?.trim() ?? ''
  const apellido = (formData.get('apellido') as string | null)?.trim() ?? ''
  const telefono = (formData.get('telefono') as string | null)?.trim() ?? ''
  const email = (formData.get('email') as string | null)?.trim().toLowerCase() ?? ''
  const mantenerPassword = formData.get('mantenerPassword') === 'true'
  const nuevaPassword = (formData.get('nuevaPassword') as string | null)?.trim() ?? ''

  if (!lugar) return { error: 'El campo Lugar no puede estar vacío.' }
  if (!area) return { error: 'El campo Área no puede estar vacío.' }
  if (!puesto) return { error: 'El campo Puesto no puede estar vacío.' }
  if (!nombre) return { error: 'El campo Nombre no puede estar vacío.' }
  if (!apellido) return { error: 'El campo Apellido no puede estar vacío.' }
  if (!telefono) return { error: 'El campo Teléfono no puede estar vacío.' }
  if (!email) return { error: 'El campo de correo no puede estar vacío.' }

  const textosCortos: [string, string][] = [
    ['Lugar', lugar],
    ['Área', area],
    ['Puesto', puesto],
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
    .update({ lugar, area, puesto, username, telefono, email, primer_ingreso: false })
    .eq('id', user.id)

  if (error) {
    if (error.code === '23505') {
      return {
        error:
          'Ya existe un usuario con ese nombre completo. Contacta al área de informática para resolver el conflicto.',
      }
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
