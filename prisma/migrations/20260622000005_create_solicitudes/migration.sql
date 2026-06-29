CREATE TABLE [dbo].[TipoSolicitud] (
    [id] INT NOT NULL IDENTITY(1,1),
    [nombre] NVARCHAR(1000) NOT NULL,
    [descripcion] NVARCHAR(1000),
    [activo] BIT NOT NULL DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [TipoSolicitud_pkey] PRIMARY KEY CLUSTERED ([id])
);
CREATE UNIQUE INDEX [TipoSolicitud_nombre_key] ON [dbo].[TipoSolicitud]([nombre]);

CREATE TABLE [dbo].[SolicitudDocumento] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [tipoId] INT NOT NULL,
    [nombreArchivo] NVARCHAR(MAX) NOT NULL,
    [descripcion] NVARCHAR(1000),
    [estado] NVARCHAR(1000) NOT NULL DEFAULT 'PENDIENTE',
    [comentario] NVARCHAR(1000),
    [comentarioVisible] BIT NOT NULL DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [SolicitudDocumento_pkey] PRIMARY KEY CLUSTERED ([id])
);
ALTER TABLE [dbo].[SolicitudDocumento] ADD CONSTRAINT [SolicitudDocumento_employeeId_fkey]
    FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SolicitudDocumento] ADD CONSTRAINT [SolicitudDocumento_tipoId_fkey]
    FOREIGN KEY ([tipoId]) REFERENCES [dbo].[TipoSolicitud]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE TABLE [dbo].[SolicitudModificacion] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [comentario] NVARCHAR(MAX) NOT NULL,
    [estado] NVARCHAR(1000) NOT NULL DEFAULT 'PENDIENTE',
    [createdAt] DATETIME2 NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [SolicitudModificacion_pkey] PRIMARY KEY CLUSTERED ([id])
);
ALTER TABLE [dbo].[SolicitudModificacion] ADD CONSTRAINT [SolicitudModificacion_employeeId_fkey]
    FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
