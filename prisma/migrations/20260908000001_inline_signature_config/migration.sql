-- 1. Nuevas columnas inline en TipoDocumento
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'firmaProveedorNombre' AND Object_ID = Object_ID(N'[dbo].[TipoDocumento]'))
    ALTER TABLE [dbo].[TipoDocumento] ADD [firmaProveedorNombre] NVARCHAR(200) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'firmaApiUrl' AND Object_ID = Object_ID(N'[dbo].[TipoDocumento]'))
    ALTER TABLE [dbo].[TipoDocumento] ADD [firmaApiUrl] NVARCHAR(500) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'firmaApiKey' AND Object_ID = Object_ID(N'[dbo].[TipoDocumento]'))
    ALTER TABLE [dbo].[TipoDocumento] ADD [firmaApiKey] NVARCHAR(500) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'firmaApiSecret' AND Object_ID = Object_ID(N'[dbo].[TipoDocumento]'))
    ALTER TABLE [dbo].[TipoDocumento] ADD [firmaApiSecret] NVARCHAR(500) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'firmaVariables' AND Object_ID = Object_ID(N'[dbo].[TipoDocumento]'))
    ALTER TABLE [dbo].[TipoDocumento] ADD [firmaVariables] NVARCHAR(MAX) NULL;

-- 2. Backfill desde SignatureProvider (dynamic SQL para diferir el parseo de columnas nuevas)
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'SignatureProvider')
  AND EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'signatureProviderId' AND Object_ID = Object_ID(N'[dbo].[TipoDocumento]'))
BEGIN
    EXEC('
        UPDATE td
        SET td.firmaProveedorNombre = sp.nombre,
            td.firmaApiUrl          = sp.apiUrl,
            td.firmaApiKey          = sp.apiKey,
            td.firmaApiSecret       = sp.apiSecret,
            td.firmaVariables       = sp.variables,
            td.firmaHeaders         = COALESCE(td.firmaHeaders, sp.headers)
        FROM [dbo].[TipoDocumento] td
        JOIN [dbo].[SignatureProvider] sp ON sp.id = td.signatureProviderId
        WHERE td.metodoFirma = ''PROVEEDOR'';
    ');
END;

-- 3. Drop FK TipoDocumento -> SignatureProvider
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'TipoDocumento_signatureProviderId_fkey')
    ALTER TABLE [dbo].[TipoDocumento] DROP CONSTRAINT [TipoDocumento_signatureProviderId_fkey];

-- 4. Drop columna signatureProviderId
IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'signatureProviderId' AND Object_ID = Object_ID(N'[dbo].[TipoDocumento]'))
    ALTER TABLE [dbo].[TipoDocumento] DROP COLUMN [signatureProviderId];

-- 5. Drop tabla SignatureProvider
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'SignatureProvider')
    DROP TABLE [dbo].[SignatureProvider];
