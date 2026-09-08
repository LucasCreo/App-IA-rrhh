-- 1. Tabla SignatureProvider
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'SignatureProvider')
BEGIN
    CREATE TABLE [dbo].[SignatureProvider] (
        [id]        INT IDENTITY(1,1) NOT NULL,
        [nombre]    NVARCHAR(200) NOT NULL,
        [apiUrl]    NVARCHAR(500) NOT NULL,
        [apiKey]    NVARCHAR(500) NOT NULL,
        [apiSecret] NVARCHAR(500) NULL,
        [headers]   NVARCHAR(MAX) NULL,
        [variables] NVARCHAR(MAX) NULL,
        [createdAt] DATETIME2     NOT NULL CONSTRAINT [DF_SignatureProvider_createdAt] DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [PK_SignatureProvider]        PRIMARY KEY CLUSTERED ([id]),
        CONSTRAINT [UK_SignatureProvider_nombre] UNIQUE NONCLUSTERED ([nombre])
    );
END;

-- 2. Migrar la config global (si existía y estaba habilitada) a un provider
DECLARE @providerId INT = NULL;
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE Name = N'firmaEnabled' AND Object_ID = Object_ID(N'[dbo].[GeneralConfig]')
)
BEGIN
    DECLARE @sqlInsert NVARCHAR(MAX) = N'
        IF EXISTS (SELECT 1 FROM [dbo].[GeneralConfig] WHERE firmaEnabled = 1 AND firmaApiUrl IS NOT NULL AND firmaApiKey IS NOT NULL)
        BEGIN
            INSERT INTO [dbo].[SignatureProvider] (nombre, apiUrl, apiKey, apiSecret, headers, variables)
            SELECT TOP 1
                ISNULL(NULLIF(LTRIM(RTRIM(firmaProveedor)), ''''), ''Default''),
                firmaApiUrl,
                firmaApiKey,
                firmaApiSecret,
                firmaApiHeaders,
                firmaApiVariables
            FROM [dbo].[GeneralConfig]
            WHERE firmaEnabled = 1;
            SET @outId = SCOPE_IDENTITY();
        END;';
    EXEC sp_executesql @sqlInsert, N'@outId INT OUTPUT', @outId = @providerId OUTPUT;
END;

-- 3. Columnas nuevas en TipoDocumento
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'signatureProviderId' AND Object_ID = Object_ID(N'[dbo].[TipoDocumento]'))
    ALTER TABLE [dbo].[TipoDocumento] ADD [signatureProviderId] INT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'firmaEndpoint' AND Object_ID = Object_ID(N'[dbo].[TipoDocumento]'))
    ALTER TABLE [dbo].[TipoDocumento] ADD [firmaEndpoint] NVARCHAR(500) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'firmaBody' AND Object_ID = Object_ID(N'[dbo].[TipoDocumento]'))
    ALTER TABLE [dbo].[TipoDocumento] ADD [firmaBody] NVARCHAR(MAX) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'firmaHeaders' AND Object_ID = Object_ID(N'[dbo].[TipoDocumento]'))
    ALTER TABLE [dbo].[TipoDocumento] ADD [firmaHeaders] NVARCHAR(MAX) NULL;

-- 4. FK TipoDocumento -> SignatureProvider (con dynamic SQL para diferir el parseo del nombre de columna)
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'TipoDocumento_signatureProviderId_fkey')
    EXEC('ALTER TABLE [dbo].[TipoDocumento]
          ADD CONSTRAINT [TipoDocumento_signatureProviderId_fkey]
          FOREIGN KEY ([signatureProviderId]) REFERENCES [dbo].[SignatureProvider]([id])
          ON DELETE NO ACTION ON UPDATE NO ACTION');

-- 5. Backfill vía dynamic SQL (la columna se acaba de agregar en esta misma tanda)
IF @providerId IS NOT NULL
BEGIN
    DECLARE @sqlBackfill NVARCHAR(MAX) = N'
        UPDATE [dbo].[TipoDocumento]
        SET signatureProviderId = @pid
        WHERE metodoFirma = ''PROVEEDOR'' AND signatureProviderId IS NULL;';
    EXEC sp_executesql @sqlBackfill, N'@pid INT', @pid = @providerId;
END;

-- 6. Dropear las columnas firma* de GeneralConfig (con sus DFs)
DECLARE @cn NVARCHAR(200);
DECLARE cursorDF CURSOR FAST_FORWARD FOR
    SELECT dc.name
    FROM sys.default_constraints dc
    JOIN sys.columns c ON c.default_object_id = dc.object_id
    WHERE dc.parent_object_id = OBJECT_ID('dbo.GeneralConfig')
      AND c.name IN ('firmaEnabled', 'firmaProveedor', 'firmaApiUrl', 'firmaApiKey', 'firmaApiSecret', 'firmaApiHeaders', 'firmaApiBody', 'firmaApiVariables');
OPEN cursorDF;
FETCH NEXT FROM cursorDF INTO @cn;
WHILE @@FETCH_STATUS = 0
BEGIN
    EXEC('ALTER TABLE [dbo].[GeneralConfig] DROP CONSTRAINT [' + @cn + ']');
    FETCH NEXT FROM cursorDF INTO @cn;
END;
CLOSE cursorDF; DEALLOCATE cursorDF;

IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'firmaEnabled'      AND Object_ID = Object_ID(N'[dbo].[GeneralConfig]')) ALTER TABLE [dbo].[GeneralConfig] DROP COLUMN [firmaEnabled];
IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'firmaProveedor'    AND Object_ID = Object_ID(N'[dbo].[GeneralConfig]')) ALTER TABLE [dbo].[GeneralConfig] DROP COLUMN [firmaProveedor];
IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'firmaApiUrl'       AND Object_ID = Object_ID(N'[dbo].[GeneralConfig]')) ALTER TABLE [dbo].[GeneralConfig] DROP COLUMN [firmaApiUrl];
IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'firmaApiKey'       AND Object_ID = Object_ID(N'[dbo].[GeneralConfig]')) ALTER TABLE [dbo].[GeneralConfig] DROP COLUMN [firmaApiKey];
IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'firmaApiSecret'    AND Object_ID = Object_ID(N'[dbo].[GeneralConfig]')) ALTER TABLE [dbo].[GeneralConfig] DROP COLUMN [firmaApiSecret];
IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'firmaApiHeaders'   AND Object_ID = Object_ID(N'[dbo].[GeneralConfig]')) ALTER TABLE [dbo].[GeneralConfig] DROP COLUMN [firmaApiHeaders];
IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'firmaApiBody'      AND Object_ID = Object_ID(N'[dbo].[GeneralConfig]')) ALTER TABLE [dbo].[GeneralConfig] DROP COLUMN [firmaApiBody];
IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'firmaApiVariables' AND Object_ID = Object_ID(N'[dbo].[GeneralConfig]')) ALTER TABLE [dbo].[GeneralConfig] DROP COLUMN [firmaApiVariables];
