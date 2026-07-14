CREATE TABLE [dbo].[PlantillaRecibo] (
    [id]            INT             IDENTITY(1,1) NOT NULL,
    [nombre]        NVARCHAR(1000)  NOT NULL,
    [huella]        NVARCHAR(MAX)   NOT NULL,
    [nombreArchivo] NVARCHAR(1000)  NOT NULL,
    [activa]        BIT             NOT NULL CONSTRAINT [PlantillaRecibo_activa_df] DEFAULT 1,
    [createdAt]     DATETIME2       NOT NULL CONSTRAINT [PlantillaRecibo_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PlantillaRecibo_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE UNIQUE INDEX [PlantillaRecibo_nombre_key] ON [dbo].[PlantillaRecibo]([nombre]);
