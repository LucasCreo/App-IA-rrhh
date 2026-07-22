-- Eliminar el TipoEvento AUSENCIA: las ausencias del calendario ahora se muestran
-- automáticamente como virtuales desde SolicitudAusencia (módulo Ausencias).
-- Previamente se limpian los eventos reales que tuvieran ese tipo (huérfanos).
DELETE FROM [dbo].[Evento] WHERE [tipo] = 'AUSENCIA';
DELETE FROM [dbo].[TipoEvento] WHERE [nombre] = 'AUSENCIA';
