CREATE TABLE [PlantillaFormulario] (
    [id] INT NOT NULL IDENTITY(1,1),
    [nombre] NVARCHAR(1000) NOT NULL,
    [descripcion] NVARCHAR(1000),
    [activo] BIT NOT NULL DEFAULT 1,
    [campos] NVARCHAR(MAX) NOT NULL DEFAULT '[]',
    [createdAt] DATETIME2 NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PlantillaFormulario_pkey] PRIMARY KEY ([id])
);

CREATE UNIQUE INDEX [PlantillaFormulario_nombre_key] ON [PlantillaFormulario]([nombre]);

CREATE TABLE [AsignacionFormulario] (
    [id] INT NOT NULL IDENTITY(1,1),
    [nombre] NVARCHAR(1000) NOT NULL,
    [plantillaId] INT NOT NULL,
    [fechaLimite] DATETIME2,
    [createdAt] DATETIME2 NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [AsignacionFormulario_pkey] PRIMARY KEY ([id])
);

CREATE TABLE [RespuestaFormulario] (
    [id] INT NOT NULL IDENTITY(1,1),
    [asignacionId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [datos] NVARCHAR(MAX) NOT NULL DEFAULT '{}',
    [estado] NVARCHAR(1000) NOT NULL DEFAULT 'PENDIENTE',
    [createdAt] DATETIME2 NOT NULL DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [RespuestaFormulario_pkey] PRIMARY KEY ([id])
);

CREATE UNIQUE INDEX [RespuestaFormulario_asignacionId_employeeId_key] ON [RespuestaFormulario]([asignacionId], [employeeId]);

ALTER TABLE [AsignacionFormulario] ADD CONSTRAINT [AsignacionFormulario_plantillaId_fkey]
  FOREIGN KEY ([plantillaId]) REFERENCES [PlantillaFormulario]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [RespuestaFormulario] ADD CONSTRAINT [RespuestaFormulario_asignacionId_fkey]
  FOREIGN KEY ([asignacionId]) REFERENCES [AsignacionFormulario]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [RespuestaFormulario] ADD CONSTRAINT [RespuestaFormulario_employeeId_fkey]
  FOREIGN KEY ([employeeId]) REFERENCES [Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
