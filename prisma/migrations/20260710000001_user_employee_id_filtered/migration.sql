-- Buscar el nombre de la constraint UNIQUE que usa el índice y dropearlo
DECLARE @cName NVARCHAR(200);
SELECT @cName = kc.name
FROM sys.key_constraints kc
JOIN sys.indexes i ON i.object_id = kc.parent_object_id AND i.index_id = kc.unique_index_id
WHERE kc.parent_object_id = OBJECT_ID('dbo.User')
  AND i.name = 'User_employeeId_key';

IF @cName IS NOT NULL EXEC('ALTER TABLE [dbo].[User] DROP CONSTRAINT [' + @cName + ']');

IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.User') AND name = 'User_employeeId_key')
    DROP INDEX [User_employeeId_key] ON [dbo].[User];

CREATE UNIQUE INDEX [User_employeeId_key] ON [dbo].[User]([employeeId]) WHERE [employeeId] IS NOT NULL;
