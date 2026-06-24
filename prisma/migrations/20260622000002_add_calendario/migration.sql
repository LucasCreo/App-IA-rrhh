CREATE TABLE [Evento] (
  [id] INT NOT NULL IDENTITY(1,1),
  [titulo] NVARCHAR(1000) NOT NULL,
  [descripcion] NVARCHAR(1000),
  [fechaInicio] DATETIME2 NOT NULL,
  [fechaFin] DATETIME2,
  [todoElDia] BIT NOT NULL CONSTRAINT [Evento_todoElDia_df] DEFAULT 1,
  [tipo] NVARCHAR(1000) NOT NULL CONSTRAINT [Evento_tipo_df] DEFAULT 'PERSONAL',
  [creadoPorId] INT NOT NULL,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [Evento_createdAt_df] DEFAULT GETDATE(),
  CONSTRAINT [Evento_pkey] PRIMARY KEY ([id])
);

CREATE TABLE [EventoEmpleado] (
  [eventoId] INT NOT NULL,
  [employeeId] INT NOT NULL,
  CONSTRAINT [EventoEmpleado_pkey] PRIMARY KEY ([eventoId], [employeeId])
);

ALTER TABLE [Evento] ADD CONSTRAINT [Evento_creadoPorId_fkey]
  FOREIGN KEY ([creadoPorId]) REFERENCES [User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [EventoEmpleado] ADD CONSTRAINT [EventoEmpleado_eventoId_fkey]
  FOREIGN KEY ([eventoId]) REFERENCES [Evento]([id]) ON DELETE CASCADE;

ALTER TABLE [EventoEmpleado] ADD CONSTRAINT [EventoEmpleado_employeeId_fkey]
  FOREIGN KEY ([employeeId]) REFERENCES [Employee]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
