/**
 * Uso único: elimina Eventos de tipo='AUSENCIA' que se crearon automáticamente
 * al aprobar SolicitudAusencia, y que ahora quedaron duplicados porque el
 * calendario los muestra como eventos virtuales.
 *
 * Match: mismo employeeId asignado + misma fechaInicio + misma fechaFin que
 * alguna SolicitudAusencia (independiente del estado, por si hubo cambios).
 *
 * Correr: npx tsx scripts/cleanup-eventos-ausencia-duplicados.ts
 * O:      npx tsx scripts/cleanup-eventos-ausencia-duplicados.ts --dry-run
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const dryRun = process.argv.includes('--dry-run')

async function main() {
  const eventos = await prisma.evento.findMany({
    where: { tipo: 'AUSENCIA' },
    include: { asignados: { select: { employeeId: true } } },
  })
  console.log(`Encontrados ${eventos.length} Eventos con tipo='AUSENCIA'.`)

  let candidatos = 0
  let borrados = 0
  const idsABorrar: number[] = []

  for (const e of eventos) {
    // Los auto-creados tienen exactamente 1 asignado (el empleado dueño de la ausencia)
    if (e.asignados.length !== 1) continue
    const empId = e.asignados[0].employeeId
    const match = await prisma.solicitudAusencia.findFirst({
      where: {
        employeeId: empId,
        fechaInicio: e.fechaInicio,
        fechaFin: e.fechaFin ?? undefined,
      },
      select: { id: true, estado: true },
    })
    if (!match) continue
    candidatos++
    idsABorrar.push(e.id)
    console.log(
      `  candidato: Evento ${e.id} "${e.titulo}" (${e.fechaInicio.toISOString().slice(0, 10)} → ${e.fechaFin?.toISOString().slice(0, 10) ?? '—'}) ` +
      `↔ SolicitudAusencia ${match.id} [${match.estado}]`
    )
  }

  console.log(`\nCandidatos a borrar: ${candidatos}`)

  if (dryRun) {
    console.log('(dry-run: no se borra nada)')
    return
  }

  if (idsABorrar.length === 0) {
    console.log('Nada que borrar.')
    return
  }

  // Borrar en cascada: primero EventoEmpleado, luego Evento.
  await prisma.eventoEmpleado.deleteMany({ where: { eventoId: { in: idsABorrar } } })
  const del = await prisma.evento.deleteMany({ where: { id: { in: idsABorrar } } })
  borrados = del.count
  console.log(`\nBorrados: ${borrados}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
