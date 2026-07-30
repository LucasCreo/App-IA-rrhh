ALTER TABLE [dbo].[Post] ADD [pinned] BIT NOT NULL CONSTRAINT [Post_pinned_df] DEFAULT 0;
ALTER TABLE [dbo].[Post] ADD [pinnedAt] DATETIME2;
