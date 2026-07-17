-- Backfill: recibos que están dentro de un lote pero sin tipoDocumentoId → setear al TipoDocumento "Recibo de Sueldo"
DECLARE @reciboId INT;
SELECT @reciboId = id FROM [dbo].[TipoDocumento] WHERE nombre = 'Recibo de Sueldo';

IF @reciboId IS NOT NULL
  UPDATE [dbo].[Document]
  SET tipoDocumentoId = @reciboId
  WHERE loteId IS NOT NULL AND tipoDocumentoId IS NULL;
