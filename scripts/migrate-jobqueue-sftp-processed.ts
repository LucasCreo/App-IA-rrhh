/**
 * Migración fase 2 del feature de ingesta SFTP.
 * - Crea tabla JobQueue (cola de trabajos del worker)
 * - Crea tabla SftpArchivoProcesado (idempotencia de ingesta)
 * - Agrega campos de config SFTP a GeneralConfig
 *
 * Correr: npx tsx scripts/migrate-jobqueue-sftp-processed.ts
 */
import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()

async function addColumnIfMissing(table: string, column: string, definition: string) {
  const sql = `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'${column}' AND Object_ID = Object_ID(N'[dbo].[${table}]'))
    ALTER TABLE [dbo].[${table}] ADD [${column}] ${definition}`
  await p.$executeRawUnsafe(sql)
  console.log(`  [${table}.${column}] OK`)
}

async function createIndexIfMissing(table: string, indexName: string, columns: string, unique = false) {
  const sql = `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'${indexName}' AND object_id = Object_ID(N'[dbo].[${table}]'))
    CREATE ${unique ? 'UNIQUE ' : ''}INDEX [${indexName}] ON [dbo].[${table}] (${columns})`
  await p.$executeRawUnsafe(sql)
  console.log(`  índice [${indexName}] OK`)
}

async function createTableIfMissing(table: string, definition: string) {
  const sql = `IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'${table}')
    ${definition}`
  await p.$executeRawUnsafe(sql)
  console.log(`  tabla [${table}] OK`)
}

async function main() {
  console.log('JobQueue:')
  await createTableIfMissing('JobQueue', `
    CREATE TABLE [dbo].[JobQueue] (
      [id]          INT IDENTITY(1,1) PRIMARY KEY,
      [tipo]        NVARCHAR(50)  NOT NULL,
      [payload]     NVARCHAR(MAX) NULL,
      [estado]      NVARCHAR(20)  NOT NULL DEFAULT 'PENDING',
      [attempts]    INT           NOT NULL DEFAULT 0,
      [maxAttempts] INT           NOT NULL DEFAULT 3,
      [nextRunAt]   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
      [claimedBy]   NVARCHAR(200) NULL,
      [claimedAt]   DATETIME2     NULL,
      [finishedAt]  DATETIME2     NULL,
      [error]       NVARCHAR(MAX) NULL,
      [createdAt]   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
      [updatedAt]   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `)
  await createIndexIfMissing('JobQueue', 'JobQueue_estado_nextRunAt_idx', '[estado], [nextRunAt]')

  console.log('SftpArchivoProcesado:')
  await createTableIfMissing('SftpArchivoProcesado', `
    CREATE TABLE [dbo].[SftpArchivoProcesado] (
      [id]          INT IDENTITY(1,1) PRIMARY KEY,
      [path]        NVARCHAR(1000) NOT NULL,
      [hash]        NVARCHAR(64)   NOT NULL,
      [procesadoAt] DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
      [loteId]      INT NULL,
      [documentId]  INT NULL,
      [pendienteId] INT NULL
    )
  `)
  await createIndexIfMissing('SftpArchivoProcesado', 'SftpArchivoProcesado_path_uidx', '[path]', true)
  await createIndexIfMissing('SftpArchivoProcesado', 'SftpArchivoProcesado_hash_idx', '[hash]')

  console.log('GeneralConfig (SFTP):')
  await addColumnIfMissing('GeneralConfig', 'sftpEnabled', 'BIT NOT NULL DEFAULT 0')
  await addColumnIfMissing('GeneralConfig', 'sftpHost', 'NVARCHAR(255) NULL')
  await addColumnIfMissing('GeneralConfig', 'sftpPort', 'INT NULL DEFAULT 22')
  await addColumnIfMissing('GeneralConfig', 'sftpUser', 'NVARCHAR(255) NULL')
  await addColumnIfMissing('GeneralConfig', 'sftpPassword', 'NVARCHAR(500) NULL')
  await addColumnIfMissing('GeneralConfig', 'sftpIncomingPath', 'NVARCHAR(500) NULL')
  await addColumnIfMissing('GeneralConfig', 'sftpProcessedPath', 'NVARCHAR(500) NULL')
  await addColumnIfMissing('GeneralConfig', 'sftpPollIntervalMinutes', 'INT NOT NULL DEFAULT 15')
  await addColumnIfMissing('GeneralConfig', 'sftpStableSeconds', 'INT NOT NULL DEFAULT 30')

  console.log('Listo.')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => p.$disconnect())
