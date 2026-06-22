IF NOT EXISTS (SELECT 1 FROM [TipoDocumento] WHERE [nombre] = 'Recibo de Sueldo')
  INSERT INTO [TipoDocumento] ([nombre], [accion], [tienePeriodo], [protegido], [createdAt])
  VALUES ('Recibo de Sueldo', 'FIRMA', 1, 1, GETDATE())
ELSE
  UPDATE [TipoDocumento] SET [protegido] = 1 WHERE [nombre] = 'Recibo de Sueldo'
