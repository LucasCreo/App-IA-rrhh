ALTER TABLE [dbo].[TipoSolicitud] ADD [requiereAprobacion] BIT NOT NULL DEFAULT 1;
ALTER TABLE [dbo].[TipoSolicitud] ADD [campos] NVARCHAR(MAX) NOT NULL DEFAULT '[]';
ALTER TABLE [dbo].[SolicitudDocumento] ALTER COLUMN [nombreArchivo] NVARCHAR(MAX) NULL;
ALTER TABLE [dbo].[SolicitudDocumento] ADD [metadata] NVARCHAR(MAX) NOT NULL DEFAULT '{}';
