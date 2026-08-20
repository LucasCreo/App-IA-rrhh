/*
  Agrega Area (tabla nueva), Employee.areaId (obligatoria, FK) + Employee.puesto,
  y Post.areaId (opcional, FK). Backfilla empleados existentes al área 'General'.
  Idempotente.
*/
BEGIN TRY
BEGIN TRAN;

-- ── Tabla Area ───────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE object_id = OBJECT_ID(N'[dbo].[Area]'))
BEGIN
    CREATE TABLE [dbo].[Area] (
        [id]     INT           NOT NULL IDENTITY(1,1),
        [nombre] NVARCHAR(1000) NOT NULL,
        CONSTRAINT [Area_pkey] PRIMARY KEY CLUSTERED ([id]),
        CONSTRAINT [Area_nombre_key] UNIQUE NONCLUSTERED ([nombre])
    );
END;

-- Seed área 'General' (para backfill de empleados existentes)
IF NOT EXISTS (SELECT 1 FROM [dbo].[Area] WHERE [nombre] = N'General')
BEGIN
    INSERT INTO [dbo].[Area] ([nombre]) VALUES (N'General');
END;

DECLARE @generalAreaId INT = (SELECT TOP 1 [id] FROM [dbo].[Area] WHERE [nombre] = N'General');

-- ── Employee.areaId ─────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Employee]') AND name = N'areaId')
BEGIN
    -- 1) Agregar como NULL para poder backfillear
    ALTER TABLE [dbo].[Employee] ADD [areaId] INT NULL;
END;

-- Backfill: cualquier empleado sin área → General
EXEC('UPDATE [dbo].[Employee] SET [areaId] = ' + @generalAreaId + ' WHERE [areaId] IS NULL');

-- 2) Volverla NOT NULL
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[Employee]') AND name = N'areaId' AND is_nullable = 1
)
BEGIN
    ALTER TABLE [dbo].[Employee] ALTER COLUMN [areaId] INT NOT NULL;
END;

-- 3) FK
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'Employee_areaId_fkey')
BEGIN
    ALTER TABLE [dbo].[Employee] ADD CONSTRAINT [Employee_areaId_fkey]
        FOREIGN KEY ([areaId]) REFERENCES [dbo].[Area]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;
END;

-- ── Employee.puesto ─────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Employee]') AND name = N'puesto')
BEGIN
    ALTER TABLE [dbo].[Employee] ADD [puesto] NVARCHAR(1000) NULL;
END;

-- ── Post.areaId ─────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Post]') AND name = N'areaId')
BEGIN
    ALTER TABLE [dbo].[Post] ADD [areaId] INT NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'Post_areaId_fkey')
BEGIN
    ALTER TABLE [dbo].[Post] ADD CONSTRAINT [Post_areaId_fkey]
        FOREIGN KEY ([areaId]) REFERENCES [dbo].[Area]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH;
