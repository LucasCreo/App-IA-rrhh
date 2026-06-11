BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[User] (
    [id] INT NOT NULL IDENTITY(1,1),
    [email] NVARCHAR(1000) NOT NULL,
    [passwordHash] NVARCHAR(1000) NOT NULL,
    [role] NVARCHAR(1000) NOT NULL CONSTRAINT [User_role_df] DEFAULT 'EMPLOYEE',
    [employeeId] INT,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [User_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [User_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [User_email_key] UNIQUE NONCLUSTERED ([email]),
    CONSTRAINT [User_employeeId_key] UNIQUE NONCLUSTERED ([employeeId])
);

-- CreateTable
CREATE TABLE [dbo].[Employee] (
    [id] INT NOT NULL IDENTITY(1,1),
    [legajo] NVARCHAR(1000) NOT NULL,
    [nombre] NVARCHAR(1000) NOT NULL,
    [apellido] NVARCHAR(1000) NOT NULL,
    [cuil] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000) NOT NULL,
    [telefono] NVARCHAR(1000),
    [fechaIngreso] DATETIME2 NOT NULL,
    [categoriaId] INT NOT NULL,
    [estado] NVARCHAR(1000) NOT NULL CONSTRAINT [Employee_estado_df] DEFAULT 'ACTIVO',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Employee_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Employee_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Employee_legajo_key] UNIQUE NONCLUSTERED ([legajo]),
    CONSTRAINT [Employee_cuil_key] UNIQUE NONCLUSTERED ([cuil]),
    CONSTRAINT [Employee_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[Category] (
    [id] INT NOT NULL IDENTITY(1,1),
    [nombre] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [Category_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Category_nombre_key] UNIQUE NONCLUSTERED ([nombre])
);

-- CreateTable
CREATE TABLE [dbo].[Document] (
    [id] INT NOT NULL IDENTITY(1,1),
    [nombreArchivo] NVARCHAR(1000) NOT NULL,
    [filePath] NVARCHAR(1000) NOT NULL,
    [periodo] NVARCHAR(1000) NOT NULL,
    [fechaCarga] DATETIME2 NOT NULL CONSTRAINT [Document_fechaCarga_df] DEFAULT CURRENT_TIMESTAMP,
    [cargadoPorId] INT NOT NULL,
    [employeeId] INT NOT NULL,
    [tipoDocumentoId] INT,
    [estado] NVARCHAR(1000) NOT NULL CONSTRAINT [Document_estado_df] DEFAULT 'BORRADOR',
    [firmaExternalId] NVARCHAR(1000),
    [fechaFirma] DATETIME2,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Document_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[TipoDocumento] (
    [id] INT NOT NULL IDENTITY(1,1),
    [nombre] NVARCHAR(1000) NOT NULL,
    [descripcion] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TipoDocumento_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [TipoDocumento_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [TipoDocumento_nombre_key] UNIQUE NONCLUSTERED ([nombre])
);

-- CreateTable
CREATE TABLE [dbo].[GeneralConfig] (
    [id] INT NOT NULL IDENTITY(1,1),
    [appName] NVARCHAR(1000) NOT NULL CONSTRAINT [GeneralConfig_appName_df] DEFAULT 'RRHH',
    [logoUrl] NVARCHAR(1000),
    [primaryColor] NVARCHAR(1000) NOT NULL CONSTRAINT [GeneralConfig_primaryColor_df] DEFAULT '#166534',
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [GeneralConfig_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[EmployeeFieldConfig] (
    [campo] NVARCHAR(1000) NOT NULL,
    [visible] BIT NOT NULL CONSTRAINT [EmployeeFieldConfig_visible_df] DEFAULT 1,
    [requerido] BIT NOT NULL CONSTRAINT [EmployeeFieldConfig_requerido_df] DEFAULT 0,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [EmployeeFieldConfig_pkey] PRIMARY KEY CLUSTERED ([campo])
);

-- CreateTable
CREATE TABLE [dbo].[SignatureConfig] (
    [id] INT NOT NULL IDENTITY(1,1),
    [providerUrl] NVARCHAR(1000) NOT NULL,
    [apiKey] NVARCHAR(1000) NOT NULL,
    [extraHeaders] NVARCHAR(1000) NOT NULL CONSTRAINT [SignatureConfig_extraHeaders_df] DEFAULT '{}',
    [extraBody] NVARCHAR(1000) NOT NULL CONSTRAINT [SignatureConfig_extraBody_df] DEFAULT '{}',
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [SignatureConfig_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[AuditLog] (
    [id] INT NOT NULL IDENTITY(1,1),
    [userId] INT NOT NULL,
    [accion] NVARCHAR(1000) NOT NULL,
    [entidad] NVARCHAR(1000) NOT NULL,
    [detalle] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AuditLog_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [AuditLog_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- AddForeignKey
ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Employee] ADD CONSTRAINT [Employee_categoriaId_fkey] FOREIGN KEY ([categoriaId]) REFERENCES [dbo].[Category]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Document] ADD CONSTRAINT [Document_cargadoPorId_fkey] FOREIGN KEY ([cargadoPorId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Document] ADD CONSTRAINT [Document_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Document] ADD CONSTRAINT [Document_tipoDocumentoId_fkey] FOREIGN KEY ([tipoDocumentoId]) REFERENCES [dbo].[TipoDocumento]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[AuditLog] ADD CONSTRAINT [AuditLog_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
