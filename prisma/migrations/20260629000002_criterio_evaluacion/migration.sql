-- Drop default constraint and column criterios JSON
DECLARE @cName NVARCHAR(200)
SELECT @cName = dc.name
FROM sys.default_constraints dc
JOIN sys.columns c ON c.default_object_id = dc.object_id
WHERE dc.parent_object_id = OBJECT_ID('dbo.PlantillaEvaluacion')
  AND c.name = 'criterios';
IF @cName IS NOT NULL EXEC('ALTER TABLE [dbo].[PlantillaEvaluacion] DROP CONSTRAINT [' + @cName + ']');

IF COL_LENGTH('dbo.PlantillaEvaluacion', 'criterios') IS NOT NULL
    ALTER TABLE [dbo].[PlantillaEvaluacion] DROP COLUMN [criterios];

CREATE TABLE [dbo].[CriterioEvaluacion] (
    [id] INT NOT NULL IDENTITY(1,1),
    [plantillaId] INT NOT NULL,
    [nombre] NVARCHAR(1000) NOT NULL,
    [label] NVARCHAR(1000) NOT NULL,
    [tipo] NVARCHAR(1000) NOT NULL,
    [orden] INT NOT NULL CONSTRAINT [CriterioEvaluacion_orden_df] DEFAULT 0,
    CONSTRAINT [CriterioEvaluacion_pkey] PRIMARY KEY CLUSTERED ([id])
);

ALTER TABLE [dbo].[CriterioEvaluacion] ADD CONSTRAINT [CriterioEvaluacion_plantillaId_fkey]
    FOREIGN KEY ([plantillaId]) REFERENCES [dbo].[PlantillaEvaluacion]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
