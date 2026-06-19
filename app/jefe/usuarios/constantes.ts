import type { RolApp } from '@/lib/autorizacion'

// Contraseña por defecto de cada rol. Se asigna al crear y al restablecer; el
// jefe nunca la escribe. No es secreta: el formulario la muestra con "ver
// contraseñas" y el usuario la cambia en su primer ingreso. Todas cumplen
// MIN_PASSWORD (8). (SPEC 14)
//
// Módulo aparte (no 'use server') para poder importarla tanto desde las Server
// Actions como desde el formulario cliente. El import de RolApp es type-only,
// así que no arrastra código de servidor al bundle del cliente.
export const PASSWORD_POR_ROL: Record<RolApp, string> = {
  jefe: 'jefe-muni',
  tecnico: 'tecnico-muni',
  trabajador: 'trabajador-muni',
}
