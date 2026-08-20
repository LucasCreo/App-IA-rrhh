/*
  Consolidada: cambios de esquema que se aplicaron ad-hoc con `prisma db execute`.
  - Crea las tablas `UserInvitation`, `DocumentoGrupo`, `DocumentoAsignacion` (originalmente creadas con `db push`).
  - Agrega los índices únicos `User_username_key` y `User_employeeId_key`.
  - `DocumentoGrupo`: reemplaza `filePath` por `aditusId` (los documentos viven en Aditus).
  Todo el script es idempotente.
*/
BEGIN TRY
BEGIN TRAN;

-- ── Tabla UserInvitation ─────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE object_id = OBJECT_ID(N'[dbo].[UserInvitation]'))
BEGIN
    CREATE TABLE [dbo].[UserInvitation] (
        [id] INT NOT NULL IDENTITY(1,1),
        [email] NVARCHAR(1000) NOT NULL,
        [tokenHash] NVARCHAR(1000) NOT NULL,
        [employeeId] INT,
        [role] NVARCHAR(1000) NOT NULL CONSTRAINT [UserInvitation_role_df] DEFAULT 'EMPLOYEE',
        [permisos] NVARCHAR(1000),
        [createdById] INT NOT NULL,
        [expiresAt] DATETIME2 NOT NULL,
        [acceptedAt] DATETIME2,
        [createdAt] DATETIME2 NOT NULL CONSTRAINT [UserInvitation_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT [UserInvitation_pkey] PRIMARY KEY CLUSTERED ([id]),
        CONSTRAINT [UserInvitation_tokenHash_key] UNIQUE NONCLUSTERED ([tokenHash]),
        CONSTRAINT [UserInvitation_employeeId_key] UNIQUE NONCLUSTERED ([employeeId])
    );

    ALTER TABLE [dbo].[UserInvitation] ADD CONSTRAINT [UserInvitation_employeeId_fkey]
        FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END

-- ── Tabla DocumentoGrupo ─────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE object_id = OBJECT_ID(N'[dbo].[DocumentoGrupo]'))
BEGIN
    CREATE TABLE [dbo].[DocumentoGrupo] (
        [id] INT NOT NULL IDENTITY(1,1),
        [nombreArchivo] NVARCHAR(1000) NOT NULL,
        [filePath] NVARCHAR(1000) NOT NULL,
        [periodo] NVARCHAR(1000),
        [tipoDocumentoId] INT,
        [cargadoPorId] INT NOT NULL,
        [createdAt] DATETIME2 NOT NULL CONSTRAINT [DocumentoGrupo_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT [DocumentoGrupo_pkey] PRIMARY KEY CLUSTERED ([id])
    );

    ALTER TABLE [dbo].[DocumentoGrupo] ADD CONSTRAINT [DocumentoGrupo_tipoDocumentoId_fkey]
        FOREIGN KEY ([tipoDocumentoId]) REFERENCES [dbo].[TipoDocumento]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

    ALTER TABLE [dbo].[DocumentoGrupo] ADD CONSTRAINT [DocumentoGrupo_cargadoPorId_fkey]
        FOREIGN KEY ([cargadoPorId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END

-- ── Tabla DocumentoAsignacion ────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE object_id = OBJECT_ID(N'[dbo].[DocumentoAsignacion]'))
BEGIN
    CREATE TABLE [dbo].[DocumentoAsignacion] (
        [id] INT NOT NULL IDENTITY(1,1),
        [grupoId] INT NOT NULL,
        [employeeId] INT NOT NULL,
        [estado] NVARCHAR(1000) NOT NULL CONSTRAINT [DocumentoAsignacion_estado_df] DEFAULT 'BORRADOR',
        [firmaConforme] BIT,
        [firmaComentario] NVARCHAR(1000),
        [fechaFirma] DATETIME2,
        [fechaCarga] DATETIME2 NOT NULL CONSTRAINT [DocumentoAsignacion_fechaCarga_df] DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT [DocumentoAsignacion_pkey] PRIMARY KEY CLUSTERED ([id]),
        CONSTRAINT [DocumentoAsignacion_grupoId_employeeId_key] UNIQUE NONCLUSTERED ([grupoId],[employeeId])
    );

    CREATE NONCLUSTERED INDEX [DocumentoAsignacion_employeeId_estado_idx]
        ON [dbo].[DocumentoAsignacion]([employeeId], [estado]);

    ALTER TABLE [dbo].[DocumentoAsignacion] ADD CONSTRAINT [DocumentoAsignacion_grupoId_fkey]
        FOREIGN KEY ([grupoId]) REFERENCES [dbo].[DocumentoGrupo]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE [dbo].[DocumentoAsignacion] ADD CONSTRAINT [DocumentoAsignacion_employeeId_fkey]
        FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END

-- ── User: uniques que faltaban ───────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'User_username_key' AND object_id = OBJECT_ID(N'[dbo].[User]'))
BEGIN
    ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_username_key] UNIQUE NONCLUSTERED ([username]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'User_employeeId_key' AND object_id = OBJECT_ID(N'[dbo].[User]'))
BEGIN
    ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_employeeId_key] UNIQUE NONCLUSTERED ([employeeId]);
END

-- ── DocumentoGrupo: filePath -> aditusId ─────────────────────────────────
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[DocumentoGrupo]') AND name = 'filePath')
BEGIN
    ALTER TABLE [dbo].[DocumentoGrupo] DROP COLUMN [filePath];
END
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[DocumentoGrupo]') AND name = 'aditusId')
BEGIN
    ALTER TABLE [dbo].[DocumentoGrupo] ADD [aditusId] NVARCHAR(1000);
END

COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW
END CATCH
