IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'metodoFirma' AND Object_ID = Object_ID(N'[dbo].[TipoDocumento]'))
    ALTER TABLE [dbo].[TipoDocumento] ADD [metodoFirma] NVARCHAR(30) NOT NULL CONSTRAINT [DF_TipoDocumento_metodoFirma] DEFAULT 'CONTRASENA';
