ALTER TABLE [dbo].[PostComment] ADD [parentCommentId] INT NULL;
ALTER TABLE [dbo].[PostComment] ADD CONSTRAINT [PostComment_parentCommentId_fkey]
    FOREIGN KEY ([parentCommentId]) REFERENCES [dbo].[PostComment]([id])
    ON DELETE NO ACTION ON UPDATE NO ACTION;
