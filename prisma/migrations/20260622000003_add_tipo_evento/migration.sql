CREATE TABLE [TipoEvento] (
  [id] INT NOT NULL IDENTITY(1,1),
  [nombre] NVARCHAR(255) NOT NULL,
  [color] NVARCHAR(50) NOT NULL CONSTRAINT [TipoEvento_color_df] DEFAULT '#6b7280',
  [permiteAdmin] BIT NOT NULL CONSTRAINT [TipoEvento_permiteAdmin_df] DEFAULT 1,
  [permiteEmpleado] BIT NOT NULL CONSTRAINT [TipoEvento_permiteEmpleado_df] DEFAULT 0,
  [protegido] BIT NOT NULL CONSTRAINT [TipoEvento_protegido_df] DEFAULT 0,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [TipoEvento_createdAt_df] DEFAULT GETDATE(),
  CONSTRAINT [TipoEvento_pkey] PRIMARY KEY ([id])
);

CREATE UNIQUE INDEX [TipoEvento_nombre_key] ON [TipoEvento]([nombre]);

INSERT INTO [TipoEvento] ([nombre], [color], [permiteAdmin], [permiteEmpleado], [protegido])
VALUES
  ('PERSONAL', '#3b82f6', 1, 1, 1),
  ('CORPORATIVO', '#16a34a', 1, 0, 1);

ALTER TABLE [Evento] ADD [comentarioAdmin] NVARCHAR(MAX) NULL;
