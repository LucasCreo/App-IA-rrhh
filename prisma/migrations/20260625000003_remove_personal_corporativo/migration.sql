-- Remove PERSONAL and CORPORATIVO default event types
DELETE FROM [TipoEvento] WHERE [nombre] IN ('PERSONAL', 'CORPORATIVO');
