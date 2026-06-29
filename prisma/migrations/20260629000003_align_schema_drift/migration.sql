BEGIN TRY

BEGIN TRAN;

-- DropForeignKey
ALTER TABLE [dbo].[EventoEmpleado] DROP CONSTRAINT [EventoEmpleado_eventoId_fkey];

-- DropIndex
DROP INDEX [Evento_googleEventId_key] ON [dbo].[Evento];

-- DropIndex
DROP INDEX [TipoEvento_nombre_key] ON [dbo].[TipoEvento];

-- AlterTable AsignacionFormulario
DECLARE @c1 NVARCHAR(200) = (SELECT dc.name FROM sys.default_constraints dc JOIN sys.columns c ON c.default_object_id = dc.object_id WHERE dc.parent_object_id = OBJECT_ID('dbo.AsignacionFormulario') AND c.name = 'datosAdmin');
IF @c1 IS NOT NULL EXEC('ALTER TABLE [dbo].[AsignacionFormulario] DROP CONSTRAINT [' + @c1 + ']');
ALTER TABLE [dbo].[AsignacionFormulario] ADD CONSTRAINT [AsignacionFormulario_datosAdmin_df] DEFAULT '{}' FOR [datosAdmin];

-- AlterTable campos_personalizados
DECLARE @c2 NVARCHAR(200);
SELECT @c2 = dc.name FROM sys.default_constraints dc JOIN sys.columns c ON c.default_object_id = dc.object_id WHERE dc.parent_object_id = OBJECT_ID('dbo.campos_personalizados') AND c.name = 'orden';
IF @c2 IS NOT NULL EXEC('ALTER TABLE [dbo].[campos_personalizados] DROP CONSTRAINT [' + @c2 + ']');
SELECT @c2 = dc.name FROM sys.default_constraints dc JOIN sys.columns c ON c.default_object_id = dc.object_id WHERE dc.parent_object_id = OBJECT_ID('dbo.campos_personalizados') AND c.name = 'requerido';
IF @c2 IS NOT NULL EXEC('ALTER TABLE [dbo].[campos_personalizados] DROP CONSTRAINT [' + @c2 + ']');
SELECT @c2 = dc.name FROM sys.default_constraints dc JOIN sys.columns c ON c.default_object_id = dc.object_id WHERE dc.parent_object_id = OBJECT_ID('dbo.campos_personalizados') AND c.name = 'visible';
IF @c2 IS NOT NULL EXEC('ALTER TABLE [dbo].[campos_personalizados] DROP CONSTRAINT [' + @c2 + ']');
SELECT @c2 = dc.name FROM sys.default_constraints dc JOIN sys.columns c ON c.default_object_id = dc.object_id WHERE dc.parent_object_id = OBJECT_ID('dbo.campos_personalizados') AND c.name = 'tipo';
IF @c2 IS NOT NULL EXEC('ALTER TABLE [dbo].[campos_personalizados] DROP CONSTRAINT [' + @c2 + ']');
ALTER TABLE [dbo].[campos_personalizados] ADD CONSTRAINT [campos_personalizados_orden_df] DEFAULT 0 FOR [orden], CONSTRAINT [campos_personalizados_requerido_df] DEFAULT 0 FOR [requerido], CONSTRAINT [campos_personalizados_tipo_df] DEFAULT 'texto' FOR [tipo], CONSTRAINT [campos_personalizados_visible_df] DEFAULT 1 FOR [visible];

-- AlterTable Evaluacion
DECLARE @c3 NVARCHAR(200);
SELECT @c3 = dc.name FROM sys.default_constraints dc JOIN sys.columns c ON c.default_object_id = dc.object_id WHERE dc.parent_object_id = OBJECT_ID('dbo.Evaluacion') AND c.name = 'completada';
IF @c3 IS NOT NULL EXEC('ALTER TABLE [dbo].[Evaluacion] DROP CONSTRAINT [' + @c3 + ']');
SELECT @c3 = dc.name FROM sys.default_constraints dc JOIN sys.columns c ON c.default_object_id = dc.object_id WHERE dc.parent_object_id = OBJECT_ID('dbo.Evaluacion') AND c.name = 'resultados';
IF @c3 IS NOT NULL EXEC('ALTER TABLE [dbo].[Evaluacion] DROP CONSTRAINT [' + @c3 + ']');
ALTER TABLE [dbo].[Evaluacion] ADD CONSTRAINT [Evaluacion_completada_df] DEFAULT 0 FOR [completada], CONSTRAINT [Evaluacion_resultados_df] DEFAULT '{}' FOR [resultados];

-- AlterTable Evento.subtipo -> nullable
ALTER TABLE [dbo].[Evento] ALTER COLUMN [subtipo] NVARCHAR(1000) NULL;

-- AlterTable GeneralConfig drop primaryColor
IF COL_LENGTH('dbo.GeneralConfig', 'primaryColor') IS NOT NULL
BEGIN
    DECLARE @c4 NVARCHAR(200) = (SELECT dc.name FROM sys.default_constraints dc JOIN sys.columns c ON c.default_object_id = dc.object_id WHERE dc.parent_object_id = OBJECT_ID('dbo.GeneralConfig') AND c.name = 'primaryColor');
    IF @c4 IS NOT NULL EXEC('ALTER TABLE [dbo].[GeneralConfig] DROP CONSTRAINT [' + @c4 + ']');
    ALTER TABLE [dbo].[GeneralConfig] DROP COLUMN [primaryColor];
END

-- AlterTable PlantillaEvaluacion
DECLARE @c5 NVARCHAR(200) = (SELECT dc.name FROM sys.default_constraints dc JOIN sys.columns c ON c.default_object_id = dc.object_id WHERE dc.parent_object_id = OBJECT_ID('dbo.PlantillaEvaluacion') AND c.name = 'activo');
IF @c5 IS NOT NULL EXEC('ALTER TABLE [dbo].[PlantillaEvaluacion] DROP CONSTRAINT [' + @c5 + ']');
ALTER TABLE [dbo].[PlantillaEvaluacion] ADD CONSTRAINT [PlantillaEvaluacion_activo_df] DEFAULT 1 FOR [activo];

-- AlterTable PlantillaFormulario drop campos JSON, fix activo default
DECLARE @c6 NVARCHAR(200) = (SELECT dc.name FROM sys.default_constraints dc JOIN sys.columns c ON c.default_object_id = dc.object_id WHERE dc.parent_object_id = OBJECT_ID('dbo.PlantillaFormulario') AND c.name = 'activo');
IF @c6 IS NOT NULL EXEC('ALTER TABLE [dbo].[PlantillaFormulario] DROP CONSTRAINT [' + @c6 + ']');
IF COL_LENGTH('dbo.PlantillaFormulario', 'campos') IS NOT NULL
BEGIN
    DECLARE @c6b NVARCHAR(200) = (SELECT dc.name FROM sys.default_constraints dc JOIN sys.columns c ON c.default_object_id = dc.object_id WHERE dc.parent_object_id = OBJECT_ID('dbo.PlantillaFormulario') AND c.name = 'campos');
    IF @c6b IS NOT NULL EXEC('ALTER TABLE [dbo].[PlantillaFormulario] DROP CONSTRAINT [' + @c6b + ']');
    ALTER TABLE [dbo].[PlantillaFormulario] DROP COLUMN [campos];
END
ALTER TABLE [dbo].[PlantillaFormulario] ADD CONSTRAINT [PlantillaFormulario_activo_df] DEFAULT 1 FOR [activo];

-- AlterTable RespuestaFormulario
DECLARE @c7 NVARCHAR(200);
SELECT @c7 = dc.name FROM sys.default_constraints dc JOIN sys.columns c ON c.default_object_id = dc.object_id WHERE dc.parent_object_id = OBJECT_ID('dbo.RespuestaFormulario') AND c.name = 'datos';
IF @c7 IS NOT NULL EXEC('ALTER TABLE [dbo].[RespuestaFormulario] DROP CONSTRAINT [' + @c7 + ']');
SELECT @c7 = dc.name FROM sys.default_constraints dc JOIN sys.columns c ON c.default_object_id = dc.object_id WHERE dc.parent_object_id = OBJECT_ID('dbo.RespuestaFormulario') AND c.name = 'estado';
IF @c7 IS NOT NULL EXEC('ALTER TABLE [dbo].[RespuestaFormulario] DROP CONSTRAINT [' + @c7 + ']');
ALTER TABLE [dbo].[RespuestaFormulario] ADD CONSTRAINT [RespuestaFormulario_datos_df] DEFAULT '{}' FOR [datos], CONSTRAINT [RespuestaFormulario_estado_df] DEFAULT 'PENDIENTE' FOR [estado];

-- AlterTable RondaEvaluacion
DECLARE @c8 NVARCHAR(200) = (SELECT dc.name FROM sys.default_constraints dc JOIN sys.columns c ON c.default_object_id = dc.object_id WHERE dc.parent_object_id = OBJECT_ID('dbo.RondaEvaluacion') AND c.name = 'estado');
IF @c8 IS NOT NULL EXEC('ALTER TABLE [dbo].[RondaEvaluacion] DROP CONSTRAINT [' + @c8 + ']');
ALTER TABLE [dbo].[RondaEvaluacion] ADD CONSTRAINT [RondaEvaluacion_estado_df] DEFAULT 'ACTIVA' FOR [estado];

-- AlterTable SolicitudDocumento
DECLARE @c9 NVARCHAR(200);
SELECT @c9 = dc.name FROM sys.default_constraints dc JOIN sys.columns c ON c.default_object_id = dc.object_id WHERE dc.parent_object_id = OBJECT_ID('dbo.SolicitudDocumento') AND c.name = 'comentarioVisible';
IF @c9 IS NOT NULL EXEC('ALTER TABLE [dbo].[SolicitudDocumento] DROP CONSTRAINT [' + @c9 + ']');
SELECT @c9 = dc.name FROM sys.default_constraints dc JOIN sys.columns c ON c.default_object_id = dc.object_id WHERE dc.parent_object_id = OBJECT_ID('dbo.SolicitudDocumento') AND c.name = 'estado';
IF @c9 IS NOT NULL EXEC('ALTER TABLE [dbo].[SolicitudDocumento] DROP CONSTRAINT [' + @c9 + ']');
SELECT @c9 = dc.name FROM sys.default_constraints dc JOIN sys.columns c ON c.default_object_id = dc.object_id WHERE dc.parent_object_id = OBJECT_ID('dbo.SolicitudDocumento') AND c.name = 'metadata';
IF @c9 IS NOT NULL EXEC('ALTER TABLE [dbo].[SolicitudDocumento] DROP CONSTRAINT [' + @c9 + ']');
ALTER TABLE [dbo].[SolicitudDocumento] ADD CONSTRAINT [SolicitudDocumento_comentarioVisible_df] DEFAULT 0 FOR [comentarioVisible], CONSTRAINT [SolicitudDocumento_estado_df] DEFAULT 'PENDIENTE' FOR [estado], CONSTRAINT [SolicitudDocumento_metadata_df] DEFAULT '{}' FOR [metadata];

-- AlterTable SolicitudModificacion
DECLARE @c10 NVARCHAR(200) = (SELECT dc.name FROM sys.default_constraints dc JOIN sys.columns c ON c.default_object_id = dc.object_id WHERE dc.parent_object_id = OBJECT_ID('dbo.SolicitudModificacion') AND c.name = 'estado');
IF @c10 IS NOT NULL EXEC('ALTER TABLE [dbo].[SolicitudModificacion] DROP CONSTRAINT [' + @c10 + ']');
ALTER TABLE [dbo].[SolicitudModificacion] ALTER COLUMN [comentario] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[SolicitudModificacion] ADD CONSTRAINT [SolicitudModificacion_estado_df] DEFAULT 'PENDIENTE' FOR [estado];

-- AlterTable TipoDocumento
DECLARE @c11 NVARCHAR(200);
SELECT @c11 = dc.name FROM sys.default_constraints dc JOIN sys.columns c ON c.default_object_id = dc.object_id WHERE dc.parent_object_id = OBJECT_ID('dbo.TipoDocumento') AND c.name = 'accion';
IF @c11 IS NOT NULL EXEC('ALTER TABLE [dbo].[TipoDocumento] DROP CONSTRAINT [' + @c11 + ']');
SELECT @c11 = dc.name FROM sys.default_constraints dc JOIN sys.columns c ON c.default_object_id = dc.object_id WHERE dc.parent_object_id = OBJECT_ID('dbo.TipoDocumento') AND c.name = 'protegido';
IF @c11 IS NOT NULL EXEC('ALTER TABLE [dbo].[TipoDocumento] DROP CONSTRAINT [' + @c11 + ']');
ALTER TABLE [dbo].[TipoDocumento] ADD CONSTRAINT [TipoDocumento_accion_df] DEFAULT 'FIRMA' FOR [accion], CONSTRAINT [TipoDocumento_protegido_df] DEFAULT 0 FOR [protegido];

-- AlterTable TipoEvento NOT NULL
ALTER TABLE [dbo].[TipoEvento] ALTER COLUMN [nombre] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[TipoEvento] ALTER COLUMN [color] NVARCHAR(1000) NOT NULL;

-- AlterTable TipoSolicitud
DECLARE @c12 NVARCHAR(200);
SELECT @c12 = dc.name FROM sys.default_constraints dc JOIN sys.columns c ON c.default_object_id = dc.object_id WHERE dc.parent_object_id = OBJECT_ID('dbo.TipoSolicitud') AND c.name = 'activo';
IF @c12 IS NOT NULL EXEC('ALTER TABLE [dbo].[TipoSolicitud] DROP CONSTRAINT [' + @c12 + ']');
SELECT @c12 = dc.name FROM sys.default_constraints dc JOIN sys.columns c ON c.default_object_id = dc.object_id WHERE dc.parent_object_id = OBJECT_ID('dbo.TipoSolicitud') AND c.name = 'campos';
IF @c12 IS NOT NULL EXEC('ALTER TABLE [dbo].[TipoSolicitud] DROP CONSTRAINT [' + @c12 + ']');
SELECT @c12 = dc.name FROM sys.default_constraints dc JOIN sys.columns c ON c.default_object_id = dc.object_id WHERE dc.parent_object_id = OBJECT_ID('dbo.TipoSolicitud') AND c.name = 'requiereAprobacion';
IF @c12 IS NOT NULL EXEC('ALTER TABLE [dbo].[TipoSolicitud] DROP CONSTRAINT [' + @c12 + ']');
ALTER TABLE [dbo].[TipoSolicitud] ADD CONSTRAINT [TipoSolicitud_activo_df] DEFAULT 1 FOR [activo], CONSTRAINT [TipoSolicitud_campos_df] DEFAULT '[]' FOR [campos], CONSTRAINT [TipoSolicitud_requiereAprobacion_df] DEFAULT 1 FOR [requiereAprobacion];

-- CreateTable CampoFormulario
CREATE TABLE [dbo].[CampoFormulario] (
    [id] INT NOT NULL IDENTITY(1,1),
    [plantillaId] INT NOT NULL,
    [nombre] NVARCHAR(1000) NOT NULL,
    [label] NVARCHAR(1000) NOT NULL,
    [tipo] NVARCHAR(1000) NOT NULL,
    [opciones] NVARCHAR(1000),
    [requerido] BIT NOT NULL CONSTRAINT [CampoFormulario_requerido_df] DEFAULT 0,
    [rellena] NVARCHAR(1000) NOT NULL CONSTRAINT [CampoFormulario_rellena_df] DEFAULT 'empleado',
    [orden] INT NOT NULL CONSTRAINT [CampoFormulario_orden_df] DEFAULT 0,
    CONSTRAINT [CampoFormulario_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex TipoEvento_nombre_key
ALTER TABLE [dbo].[TipoEvento] ADD CONSTRAINT [TipoEvento_nombre_key] UNIQUE NONCLUSTERED ([nombre]);

-- AddForeignKey EventoEmpleado_eventoId_fkey con CASCADE
ALTER TABLE [dbo].[EventoEmpleado] ADD CONSTRAINT [EventoEmpleado_eventoId_fkey] FOREIGN KEY ([eventoId]) REFERENCES [dbo].[Evento]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey CampoFormulario_plantillaId_fkey
ALTER TABLE [dbo].[CampoFormulario] ADD CONSTRAINT [CampoFormulario_plantillaId_fkey] FOREIGN KEY ([plantillaId]) REFERENCES [dbo].[PlantillaFormulario]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
