IF NOT EXISTS (SELECT 1 FROM [TipoEvento] WHERE [nombre] = 'FERIADO')
  INSERT INTO [TipoEvento] ([nombre], [color], [permiteAdmin], [permiteEmpleado], [protegido])
  VALUES ('FERIADO', '#dc2626', 1, 0, 1);
