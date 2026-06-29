DECLARE @c NVARCHAR(200);
SELECT @c = dc.name
FROM sys.default_constraints dc
JOIN sys.columns col ON col.default_object_id = dc.object_id
WHERE dc.parent_object_id = OBJECT_ID('dbo.SolicitudDocumento')
  AND col.name = 'updatedAt';
IF @c IS NOT NULL EXEC('ALTER TABLE [dbo].[SolicitudDocumento] DROP CONSTRAINT [' + @c + ']');
