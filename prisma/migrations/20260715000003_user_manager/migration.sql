-- Nueva columna en User (self-relation)
ALTER TABLE [dbo].[User] ADD [managerUserId] INT NULL;

ALTER TABLE [dbo].[User] ADD CONSTRAINT [FK_User_managerUser]
  FOREIGN KEY ([managerUserId]) REFERENCES [dbo].[User]([id]);

CREATE INDEX [IX_User_managerUserId] ON [dbo].[User]([managerUserId]);

-- Drop FK y columna managerId de Employee (organigrama pasa a ser por User)
DECLARE @fkName sysname;
SELECT @fkName = fk.name
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
JOIN sys.columns c ON fkc.parent_object_id = c.object_id AND fkc.parent_column_id = c.column_id
WHERE fk.parent_object_id = OBJECT_ID('dbo.Employee') AND c.name = 'managerId';

IF @fkName IS NOT NULL
  EXEC('ALTER TABLE [dbo].[Employee] DROP CONSTRAINT [' + @fkName + ']');

DECLARE @ixName sysname;
SELECT @ixName = i.name
FROM sys.indexes i
JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
WHERE i.object_id = OBJECT_ID('dbo.Employee') AND c.name = 'managerId' AND i.is_primary_key = 0 AND i.is_unique_constraint = 0;

IF @ixName IS NOT NULL
  EXEC('DROP INDEX [' + @ixName + '] ON [dbo].[Employee]');

IF COL_LENGTH('dbo.Employee', 'managerId') IS NOT NULL
  ALTER TABLE [dbo].[Employee] DROP COLUMN [managerId];
