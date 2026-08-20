/*
  Warnings:

  - Se dropea `filePath` de `Document` y `LoteArchivoPendiente`.
  - Se agrega `aditusId` en ambos: los archivos ahora viven en Aditus.
  - Se agrega `User.passwordTemporal` si faltaba (drift previo por db push).
*/
BEGIN TRY

BEGIN TRAN;

-- Document: filePath -> aditusId (idempotente)
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Document]') AND name = 'filePath')
BEGIN
    ALTER TABLE [dbo].[Document] DROP COLUMN [filePath];
END
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Document]') AND name = 'aditusId')
BEGIN
    ALTER TABLE [dbo].[Document] ADD [aditusId] NVARCHAR(1000);
END

-- LoteArchivoPendiente: filePath -> aditusId (idempotente)
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[LoteArchivoPendiente]') AND name = 'filePath')
BEGIN
    ALTER TABLE [dbo].[LoteArchivoPendiente] DROP COLUMN [filePath];
END
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[LoteArchivoPendiente]') AND name = 'aditusId')
BEGIN
    ALTER TABLE [dbo].[LoteArchivoPendiente] ADD [aditusId] NVARCHAR(1000);
END

-- User: agregar passwordTemporal si falta
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[User]') AND name = 'passwordTemporal')
BEGIN
    ALTER TABLE [dbo].[User] ADD [passwordTemporal] BIT NOT NULL CONSTRAINT [User_passwordTemporal_df] DEFAULT 0;
END

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
