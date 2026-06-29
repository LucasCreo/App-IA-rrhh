-- Rol y RolPermiso
CREATE TABLE [dbo].[Rol] (
    [id] INT NOT NULL IDENTITY(1,1),
    [nombre] NVARCHAR(1000) NOT NULL,
    [descripcion] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Rol_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Rol_nombre_key] UNIQUE NONCLUSTERED ([nombre])
);

CREATE TABLE [dbo].[RolPermiso] (
    [rolId] INT NOT NULL,
    [permiso] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [RolPermiso_pkey] PRIMARY KEY CLUSTERED ([rolId], [permiso])
);
ALTER TABLE [dbo].[RolPermiso] ADD CONSTRAINT [RolPermiso_rolId_fkey]
    FOREIGN KEY ([rolId]) REFERENCES [dbo].[Rol]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- Columnas faltantes en User
ALTER TABLE [dbo].[User] ADD [username] NVARCHAR(1000);
ALTER TABLE [dbo].[User] ADD [avatarUrl] NVARCHAR(1000);
ALTER TABLE [dbo].[User] ADD [rolId] INT;
ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_rolId_fkey]
    FOREIGN KEY ([rolId]) REFERENCES [dbo].[Rol]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- Lote
CREATE TABLE [dbo].[Lote] (
    [id] INT NOT NULL IDENTITY(1,1),
    [nombre] NVARCHAR(1000) NOT NULL,
    [descripcion] NVARCHAR(1000),
    [periodo] NVARCHAR(1000) NOT NULL,
    [tipoDocumentoId] INT,
    [creadoPorId] INT NOT NULL,
    [createdAt] DATETIME2 NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Lote_pkey] PRIMARY KEY CLUSTERED ([id])
);
ALTER TABLE [dbo].[Lote] ADD CONSTRAINT [Lote_tipoDocumentoId_fkey]
    FOREIGN KEY ([tipoDocumentoId]) REFERENCES [dbo].[TipoDocumento]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Lote] ADD CONSTRAINT [Lote_creadoPorId_fkey]
    FOREIGN KEY ([creadoPorId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- loteId en Document
ALTER TABLE [dbo].[Document] ADD [loteId] INT;
ALTER TABLE [dbo].[Document] ADD CONSTRAINT [Document_loteId_fkey]
    FOREIGN KEY ([loteId]) REFERENCES [dbo].[Lote]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- CampoPersonalizado y ValorCampoEmpleado
CREATE TABLE [dbo].[campos_personalizados] (
    [id] INT NOT NULL IDENTITY(1,1),
    [nombre] NVARCHAR(1000) NOT NULL,
    [tipo] NVARCHAR(1000) NOT NULL DEFAULT 'texto',
    [visible] BIT NOT NULL DEFAULT 1,
    [requerido] BIT NOT NULL DEFAULT 0,
    [orden] INT NOT NULL DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [campos_personalizados_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [campos_personalizados_nombre_key] UNIQUE NONCLUSTERED ([nombre])
);

CREATE TABLE [dbo].[valores_campo_empleado] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [campoId] INT NOT NULL,
    [valor] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [valores_campo_empleado_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [valores_campo_empleado_employeeId_campoId_key] UNIQUE NONCLUSTERED ([employeeId], [campoId])
);
ALTER TABLE [dbo].[valores_campo_empleado] ADD CONSTRAINT [valores_campo_empleado_employeeId_fkey]
    FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE [dbo].[valores_campo_empleado] ADD CONSTRAINT [valores_campo_empleado_campoId_fkey]
    FOREIGN KEY ([campoId]) REFERENCES [dbo].[campos_personalizados]([id]) ON DELETE CASCADE ON UPDATE CASCADE;
