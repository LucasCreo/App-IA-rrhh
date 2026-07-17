CREATE TABLE [dbo].[LoteEmpleado] (
  [loteId]     INT NOT NULL,
  [employeeId] INT NOT NULL,
  CONSTRAINT [PK_LoteEmpleado] PRIMARY KEY ([loteId], [employeeId]),
  CONSTRAINT [FK_LoteEmpleado_Lote]     FOREIGN KEY ([loteId])     REFERENCES [dbo].[Lote]([id])     ON DELETE CASCADE,
  CONSTRAINT [FK_LoteEmpleado_Employee] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id])
);

CREATE INDEX [IX_LoteEmpleado_employeeId] ON [dbo].[LoteEmpleado]([employeeId]);
