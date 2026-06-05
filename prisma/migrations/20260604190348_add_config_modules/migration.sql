-- CreateTable
CREATE TABLE "TipoDocumento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "GeneralConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "appName" TEXT NOT NULL DEFAULT 'RRHH',
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#166534',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EmployeeFieldConfig" (
    "campo" TEXT NOT NULL PRIMARY KEY,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "requerido" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Document" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombreArchivo" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "fechaCarga" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cargadoPorId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "tipoDocumentoId" INTEGER,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "firmaExternalId" TEXT,
    "fechaFirma" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Document_cargadoPorId_fkey" FOREIGN KEY ("cargadoPorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Document_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Document_tipoDocumentoId_fkey" FOREIGN KEY ("tipoDocumentoId") REFERENCES "TipoDocumento" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Document" ("cargadoPorId", "employeeId", "estado", "fechaCarga", "fechaFirma", "filePath", "firmaExternalId", "id", "nombreArchivo", "periodo", "updatedAt") SELECT "cargadoPorId", "employeeId", "estado", "fechaCarga", "fechaFirma", "filePath", "firmaExternalId", "id", "nombreArchivo", "periodo", "updatedAt" FROM "Document";
DROP TABLE "Document";
ALTER TABLE "new_Document" RENAME TO "Document";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "TipoDocumento_nombre_key" ON "TipoDocumento"("nombre");
