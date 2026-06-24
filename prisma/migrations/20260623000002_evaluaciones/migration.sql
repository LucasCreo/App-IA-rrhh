CREATE TABLE [dbo].[PlantillaEvaluacion] (
    [id] INT NOT NULL IDENTITY(1,1),
    [nombre] NVARCHAR(1000) NOT NULL,
    [descripcion] NVARCHAR(MAX),
    [activo] BIT NOT NULL DEFAULT 1,
    [criterios] NVARCHAR(MAX) NOT NULL DEFAULT '[]',
    [createdAt] DATETIME2 NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PlantillaEvaluacion_pkey] PRIMARY KEY ([id])
);
CREATE UNIQUE INDEX [PlantillaEvaluacion_nombre_key] ON [dbo].[PlantillaEvaluacion]([nombre]);

CREATE TABLE [dbo].[RondaEvaluacion] (
    [id] INT NOT NULL IDENTITY(1,1),
    [nombre] NVARCHAR(1000) NOT NULL,
    [plantillaId] INT NOT NULL,
    [estado] NVARCHAR(1000) NOT NULL DEFAULT 'ACTIVA',
    [createdAt] DATETIME2 NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [RondaEvaluacion_pkey] PRIMARY KEY ([id])
);

CREATE TABLE [dbo].[Evaluacion] (
    [id] INT NOT NULL IDENTITY(1,1),
    [rondaId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [resultados] NVARCHAR(MAX) NOT NULL DEFAULT '{}',
    [comentario] NVARCHAR(MAX),
    [completada] BIT NOT NULL DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Evaluacion_pkey] PRIMARY KEY ([id])
);
CREATE UNIQUE INDEX [Evaluacion_rondaId_employeeId_key] ON [dbo].[Evaluacion]([rondaId], [employeeId]);

ALTER TABLE [dbo].[RondaEvaluacion] ADD CONSTRAINT [RondaEvaluacion_plantillaId_fkey]
    FOREIGN KEY ([plantillaId]) REFERENCES [dbo].[PlantillaEvaluacion]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [dbo].[Evaluacion] ADD CONSTRAINT [Evaluacion_rondaId_fkey]
    FOREIGN KEY ([rondaId]) REFERENCES [dbo].[RondaEvaluacion]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [dbo].[Evaluacion] ADD CONSTRAINT [Evaluacion_employeeId_fkey]
    FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
