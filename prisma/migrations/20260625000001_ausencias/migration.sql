CREATE TABLE [TipoAusencia] (
    [id] INT NOT NULL IDENTITY(1,1),
    [nombre] NVARCHAR(1000) NOT NULL,
    [color] NVARCHAR(1000) NOT NULL CONSTRAINT [TipoAusencia_color_df] DEFAULT '#6b7280',
    [requiereAprobacion] BIT NOT NULL CONSTRAINT [TipoAusencia_requiereAprobacion_df] DEFAULT 1,
    [afectaSaldo] BIT NOT NULL CONSTRAINT [TipoAusencia_afectaSaldo_df] DEFAULT 0,
    [activo] BIT NOT NULL CONSTRAINT [TipoAusencia_activo_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TipoAusencia_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [TipoAusencia_pkey] PRIMARY KEY CLUSTERED ([id])
);

ALTER TABLE [TipoAusencia] ADD CONSTRAINT [TipoAusencia_nombre_key] UNIQUE NONCLUSTERED ([nombre]);

CREATE TABLE [SolicitudAusencia] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [tipoAusenciaId] INT NOT NULL,
    [fechaInicio] DATETIME2 NOT NULL,
    [fechaFin] DATETIME2 NOT NULL,
    [dias] INT NOT NULL,
    [motivo] NVARCHAR(MAX),
    [estado] NVARCHAR(1000) NOT NULL CONSTRAINT [SolicitudAusencia_estado_df] DEFAULT 'PENDIENTE',
    [comentarioAdmin] NVARCHAR(MAX),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SolicitudAusencia_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [SolicitudAusencia_pkey] PRIMARY KEY CLUSTERED ([id])
);

ALTER TABLE [SolicitudAusencia] ADD CONSTRAINT [SolicitudAusencia_employeeId_fkey]
    FOREIGN KEY ([employeeId]) REFERENCES [Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [SolicitudAusencia] ADD CONSTRAINT [SolicitudAusencia_tipoAusenciaId_fkey]
    FOREIGN KEY ([tipoAusenciaId]) REFERENCES [TipoAusencia]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE TABLE [SaldoVacaciones] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employeeId] INT NOT NULL,
    [anio] INT NOT NULL,
    [diasTotales] INT NOT NULL CONSTRAINT [SaldoVacaciones_diasTotales_df] DEFAULT 14,
    [diasUsados] INT NOT NULL CONSTRAINT [SaldoVacaciones_diasUsados_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SaldoVacaciones_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [SaldoVacaciones_pkey] PRIMARY KEY CLUSTERED ([id])
);

ALTER TABLE [SaldoVacaciones] ADD CONSTRAINT [SaldoVacaciones_employeeId_anio_key]
    UNIQUE NONCLUSTERED ([employeeId], [anio]);

ALTER TABLE [SaldoVacaciones] ADD CONSTRAINT [SaldoVacaciones_employeeId_fkey]
    FOREIGN KEY ([employeeId]) REFERENCES [Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

INSERT INTO [TipoAusencia] ([nombre], [color], [requiereAprobacion], [afectaSaldo], [activo], [createdAt])
VALUES
    (N'Vacaciones', N'#16a34a', 1, 1, 1, CURRENT_TIMESTAMP),
    (N'Enfermedad', N'#dc2626', 1, 0, 1, CURRENT_TIMESTAMP),
    (N'Licencia Personal', N'#2563eb', 1, 0, 1, CURRENT_TIMESTAMP),
    (N'Capacitación', N'#7c3aed', 0, 0, 1, CURRENT_TIMESTAMP);
