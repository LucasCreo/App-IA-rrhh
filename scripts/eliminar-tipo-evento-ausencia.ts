/**
 * Uso único: elimina el TipoEvento 'AUSENCIA' del catálogo.
 * El módulo Licencias ya lo cubre; mantener este tipo permite duplicar
 * el registro en el calendario.
 *
 * Precondición: no debe haber Eventos con tipo='AUSENCIA'.
 * Correr primero cleanup-eventos-ausencia-duplicados.ts si aún hay eventos.
 *
 * Correr: npx tsx scripts/eliminar-tipo-evento-ausencia.ts
 * O:      npx tsx scripts/eliminar-tipo-evento-ausencia.ts --dry-run
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const dryRun = process.argv.includes('--dry-run')

async function main() {
  const tipo = await prisma.tipoEvento.findUnique({ where: { nombre: 'AUSENCIA' } })
  if (!tipo) {
    console.log('No existe TipoEvento "AUSENCIA". Nada que hacer.')
    return
  }

  const eventosVinculados = await prisma.evento.count({ where: { tipo: 'AUSENCIA' } })
  if (eventosVinculados > 0) {
    console.error(
      `Todavía hay ${eventosVinculados} Evento(s) con tipo='AUSENCIA'. ` +
      `Corré primero: npx tsx scripts/cleanup-eventos-ausencia-duplicados.ts`
    )
    process.exit(1)
  }

  console.log(`Encontrado TipoEvento id=${tipo.id} "${tipo.nombre}" (protegido=${tipo.protegido}).`)
  if (dryRun) {
    console.log('(dry-run: no se borra nada)')
    return
  }

  await prisma.tipoEvento.delete({ where: { id: tipo.id } })
  console.log('Borrado.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
