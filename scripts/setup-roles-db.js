const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  await prisma.$executeRawUnsafe(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.User') AND name = 'rolId')
    ALTER TABLE [dbo].[User] ADD [rolId] INT NULL
  `)
  console.log('User.rolId: OK')

  await prisma.$executeRawUnsafe(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Rol')
    CREATE TABLE [dbo].[Rol] (
      [id] INT NOT NULL IDENTITY(1,1),
      [nombre] NVARCHAR(1000) NOT NULL,
      [descripcion] NVARCHAR(1000) NULL,
      [createdAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
      CONSTRAINT [Rol_pkey] PRIMARY KEY ([id])
    )
  `)
  console.log('Rol table: OK')

  await prisma.$executeRawUnsafe(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'Rol_nombre_key')
    CREATE UNIQUE INDEX [Rol_nombre_key] ON [dbo].[Rol]([nombre])
  `)
  console.log('Rol_nombre_key index: OK')

  await prisma.$executeRawUnsafe(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RolPermiso')
    CREATE TABLE [dbo].[RolPermiso] (
      [rolId] INT NOT NULL,
      [permiso] NVARCHAR(1000) NOT NULL,
      CONSTRAINT [RolPermiso_pkey] PRIMARY KEY ([rolId], [permiso])
    )
  `)
  console.log('RolPermiso table: OK')

  await prisma.$executeRawUnsafe(`
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'RolPermiso_rolId_fkey')
    ALTER TABLE [dbo].[RolPermiso] ADD CONSTRAINT [RolPermiso_rolId_fkey]
      FOREIGN KEY ([rolId]) REFERENCES [dbo].[Rol]([id]) ON DELETE CASCADE ON UPDATE CASCADE
  `)
  console.log('RolPermiso FK: OK')

  await prisma.$executeRawUnsafe(`
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'User_rolId_fkey')
    ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_rolId_fkey]
      FOREIGN KEY ([rolId]) REFERENCES [dbo].[Rol]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
  `)
  console.log('User_rolId_fkey FK: OK')

  await prisma.$disconnect()
  console.log('\nTodas las tablas y columnas creadas correctamente.')
}

main().catch(e => { console.error(e); process.exit(1) })
