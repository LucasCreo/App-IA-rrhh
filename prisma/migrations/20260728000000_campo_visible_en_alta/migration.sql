ALTER TABLE [dbo].[EmployeeFieldConfig] ADD [visibleEnAlta] BIT NOT NULL CONSTRAINT [DF_EmployeeFieldConfig_visibleEnAlta] DEFAULT 1;

ALTER TABLE [dbo].[campos_personalizados] ADD [visibleEnAlta] BIT NOT NULL CONSTRAINT [DF_campos_personalizados_visibleEnAlta] DEFAULT 1;
