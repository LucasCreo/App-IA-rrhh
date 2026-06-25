-- Add subtipo to Evento
ALTER TABLE [Evento] ADD [subtipo] NVARCHAR(200) NULL;

-- Add protected AUSENCIA TipoEvento
IF NOT EXISTS (SELECT 1 FROM [TipoEvento] WHERE [nombre] = 'AUSENCIA')
  INSERT INTO [TipoEvento] ([nombre], [color], [permiteAdmin], [permiteEmpleado], [protegido], [createdAt])
  VALUES ('AUSENCIA', '#f97316', 1, 0, 1, GETDATE());
