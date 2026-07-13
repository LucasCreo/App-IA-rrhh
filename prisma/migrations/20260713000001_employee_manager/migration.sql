ALTER TABLE [dbo].[Employee] ADD [managerId] INT NULL;

ALTER TABLE [dbo].[Employee]
  ADD CONSTRAINT [Employee_managerId_fkey]
  FOREIGN KEY ([managerId]) REFERENCES [dbo].[Employee]([id])
  ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE INDEX [Employee_managerId_idx] ON [dbo].[Employee]([managerId]);
