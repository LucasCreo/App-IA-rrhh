CREATE TABLE [dbo].[EmailTemplate] (
    [key] NVARCHAR(450) NOT NULL,
    [subject] NVARCHAR(500) NOT NULL,
    [title] NVARCHAR(500) NOT NULL,
    [bodyHtml] NVARCHAR(MAX) NOT NULL,
    [ctaLabel] NVARCHAR(200) NULL,
    [enabled] BIT NOT NULL CONSTRAINT [DF_EmailTemplate_enabled] DEFAULT 1,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PK_EmailTemplate] PRIMARY KEY CLUSTERED ([key])
);
