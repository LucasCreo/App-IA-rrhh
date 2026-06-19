ALTER TABLE [dbo].[Document] ALTER COLUMN [periodo] NVARCHAR(1000) NULL;
ALTER TABLE [dbo].[Document] ADD [metadata] NVARCHAR(MAX) NULL;
ALTER TABLE [dbo].[TipoDocumento] ADD [campos] NVARCHAR(MAX) NULL;
