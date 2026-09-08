IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'firmaVariables' AND Object_ID = Object_ID(N'[dbo].[TipoDocumento]'))
    ALTER TABLE [dbo].[TipoDocumento] DROP COLUMN [firmaVariables];
