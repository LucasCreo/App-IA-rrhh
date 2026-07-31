BEGIN TRY

BEGIN TRAN;

-- Eliminar tabla del proveedor externo de firma
IF OBJECT_ID('[dbo].[SignatureConfig]', 'U') IS NOT NULL
    DROP TABLE [dbo].[SignatureConfig];

-- Eliminar columna firmaExternalId de Document
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE Name = N'firmaExternalId'
      AND Object_ID = Object_ID(N'[dbo].[Document]')
)
    ALTER TABLE [dbo].[Document] DROP COLUMN [firmaExternalId];

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
