# App RRHH — Portal de Recursos Humanos

Aplicación web para la gestión de empleados, documentos y firma electrónica de recibos de sueldo.

## Stack tecnológico

- **Next.js 15** (App Router)
- **Prisma 6** + SQL Server
- **Tailwind CSS v4** + shadcn/ui
- **JWT** para autenticación

## Funcionalidades

- Portal administrativo y portal del empleado
- Alta, edición y baja de empleados con campos configurables
- Carga individual y masiva de documentos con clasificación por tipo
- Envío a firma electrónica y seguimiento de estado
- Lotes de recibos de sueldo con firma digital
- Sistema de roles y permisos dinámicos
- Dashboard con KPIs
- Auditoría de acciones
- Configuración general: nombre, logo, color primario, proveedor de firma

## Requisitos previos

- Node.js 18+
- Instancia de **SQL Server** accesible (local o remota)

## Instalación

```bash
npm install
```

Crear el archivo `.env` en la raíz del proyecto:

```env
DATABASE_URL="sqlserver://<host>:<puerto>;database=<nombre_db>;user=<usuario>;password=<contraseña>;trustServerCertificate=true"
JWT_SECRET="un-secreto-largo-y-aleatorio"
```

Inicializar la base de datos:

```bash
npx prisma migrate deploy
npx prisma db seed
```

> `migrate deploy` aplica todas las migraciones existentes en orden.  
> `db seed` crea categorías, el usuario admin y dos empleados de prueba.

## Desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en el navegador.

## Credenciales por defecto (seed)

| Usuario | Contraseña | Rol |
|---|---|---|
| admin@empresa.com | admin123 | Administrador |
| juan.garcia@empresa.com | empleado123 | Empleado |
| maria.lopez@empresa.com | empleado123 | Empleado |

> Cambiar las contraseñas en producción.
