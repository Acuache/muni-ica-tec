/**
 * seed-demo.ts — Datos demo para capturas de la presentación.
 *
 * Crea cuentas reconocibles por el prefijo de correo `demo.` y, opcionalmente,
 * solicitudes en espera para poblar la cola. Todo es reversible con `--clean`.
 *
 * Ejecutar desde la raíz del repo (lee .env.local del directorio actual):
 *   npx tsx presentacion/seed-demo.ts           # crea los datos demo
 *   npx tsx presentacion/seed-demo.ts --clean   # borra TODO lo que empiece por demo.
 *
 * No toca cuentas reales (filtra siempre por correo `demo.%`). Usa la
 * service_role key de .env.local (salta RLS), igual que scripts/seed-users.ts.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// --- cargar .env.local manualmente (tsx no lo hace por sí solo) -------------
function cargarEnvLocal() {
  try {
    const txt = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    for (const linea of txt.split('\n')) {
      const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
      if (!m) continue
      const clave = m[1]
      let valor = m[2]
      if (
        (valor.startsWith('"') && valor.endsWith('"')) ||
        (valor.startsWith("'") && valor.endsWith("'"))
      ) {
        valor = valor.slice(1, -1)
      }
      if (!process.env[clave]) process.env[clave] = valor
    }
  } catch {
    /* si no existe .env.local, se usan las variables ya presentes */
  }
}
cargarEnvLocal()

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !SERVICE_KEY) {
  console.error('❌ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

const supabase: SupabaseClient = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// --- contraseña común para todas las cuentas demo --------------------------
export const DEMO_PASSWORD = 'DemoMuni2026!'
const SEDE = 'Sede Central'

type Rol = 'jefe' | 'tecnico' | 'trabajador'

interface DemoUser {
  email: string
  rol: Rol
  /** username que registra el trigger handle_new_user (debe ser único) */
  username: string
  /** si se define, se marca primer_ingreso=false y se rellena el perfil */
  perfil?: {
    telefono: string
    area: string
    subarea: string
    puesto: 'Jefe de área' | 'Secretaria' | 'Trabajador'
  }
  /** solicitud en espera para poblar la cola (solo trabajadores) */
  solicitud?: {
    tipo_ayuda: 'presencial' | 'virtual'
    titulo: string
    descripcion: string
    anydesk_code?: string
  }
}

const USUARIOS: DemoUser[] = [
  {
    email: 'demo.jefe@muni-ica.gob.pe',
    rol: 'jefe',
    username: 'Ana Pareja Soto',
    perfil: {
      telefono: '987 100 100',
      area: 'Gerencia Municipal',
      subarea: 'Gerencia Municipal',
      puesto: 'Jefe de área',
    },
  },
  {
    email: 'demo.tecnico@muni-ica.gob.pe',
    rol: 'tecnico',
    username: 'Jorge Ttito Vargas',
    perfil: {
      telefono: '987 200 200',
      area: 'Gerencia Municipal',
      subarea: 'Unidad de Relaciones Públicas e Imagen Institucional',
      puesto: 'Trabajador',
    },
  },
  {
    // Trabajador principal: queda pendiente de PRIMER INGRESO para capturar
    // ese flujo desde la UI. El username es un placeholder que la app
    // sobrescribe cuando complete el formulario.
    email: 'demo.trabajador@muni-ica.gob.pe',
    rol: 'trabajador',
    username: 'demo_trabajador_principal',
  },
  {
    email: 'demo.t1@muni-ica.gob.pe',
    rol: 'trabajador',
    username: 'Rosa Quispe Ramírez',
    perfil: {
      telefono: '987 301 301',
      area: 'Oficina de Secretaria General',
      subarea: 'Oficina de Secretaria General',
      puesto: 'Secretaria',
    },
    solicitud: {
      tipo_ayuda: 'presencial',
      titulo: 'No enciende la computadora de mi oficina',
      descripcion: 'Al presionar el botón de encendido no aparece nada en la pantalla.',
    },
  },
  {
    email: 'demo.t2@muni-ica.gob.pe',
    rol: 'trabajador',
    username: 'Luis Huamán Ccana',
    perfil: {
      telefono: '987 302 302',
      area: 'Alcaldía',
      subarea: 'Alcaldía',
      puesto: 'Trabajador',
    },
    solicitud: {
      tipo_ayuda: 'virtual',
      titulo: 'No puedo imprimir documentos',
      descripcion: 'La impresora aparece en estado de error y no salen los documentos.',
      anydesk_code: '123456789',
    },
  },
  {
    email: 'demo.t3@muni-ica.gob.pe',
    rol: 'trabajador',
    username: 'María Flores Auqui',
    perfil: {
      telefono: '987 303 303',
      area: 'Sala de Regidores',
      subarea: 'Sala de Regidores',
      puesto: 'Secretaria',
    },
    solicitud: {
      tipo_ayuda: 'presencial',
      titulo: 'El Excel se cierra solo al abrir mis archivos',
      descripcion: 'Cuando abro un archivo de Excel el programa se cierra de inmediato.',
    },
  },
]

/** Busca el id (= auth uid) de un perfil demo por correo. */
async function idPorEmail(email: string): Promise<string | null> {
  const { data } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle()
  return data?.id ?? null
}

async function crear() {
  console.log('▶ Creando datos demo…\n')
  for (const u of USUARIOS) {
    let id: string | null = null
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { rol: u.rol, username: u.username },
    })
    if (error) {
      // Idempotencia: si ya existe, recuperamos su id para reconfigurarlo.
      id = await idPorEmail(u.email)
      if (!id) {
        console.error(`❌ ${u.email}: ${error.message}`)
        continue
      }
      console.log(`• ${u.email} ya existía — se reconfigura`)
    } else {
      id = data.user.id
      console.log(`✅ ${u.email} (${u.rol})`)
    }

    if (u.perfil) {
      const { error: eUp } = await supabase
        .from('profiles')
        .update({
          primer_ingreso: false,
          sede: SEDE,
          area: u.perfil.area,
          subarea: u.perfil.subarea,
          puesto: u.perfil.puesto,
          telefono: u.perfil.telefono,
        })
        .eq('id', id)
      if (eUp) console.error(`   ⚠ perfil ${u.email}: ${eUp.message}`)
    }

    if (u.rol === 'tecnico') {
      await supabase
        .from('technician_status')
        .update({ estado: 'disponible', ubicacion: 'Oficina de Soporte – TI' })
        .eq('tecnico_id', id)
    }

    if (u.solicitud) {
      // Evita duplicar la solicitud activa si se re-ejecuta el script.
      const { data: activa } = await supabase
        .from('solicitudes')
        .select('id')
        .eq('trabajador_id', id)
        .in('estado', ['en_espera', 'en_proceso'])
        .maybeSingle()
      if (!activa) {
        const { error: eSol } = await supabase.from('solicitudes').insert({
          trabajador_id: id,
          tipo_ayuda: u.solicitud.tipo_ayuda,
          titulo: u.solicitud.titulo,
          descripcion: u.solicitud.descripcion,
          anydesk_code: u.solicitud.anydesk_code ?? null,
          estado: 'en_espera',
        })
        if (eSol) console.error(`   ⚠ solicitud ${u.email}: ${eSol.message}`)
        else console.log(`   ↳ solicitud en espera: "${u.solicitud.titulo}"`)
      }
    }
  }

  console.log('\n──────────────────────────────────────────')
  console.log('Credenciales demo (contraseña común):', DEMO_PASSWORD)
  console.log('  Jefe:       demo.jefe@muni-ica.gob.pe')
  console.log('  Técnico:    demo.tecnico@muni-ica.gob.pe')
  console.log('  Trabajador: demo.trabajador@muni-ica.gob.pe  (pendiente de primer ingreso)')
  console.log('  Cola:       demo.t1 / demo.t2 / demo.t3 @muni-ica.gob.pe')
  console.log('──────────────────────────────────────────')
  console.log('Listo. Recuerda limpiar con:  npx tsx presentacion/seed-demo.ts --clean')
}

async function limpiar() {
  console.log('▶ Limpiando datos demo (correos demo.%)…\n')
  const { data: perfiles, error } = await supabase
    .from('profiles')
    .select('id, email')
    .like('email', 'demo.%')
  if (error) {
    console.error('❌ No se pudo listar perfiles demo:', error.message)
    process.exit(1)
  }
  if (!perfiles || perfiles.length === 0) {
    console.log('No hay perfiles demo. Nada que limpiar.')
    return
  }
  const ids = perfiles.map((p) => p.id)

  // Solicitudes de los trabajadores demo (y sus dependencias).
  const { data: sols } = await supabase
    .from('solicitudes')
    .select('id')
    .in('trabajador_id', ids)
  const solIds = (sols ?? []).map((s) => s.id)

  if (solIds.length) {
    // Soltar referencias desde technician_status antes de borrar solicitudes.
    await supabase
      .from('technician_status')
      .update({ atendiendo_solicitud_id: null, estado: 'disponible' })
      .in('atendiendo_solicitud_id', solIds)
    await supabase.from('solicitud_adjuntos').delete().in('solicitud_id', solIds)
    await supabase.from('solicitudes').delete().in('id', solIds)
    console.log(`• ${solIds.length} solicitud(es) demo eliminada(s)`)
  }

  // Borrar usuarios de auth → cascade elimina profiles y technician_status.
  for (const p of perfiles) {
    const { error: eDel } = await supabase.auth.admin.deleteUser(p.id)
    if (eDel) console.error(`❌ ${p.email}: ${eDel.message}`)
    else console.log(`✅ eliminado ${p.email}`)
  }
  console.log('\nLimpieza completa.')
}

const modoLimpieza = process.argv.includes('--clean')
;(modoLimpieza ? limpiar() : crear()).catch((e) => {
  console.error(e)
  process.exit(1)
})
