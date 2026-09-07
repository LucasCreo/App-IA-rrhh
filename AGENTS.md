# Repository Guidelines

## Project Overview

Aplicación de Recursos Humanos para administradores y empleados. Gestiona personas, permisos, documentos y recibos, solicitudes/ausencias, portal interno, formularios/evaluaciones, calendario Google y auditoría. Los archivos se almacenan principalmente en Aditus; la ingesta SFTP y el procesamiento pesado usan una cola y un worker separado.

## Architecture & Data Flow

- **Framework:** Next.js 16 App Router con React 19. La UI está en `src/app` y los handlers HTTP en `src/app/api/**/route.ts`.
- `src/app/page.tsx` redirige a `/login`; `src/app/layout.tsx` instala tema y notificaciones. `src/app/admin/layout.tsx` y `src/app/empleado/layout.tsx` cargan usuario, permisos y contexto de empleado.
- **Autenticación:** `src/lib/auth.ts` emite JWT HS256 de 8 h en cookie `rrhh_token` (`httpOnly`, `sameSite=lax`). `src/proxy.ts` filtra rutas protegidas, pero los handlers deben volver a validar sesión, rol y permisos.
- **Autorización:** `requirePermiso` en `src/lib/permissions.ts` y el alcance jerárquico de `src/lib/scope.ts` son la autoridad. Un menú oculto nunca sustituye un check de API. El scope admite excepciones por propiedad del recurso: en `/api/lotes` el admin ve un lote si algún empleado cae en su rama **o** si `creadoPorId === user.userId`, y sobre un lote propio ve todos sus empleados/documentos aunque queden fuera de su scope. Al filtrar por scope, contemplar si el recurso tiene un dueño con ese mismo trato.
- **Flujo normal:** componentes feature-first mantienen estado local y llaman directamente a `/api` con JSON o `FormData`; el handler valida entrada y alcance, opera Prisma y devuelve JSON con estados HTTP explícitos.
- **Excepción — Server Components compartidos:** algunas vistas duplicadas entre admin y empleado se resuelven con un único Server Component `async` que consulta Prisma directo, y páginas wrapper que solo validan el token y le pasan `userId`/`employeeId`/`role`. Ver `src/components/perfil/PerfilContent.tsx` con `src/app/admin/perfil/page.tsx` y `src/app/empleado/perfil/page.tsx`. Preferir este patrón antes que mantener dos pantallas paralelas cliente+fetch.
- **Persistencia:** `src/lib/prisma.ts` expone el singleton Prisma; `prisma/schema.prisma` usa SQL Server. Las escrituras relacionadas suelen usar `$transaction`, y los efectos secundarios (email/Aditus) son best-effort.
- **Archivos:** `src/lib/fileValidation.ts` valida magic bytes y tamaño, no solo extensión/MIME. Las rutas de documentos suben a Aditus y guardan `aditusId`; ante fallo de DB intentan borrar el objeto remoto.
- **Procesamiento asíncrono:** `src/lib/jobQueue.ts`, `worker/index.ts` y `worker/jobRunner` gestionan jobs PENDING/DONE/FAIL, reintentos con backoff y reclaim de jobs stale. La ingesta SFTP usa handlers de lote y procesamiento de archivos.
- **Errores:** API suele responder `{ error, code?, field? }` con 400/401/403/404/409/500. En cliente, preferir `src/lib/apiErrors.ts` (`parseApiError`, `showApiError`, `handleApiError`) cuando el módulo ya lo usa.

## Key Directories

- `src/app/`: páginas, layouts y API Route Handlers.
- `src/components/`: componentes por feature (`empleados`, `documentos`, `lotes`, `solicitudes`, `portal`, `configuracion`, etc.); `ui/` contiene wrappers compartidos de Base UI/Tailwind.
- `src/lib/`: autenticación, permisos/alcance, Prisma, Aditus, validadores, email, contenido enriquecido y utilidades de dominio.
- `prisma/`: schema, seed y migraciones SQL Server.
- `worker/`: proceso de background y scripts de diagnóstico/encolado.
- `scripts/`: migraciones ad-hoc, mantenimiento, limpieza y pruebas manuales.
- `public/`: estáticos y algunos fallbacks de uploads locales.

## Development Commands

Usar npm con el lockfile existente:

```bash
npm ci
npm run dev                 # Next dev con límite de memoria configurado
npm run dev:fresh           # elimina .next y arranca dev
npm run dev:turbo           # Next dev con Turbopack
npm run build
npm start
npm run lint
npm test                    # vitest run
npm run test:watch
npm run db:seed             # no usar contra producción sin revisar el seed
npm run worker
npm run worker:enqueue-ping
```

Operaciones adicionales observadas:

```bash
npx prisma migrate deploy
npx prisma db seed
npx tsx worker/scripts/checkJobs.ts
node scripts/test-email.mjs [destinatario]
```

`migrate deploy` aplica migraciones versionadas, pero no reemplaza los scripts ad-hoc que CI ejecuta para campos SFTP/lote, `JobQueue` y rutas de errores (`scripts/migrate-lote-sftp-fields.ts`, `scripts/migrate-jobqueue-sftp-processed.ts`, `scripts/migrate-sftp-errors-path.ts`). Revisar siempre `prisma/migrations/` y el script correspondiente antes de cambiar el schema. Los scripts de limpieza son one-shot y destructivos; usar `--dry-run` cuando exista. `scripts/setup-roles-db.js` es legado: el modelo actual usa `User.role` y `UserPermiso`, no restaurar `rolId`/`Rol`/`RolPermiso`.

## Code Conventions & Common Patterns

- TypeScript estricto, alias `@/*` → `src/*`; conservar imports y estilo local. No existe un API client/ORM intermedio: los handlers importan Prisma directamente.
- Componentes y tipos públicos en `PascalCase`; funciones, variables y helpers en `camelCase`; los handlers viven en archivos `route.ts` según la ruta URL.
- Seguir el patrón feature-first: componentes cliente con `useState`/`useEffect`/`useMemo`, callbacks de refetch y preferencias puntuales en `localStorage`. No introducir un store global para una feature aislada.
- Agrupar llamadas independientes con `Promise.all`; usar `try/finally` para liberar estados de loading. Los emails no críticos pueden ser fire-and-forget solo con `.catch` que registre el error.
- Validar y autorizar en servidor antes de tocar DB o servicios externos. Usar `requirePermiso` y `getScopedEmployeeIds`; contemplar explícitamente 401, 403, 404, 409 y errores de validación.
- Un `ADMIN` puede además ser empleado (`user.employeeId` presente). No ramificar por `user.role === 'EMPLOYEE'` para decidir "datos propios": distinguir **vista propia** (sin `employeeId` en la query → usar `user.employeeId`) de **ver a otro** (con `employeeId` → exigir `ADMIN` + scope). Ver `src/app/api/asignaciones/mis/route.ts`.
- Preferir `$transaction` para operaciones multi-entidad, traducir conflictos `P2002` a 409 y mantener idempotencia en ingesta/worker. Para cambios de estado concurrentes, conservar el patrón de `updateMany` condicional y comprobar filas afectadas.
- Para PDF, imágenes, audio y video, validar magic bytes y límites con las utilidades existentes. Para posts/contenido HTML, reutilizar la sanitización de `src/lib/richContent.ts`.
- La integración Aditus cachea el token y coalesce requests en vuelo; reintenta una vez tras 401. Reutilizar `src/lib/aditus.ts` en vez de implementar autenticación remota en cada ruta.
- UI usa Tailwind 4 CSS-first y wrappers de `src/components/ui`; mantener composición existente en lugar de crear primitivas paralelas.

## Important Files

- `package.json`, `package-lock.json`: scripts y dependencias reales.
- `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/login/page.tsx`: arranque y acceso.
- `src/proxy.ts`, `src/lib/auth.ts`, `src/lib/permissions.ts`, `src/lib/scope.ts`: seguridad transversal.
- `src/lib/prisma.ts`, `prisma/schema.prisma`, `prisma/seed.ts`: persistencia y seed.
- `src/lib/apiErrors.ts`, `src/lib/validators/index.ts`, `src/lib/fileValidation.ts`: contratos de entrada/salida y archivos.
- `src/lib/aditus.ts`, `src/lib/jobQueue.ts`, `worker/index.ts`: almacenamiento remoto y procesamiento asíncrono.
- `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `src/app/globals.css`: compilación y estilo.
- `Dockerfile`, `Dockerfile.worker`, `.dockerignore`, `.gitlab-ci.yml`: imágenes y despliegue.
- `.env.example` y `.env.production`: referencias de configuración; no copiar secretos reales ni asumir que el ejemplo está actualizado.

README y parte de `.cortex/system/**`/`docs/superpowers/**` contienen información histórica o desalineada (versiones, auth y almacenamiento). Para decisiones actuales, priorizar `package.json`, el código, `prisma/schema.prisma`, migraciones, Dockerfiles y CI. `prisma.config.ts` usa `prisma/config`/`defineConfig` aunque el paquete declara Prisma 5.22; revisar esa compatibilidad antes de operar migraciones.

## Runtime/Tooling Preferences

- Runtime recomendado: Node.js 22, coincidente con `Dockerfile` y `Dockerfile.worker`. Next 16.2.7 requiere Node >=20.9; Vitest 4.1.10 requiere Node 20/22/24+. El README que menciona Node 18 está desactualizado.
- Package manager: npm (`package-lock.json`, lockfile v3); preferir `npm ci` en entornos reproducibles. No asumir Bun aunque esté disponible en la máquina.
- Variables mínimas: `DATABASE_URL`, `JWT_SECRET` y `NEXT_PUBLIC_APP_URL`. Operaciones de archivos requieren `ADITUS_TOKEN_URL`, `ADITUS_CLIENT_ID`, `ADITUS_USERNAME`, `ADITUS_PASSWORD`, `ADITUS_BASE_URL`, `ADITUS_LIBRARY_ID` y `ADITUS_OBJECT_DEFINITION_ID`. SMTP y Google son opcionales según la feature.
- No imprimir valores de `.env`. La imagen web carga `.env.production`; el worker debe recibir sus variables por el entorno de ejecución. CI materializa placeholders y puede requerir rebuild al cambiar valores públicos.
- Prisma usa SQL Server (`provider = "sqlserver"`, `DATABASE_URL`), no SQLite. El despliegue CI construye web y worker, pero los comandos de deploy observados levantan principalmente la web: verificar que el worker quede operando cuando se necesite SFTP/cola.
- Regla del framework: esta no es la versión convencional de Next.js. Antes de escribir código Next, leer la guía relevante en `node_modules/next/dist/docs/` y respetar sus breaking changes y deprecaciones.

## Testing & QA

- Framework: Vitest 4.1.10, sin `vitest.config.*` ni setup global. La suite automatizada es pequeña y unitaria: `src/lib/scope.test.ts` y `src/lib/cuil.test.ts`.
- Ejecutar `npm test` tras cambios en alcance jerárquico, CUIL o helpers cubiertos. No hay suites E2E, integración, UI, API ni worker localizadas.
- No hay script, umbral ni reporter de cobertura. `/coverage` solo está ignorado en `.gitignore`; no tratarlo como garantía de cobertura.
- CI ejecuta build/migraciones/deploy, no `npm test`. Para cambios de integración existen superficies manuales protegidas: `/admin/aditus-test`, `/api/aditus/test-*`, `/api/configuracion/test-email`, `/api/configuracion/sftp/test` y prueba de plantillas de email.
- `node scripts/test-email.mjs [destinatario]` verifica SMTP y envía un correo real; usar destinatario explícito y solo en un entorno autorizado.
- El seed contiene credenciales demo; usarlo únicamente en desarrollo controlado. Antes de cambios de esquema, probar migraciones versionadas y los scripts ad-hoc requeridos por CI.
## One-shot Maintenance

- `npx tsx scripts/cleanup-eventos-ausencia-duplicados.ts --dry-run` revisa duplicados; sin `--dry-run` elimina registros. `npx tsx scripts/eliminar-tipo-evento-ausencia.ts --dry-run` revisa la eliminación del tipo protegido y requiere limpiar eventos primero. Son operaciones destructivas, sin transacción extremo a extremo: hacer backup y revisar el dry-run.
- `npx tsx scripts/add-avatar-aditus-id.ts` provisiona `User.avatarAditusId` de forma idempotente; la invocación no está documentada explícitamente, por lo que confirmar el script y el estado del schema antes de ejecutarlo.
