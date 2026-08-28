/**
 * Migración fase 1 del feature de ingesta SFTP.
 * Agrega campos a Lote y LoteArchivoPendiente.
 *
 * - Lote.estado (default 'CERRADO' para lotes existentes = MANUAL ya completos)
 * - Lote.progreso (default 100)
 * - Lote.origen (default 'MANUAL')
 * - Lote.mes / Lote.anio (null; solo se completan en SFTP)
 * - Índice compuesto (origen, anio, mes, estado) para buscar rápido el lote abierto del mes
 * - LoteArchivoPendiente.motivos (null para legacy)
 *
 * Correr: npx tsx scripts/migrate-lote-sftp-fields.ts
 */
import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()

async function addColumnIfMissing(table: string, column: string, definition: string) {
  const sql = `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'${column}' AND Object_ID = Object_ID(N'[dbo].[${table}]'))
    ALTER TABLE [dbo].[${table}] ADD [${column}] ${definition}`
  await p.$executeRawUnsafe(sql)
  console.log(`  [${table}.${column}] OK`)
}

async function createIndexIfMissing(table: string, indexName: string, columns: string) {
  const sql = `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'${indexName}' AND object_id = Object_ID(N'[dbo].[${table}]'))
    CREATE INDEX [${indexName}] ON [dbo].[${table}] (${columns})`
  await p.$executeRawUnsafe(sql)
  console.log(`  índice [${indexName}] OK`)
}

async function main() {
  console.log('Lote:')
  await addColumnIfMissing('Lote', 'estado', "NVARCHAR(50) NOT NULL DEFAULT 'CERRADO'")
  await addColumnIfMissing('Lote', 'progreso', 'INT NOT NULL DEFAULT 100')
  await addColumnIfMissing('Lote', 'origen', "NVARCHAR(20) NOT NULL DEFAULT 'MANUAL'")
  await addColumnIfMissing('Lote', 'mes', 'INT NULL')
  await addColumnIfMissing('Lote', 'anio', 'INT NULL')
  await createIndexIfMissing('Lote', 'Lote_origen_anio_mes_estado_idx', '[origen], [anio], [mes], [estado]')

  console.log('LoteArchivoPendiente:')
  await addColumnIfMissing('LoteArchivoPendiente', 'motivos', 'NVARCHAR(MAX) NULL')

  console.log('Listo.')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => p.$disconnect())
