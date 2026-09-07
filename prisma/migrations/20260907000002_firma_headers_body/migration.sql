IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'firmaApiHeaders' AND Object_ID = Object_ID(N'[dbo].[GeneralConfig]'))
    ALTER TABLE [dbo].[GeneralConfig] ADD [firmaApiHeaders] NVARCHAR(MAX) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'firmaApiBody' AND Object_ID = Object_ID(N'[dbo].[GeneralConfig]'))
    ALTER TABLE [dbo].[GeneralConfig] ADD [firmaApiBody] NVARCHAR(MAX) NULL;
