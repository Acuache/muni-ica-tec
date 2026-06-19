import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

// Limpieza del PLANO DE DATOS para producción: borra TODAS las solicitudes y
// sus adjuntos (filas en BD por cascada + archivos físicos en Storage).
// Usa solo PostgREST + Storage, que sí funcionan con la service_role key.
//
// IMPORTANTE — el borrado de CUENTAS no se hace aquí:
//   La Admin Auth API de GoTrue (listUsers/deleteUser) falla con
//   "Database error finding users" porque hay filas en auth.users con tokens
//   en NULL (cuentas insertadas por SQL directo, sin perfil). Por eso las
//   cuentas se eliminan por SQL directo (DELETE FROM auth.users ...), que
//   cascada a profiles y technician_status. Ver el flujo en el plan.
//
// Seguridad: DRY-RUN por defecto. Ejecuta de verdad con `--confirm`.
// El borrado es irreversible.

const CONFIRM = process.argv.includes('--confirm') || process.env.CONFIRM === '1'
const BUCKET_ADJUNTOS = 'solicitud-adjuntos'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

// Lista recursiva de todos los objetos de un bucket (paths completos).
// Los adjuntos viven en `{solicitud_id}/{archivo}`, así que hay que entrar a
// cada "carpeta" (entradas con id === null en runtime) y listar sus archivos.
async function listarObjetosBucket(bucket: string): Promise<string[]> {
  const raiz = await admin.storage.from(bucket).list('', { limit: 1000 })
  if (raiz.error) throw new Error(`list('${bucket}'): ${raiz.error.message}`)

  const esCarpeta = (e: { id: string | null }) => e.id === null

  const paths: string[] = []
  for (const entrada of raiz.data ?? []) {
    if (esCarpeta(entrada)) {
      const sub = await admin.storage.from(bucket).list(entrada.name, { limit: 1000 })
      if (sub.error) throw new Error(`list('${bucket}/${entrada.name}'): ${sub.error.message}`)
      for (const f of sub.data ?? []) {
        if (!esCarpeta(f)) paths.push(`${entrada.name}/${f.name}`)
      }
    } else {
      paths.push(entrada.name)
    }
  }
  return paths
}

async function main() {
  console.log(
    `🧹 Limpieza del plano de datos — modo: ${CONFIRM ? 'EJECUCIÓN (--confirm)' : 'DRY-RUN'}\n`,
  )

  const { count: nSolic, error: cntErr } = await admin
    .from('solicitudes')
    .select('id', { count: 'exact', head: true })
  if (cntErr) throw new Error(`contar solicitudes: ${cntErr.message}`)

  const objetos = await listarObjetosBucket(BUCKET_ADJUNTOS)

  console.log(`Solicitudes a borrar: ${nSolic ?? 0}`)
  console.log(`Objetos en Storage '${BUCKET_ADJUNTOS}' a borrar: ${objetos.length}`)
  for (const p of objetos) console.log(`  • ${p}`)

  if (!CONFIRM) {
    console.log('\n🟡 DRY-RUN: no se borró nada. Repite con --confirm para ejecutar.')
    console.log('   (Las cuentas de usuario se borran después por SQL directo.)')
    return
  }

  console.log('\n⏳ Ejecutando borrado del plano de datos (irreversible)...')

  // 1) Liberar la FK RESTRICT technician_status.atendiendo_solicitud_id → solicitudes
  {
    const { error } = await admin
      .from('technician_status')
      .update({ atendiendo_solicitud_id: null, estado: 'disponible' })
      .not('atendiendo_solicitud_id', 'is', null)
    if (error) throw new Error(`liberar technician_status: ${error.message}`)
    console.log('  ✔ technician_status liberado (atendiendo_solicitud_id = null)')
  }

  // 2) Borrar TODAS las solicitudes (cascada → solicitud_adjuntos en BD)
  {
    const { error } = await admin.from('solicitudes').delete().not('id', 'is', null)
    if (error) throw new Error(`borrar solicitudes: ${error.message}`)
    console.log('  ✔ solicitudes borradas (cascada a solicitud_adjuntos)')
  }

  // 3) Limpiar Storage de adjuntos (archivos físicos + sus filas en storage.objects;
  //    incluye huérfanos que el cron no rastrea)
  if (objetos.length > 0) {
    for (let i = 0; i < objetos.length; i += 100) {
      const lote = objetos.slice(i, i + 100)
      const { error } = await admin.storage.from(BUCKET_ADJUNTOS).remove(lote)
      if (error) throw new Error(`remove storage: ${error.message}`)
    }
    console.log(`  ✔ ${objetos.length} objeto(s) borrados de '${BUCKET_ADJUNTOS}'`)
  } else {
    console.log(`  ✔ Storage '${BUCKET_ADJUNTOS}' ya estaba vacío`)
  }

  console.log('\n✅ Plano de datos limpio.')
  console.log('   Siguiente paso: borrar las 7 cuentas por SQL (DELETE FROM auth.users ...).')
}

main().catch((err) => {
  console.error('\n❌ FALLO EN LA LIMPIEZA')
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
