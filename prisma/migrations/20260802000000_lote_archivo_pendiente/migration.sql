IF OBJECT_ID('[dbo].[LoteArchivoPendiente]', 'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[LoteArchivoPendiente] (
        [id]              INT IDENTITY(1,1) NOT NULL,
        [loteId]          INT NOT NULL,
        [filePath]        NVARCHAR(1000) NOT NULL,
        [nombreArchivo]   NVARCHAR(500) NOT NULL,
        [legajoDetectado] NVARCHAR(100) NULL,
        [detectando]      BIT NOT NULL CONSTRAINT [LoteArchivoPendiente_detectando_df] DEFAULT 0,
        [uploadedAt]      DATETIME2 NOT NULL CONSTRAINT [LoteArchivoPendiente_uploadedAt_df] DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT [LoteArchivoPendiente_pkey] PRIMARY KEY CLUSTERED ([id])
    );

    ALTER TABLE [dbo].[LoteArchivoPendiente]
    ADD CONSTRAINT [LoteArchivoPendiente_loteId_fkey]
    FOREIGN KEY ([loteId]) REFERENCES [dbo].[Lote]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

    CREATE INDEX [LoteArchivoPendiente_loteId_idx] ON [dbo].[LoteArchivoPendiente] ([loteId]);
END
