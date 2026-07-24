ALTER TABLE [dbo].[TipoAusencia] ADD [protegido] BIT NOT NULL CONSTRAINT [TipoAusencia_protegido_df] DEFAULT 0;

-- EXEC fuerza compilación diferida: la columna ya existe al ejecutarse
EXEC('UPDATE [dbo].[TipoAusencia] SET [protegido] = 1 WHERE [afectaSaldo] = 1');
