// Validadores compartidos por las Server Actions (SPEC 10).
// Sin dependencias externas: regex y límites propios.

/** Longitud máxima para campos de texto corto (nombre, área, puesto, etc.). */
export const MAX_TEXTO_CORTO = 120

/** Longitud máxima de un correo según RFC 5321. */
export const MAX_EMAIL = 254

/** Mínimo de caracteres exigido para contraseñas en toda la app. */
export const MIN_PASSWORD = 8

/** Límite efectivo de bcrypt (backend de Supabase Auth): más bytes se truncan. */
export const MAX_PASSWORD = 72

/** Longitud máxima para campos de texto largo (descripción de la solicitud). */
export const MAX_TEXTO_LARGO = 2000

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// AnyDesk usa identificadores numéricos de hasta ~10 dígitos.
const ANYDESK_RE = /^\d{1,15}$/

// Lenientes a propósito: dígitos con espacios, guiones, paréntesis y un "+"
// inicial opcional. Entre 6 y 15 dígitos (rango E.164 + fijos locales).
const TELEFONO_RE = /^\+?[\d\s()-]+$/

export function esEmailValido(email: string): boolean {
  return email.length <= MAX_EMAIL && EMAIL_RE.test(email)
}

export function esTelefonoValido(telefono: string): boolean {
  const digitos = telefono.replace(/\D/g, '')
  return (
    TELEFONO_RE.test(telefono) && digitos.length >= 6 && digitos.length <= 15
  )
}

export function esUuidValido(id: string): boolean {
  return UUID_RE.test(id)
}

export function esAnydeskValido(codigo: string): boolean {
  return ANYDESK_RE.test(codigo)
}
