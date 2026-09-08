-- Elimina el estado CERRADO: se pisan los lotes existentes a LISTO y se
-- cambia el default constraint de la columna.

UPDATE [dbo].[Lote] SET [estado] = 'LISTO' WHERE [estado] = 'CERRADO';

-- Reemplazar el default constraint de 'CERRADO' a 'LISTO'
DECLARE @ConstraintName NVARCHAR(200);
SELECT @ConstraintName = dc.name
FROM sys.default_constraints dc
JOIN sys.columns c ON c.default_object_id = dc.object_id
WHERE dc.parent_object_id = OBJECT_ID('dbo.Lote')
  AND c.name = 'estado';

IF @ConstraintName IS NOT NULL
    EXEC('ALTER TABLE [dbo].[Lote] DROP CONSTRAINT [' + @ConstraintName + ']');

ALTER TABLE [dbo].[Lote] ADD CONSTRAINT [DF_Lote_estado] DEFAULT 'LISTO' FOR [estado];
