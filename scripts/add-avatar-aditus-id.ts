import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
async function main() {
  const sql = `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'avatarAditusId' AND Object_ID = Object_ID(N'[dbo].[User]'))
    ALTER TABLE [dbo].[User] ADD [avatarAditusId] NVARCHAR(1000) NULL`
  await p.$executeRawUnsafe(sql)
  console.log('OK')
}
main().catch(e => { console.error(e); process.exit(1) }).finally(() => p.$disconnect())
