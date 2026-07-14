CREATE TABLE [dbo].[Post] (
    [id]          INT             IDENTITY(1,1) NOT NULL,
    [autorId]     INT             NOT NULL,
    [contenido]   NVARCHAR(MAX)   NOT NULL,
    [imagenUrl]   NVARCHAR(1000)  NULL,
    [alcance]     NVARCHAR(20)    NOT NULL CONSTRAINT [Post_alcance_df] DEFAULT 'GLOBAL',
    [categoriaId] INT             NULL,
    [createdAt]   DATETIME2       NOT NULL CONSTRAINT [Post_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt]   DATETIME2       NOT NULL,
    CONSTRAINT [Post_pkey] PRIMARY KEY CLUSTERED ([id])
);

ALTER TABLE [dbo].[Post]
  ADD CONSTRAINT [Post_autorId_fkey] FOREIGN KEY ([autorId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Post]
  ADD CONSTRAINT [Post_categoriaId_fkey] FOREIGN KEY ([categoriaId]) REFERENCES [dbo].[Category]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE INDEX [Post_autorId_idx] ON [dbo].[Post]([autorId]);
CREATE INDEX [Post_categoriaId_idx] ON [dbo].[Post]([categoriaId]);
CREATE INDEX [Post_createdAt_idx] ON [dbo].[Post]([createdAt]);


CREATE TABLE [dbo].[PostReaction] (
    [postId]    INT           NOT NULL,
    [userId]    INT           NOT NULL,
    [tipo]      NVARCHAR(20)  NOT NULL CONSTRAINT [PostReaction_tipo_df] DEFAULT 'LIKE',
    [createdAt] DATETIME2     NOT NULL CONSTRAINT [PostReaction_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PostReaction_pkey] PRIMARY KEY CLUSTERED ([postId], [userId])
);

ALTER TABLE [dbo].[PostReaction]
  ADD CONSTRAINT [PostReaction_postId_fkey] FOREIGN KEY ([postId]) REFERENCES [dbo].[Post]([id]) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE [dbo].[PostReaction]
  ADD CONSTRAINT [PostReaction_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;


CREATE TABLE [dbo].[PostComment] (
    [id]        INT             IDENTITY(1,1) NOT NULL,
    [postId]    INT             NOT NULL,
    [autorId]   INT             NOT NULL,
    [contenido] NVARCHAR(MAX)   NOT NULL,
    [createdAt] DATETIME2       NOT NULL CONSTRAINT [PostComment_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PostComment_pkey] PRIMARY KEY CLUSTERED ([id])
);

ALTER TABLE [dbo].[PostComment]
  ADD CONSTRAINT [PostComment_postId_fkey] FOREIGN KEY ([postId]) REFERENCES [dbo].[Post]([id]) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE [dbo].[PostComment]
  ADD CONSTRAINT [PostComment_autorId_fkey] FOREIGN KEY ([autorId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE INDEX [PostComment_postId_idx] ON [dbo].[PostComment]([postId]);
