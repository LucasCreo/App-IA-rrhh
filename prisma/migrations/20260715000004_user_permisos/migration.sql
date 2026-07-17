-- Nueva tabla UserPermiso
CREATE TABLE [dbo].[UserPermiso] (
  [userId]  INT NOT NULL,
  [permiso] NVARCHAR(1000) NOT NULL,
  CONSTRAINT [PK_UserPermiso] PRIMARY KEY ([userId], [permiso]),
  CONSTRAINT [FK_UserPermiso_User] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE
);

-- Nueva columna scopeJerarquico en User
ALTER TABLE [dbo].[User] ADD [scopeJerarquico] BIT NOT NULL CONSTRAINT [DF_User_scopeJerarquico] DEFAULT 0;

-- Backfill diferido con EXEC (para evitar el compile-time check sobre columnas recién creadas)
EXEC('
  UPDATE u
  SET u.scopeJerarquico = r.scopeJerarquico
  FROM [dbo].[User] u
  JOIN [dbo].[Rol] r ON u.rolId = r.id;
');

EXEC('
  INSERT INTO [dbo].[UserPermiso] ([userId], [permiso])
  SELECT DISTINCT u.id, rp.permiso
  FROM [dbo].[User] u
  JOIN [dbo].[Rol] r ON u.rolId = r.id
  JOIN [dbo].[RolPermiso] rp ON rp.rolId = r.id;
');

-- Drop FK y columna User.rolId
DECLARE @fkName sysname;
SELECT @fkName = fk.name
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
JOIN sys.columns c ON fkc.parent_object_id = c.object_id AND fkc.parent_column_id = c.column_id
WHERE fk.parent_object_id = OBJECT_ID('dbo.User') AND c.name = 'rolId';

IF @fkName IS NOT NULL EXEC('ALTER TABLE [dbo].[User] DROP CONSTRAINT [' + @fkName + ']');

DECLARE @ixName sysname;
SELECT @ixName = i.name
FROM sys.indexes i
JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
WHERE i.object_id = OBJECT_ID('dbo.User') AND c.name = 'rolId' AND i.is_primary_key = 0 AND i.is_unique_constraint = 0;

IF @ixName IS NOT NULL EXEC('DROP INDEX [' + @ixName + '] ON [dbo].[User]');

IF COL_LENGTH('dbo.User', 'rolId') IS NOT NULL
  ALTER TABLE [dbo].[User] DROP COLUMN [rolId];

-- Drop tablas RolPermiso y Rol
IF OBJECT_ID('dbo.RolPermiso', 'U') IS NOT NULL DROP TABLE [dbo].[RolPermiso];
IF OBJECT_ID('dbo.Rol', 'U') IS NOT NULL DROP TABLE [dbo].[Rol];
