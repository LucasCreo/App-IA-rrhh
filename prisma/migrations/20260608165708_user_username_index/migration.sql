CREATE UNIQUE INDEX [User_username_key] ON [dbo].[User]([username]) WHERE [username] IS NOT NULL;
