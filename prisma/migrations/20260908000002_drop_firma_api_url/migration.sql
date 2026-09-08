-- Unificamos URL base + endpoint en una sola: usamos firmaEndpoint como URL completa.
-- Si algún tipo ya tenía firmaApiUrl y firmaEndpoint separados, los concatenamos.
IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'firmaApiUrl' AND Object_ID = Object_ID(N'[dbo].[TipoDocumento]'))
BEGIN
    EXEC('
        UPDATE [dbo].[TipoDocumento]
        SET firmaEndpoint =
            CASE
                WHEN firmaEndpoint IS NULL OR firmaEndpoint = '''' THEN firmaApiUrl
                WHEN firmaEndpoint LIKE ''http%''                    THEN firmaEndpoint
                WHEN firmaApiUrl IS NULL OR firmaApiUrl = ''''       THEN firmaEndpoint
                ELSE
                    CASE WHEN RIGHT(firmaApiUrl, 1) = ''/'' THEN LEFT(firmaApiUrl, LEN(firmaApiUrl) - 1) ELSE firmaApiUrl END
                    +
                    CASE WHEN LEFT(firmaEndpoint, 1) = ''/'' THEN firmaEndpoint ELSE ''/'' + firmaEndpoint END
            END
        WHERE firmaApiUrl IS NOT NULL OR firmaEndpoint IS NOT NULL;
    ');
    ALTER TABLE [dbo].[TipoDocumento] DROP COLUMN [firmaApiUrl];
END;
