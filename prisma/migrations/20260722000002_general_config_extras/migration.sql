ALTER TABLE [dbo].[GeneralConfig] ADD [editWindowMin] INT NOT NULL DEFAULT 1440;
ALTER TABLE [dbo].[GeneralConfig] ADD [firmaMinSec] INT NOT NULL DEFAULT 10;
ALTER TABLE [dbo].[GeneralConfig] ADD [soporteEmail] NVARCHAR(1000) NULL;
ALTER TABLE [dbo].[GeneralConfig] ADD [soporteTel] NVARCHAR(1000) NULL;
