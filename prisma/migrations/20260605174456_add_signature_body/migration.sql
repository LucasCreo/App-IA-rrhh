-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SignatureConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "providerUrl" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "extraHeaders" TEXT NOT NULL DEFAULT '{}',
    "extraBody" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_SignatureConfig" ("apiKey", "extraHeaders", "id", "providerUrl", "updatedAt") SELECT "apiKey", "extraHeaders", "id", "providerUrl", "updatedAt" FROM "SignatureConfig";
DROP TABLE "SignatureConfig";
ALTER TABLE "new_SignatureConfig" RENAME TO "SignatureConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
