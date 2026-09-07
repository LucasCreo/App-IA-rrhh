IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'firmaEnabled' AND Object_ID = Object_ID(N'[dbo].[GeneralConfig]'))
    ALTER TABLE [dbo].[GeneralConfig] ADD [firmaEnabled] BIT NOT NULL CONSTRAINT [DF_GeneralConfig_firmaEnabled] DEFAULT 0;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'firmaProveedor' AND Object_ID = Object_ID(N'[dbo].[GeneralConfig]'))
    ALTER TABLE [dbo].[GeneralConfig] ADD [firmaProveedor] NVARCHAR(200) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'firmaApiUrl' AND Object_ID = Object_ID(N'[dbo].[GeneralConfig]'))
    ALTER TABLE [dbo].[GeneralConfig] ADD [firmaApiUrl] NVARCHAR(500) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'firmaApiKey' AND Object_ID = Object_ID(N'[dbo].[GeneralConfig]'))
    ALTER TABLE [dbo].[GeneralConfig] ADD [firmaApiKey] NVARCHAR(500) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'firmaApiSecret' AND Object_ID = Object_ID(N'[dbo].[GeneralConfig]'))
    ALTER TABLE [dbo].[GeneralConfig] ADD [firmaApiSecret] NVARCHAR(500) NULL;
