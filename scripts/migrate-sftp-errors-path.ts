/**
 * Agrega GeneralConfig.sftpErrorsPath para configurar dónde se mueven los
 * PDFs que fallaron validación (o duplicados por hash) al procesarse.
 *
 * Correr: npx tsx scripts/migrate-sftp-errors-path.ts
 */
import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()

async function main() {
  const sql = `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'sftpErrorsPath' AND Object_ID = Object_ID(N'[dbo].[GeneralConfig]'))
    ALTER TABLE [dbo].[GeneralConfig] ADD [sftpErrorsPath] NVARCHAR(1000) NULL`
  await p.$executeRawUnsafe(sql)
  console.log('GeneralConfig.sftpErrorsPath OK')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => p.$disconnect())
