DECLARE @df sysname;
SELECT @df = dc.name
FROM sys.default_constraints dc
JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
WHERE dc.parent_object_id = OBJECT_ID('dbo.User') AND c.name = 'scopeJerarquico';
IF @df IS NOT NULL EXEC('ALTER TABLE [dbo].[User] DROP CONSTRAINT [' + @df + ']');

IF COL_LENGTH('dbo.User', 'scopeJerarquico') IS NOT NULL
  ALTER TABLE [dbo].[User] DROP COLUMN [scopeJerarquico];
