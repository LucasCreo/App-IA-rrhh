IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE Name = N'reciboFilenamePatterns'
      AND Object_ID = Object_ID(N'[dbo].[GeneralConfig]')
)
    ALTER TABLE [dbo].[GeneralConfig] ADD [reciboFilenamePatterns] NVARCHAR(MAX) NULL;
