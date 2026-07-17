-- Drop default constraint sobre Category.nivel (si existiese) y columna
DECLARE @df sysname;
SELECT @df = dc.name
FROM sys.default_constraints dc
JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
WHERE dc.parent_object_id = OBJECT_ID('dbo.Category') AND c.name = 'nivel';
IF @df IS NOT NULL EXEC('ALTER TABLE [dbo].[Category] DROP CONSTRAINT [' + @df + ']');

IF COL_LENGTH('dbo.Category', 'nivel') IS NOT NULL
  ALTER TABLE [dbo].[Category] DROP COLUMN [nivel];

DECLARE @df2 sysname;
SELECT @df2 = dc.name
FROM sys.default_constraints dc
JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
WHERE dc.parent_object_id = OBJECT_ID('dbo.Category') AND c.name = 'rolPorDefecto';
IF @df2 IS NOT NULL EXEC('ALTER TABLE [dbo].[Category] DROP CONSTRAINT [' + @df2 + ']');

IF COL_LENGTH('dbo.Category', 'rolPorDefecto') IS NOT NULL
  ALTER TABLE [dbo].[Category] DROP COLUMN [rolPorDefecto];
