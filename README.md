# App RRHH — Portal de Recursos Humanos

Aplicación web para la gestión de empleados, documentos y firma electrónica de recibos de sueldo.

## Stack tecnológico

- **Next.js 16** (App Router)
- **Prisma 5** + SQLite
- **Tailwind CSS v4** + shadcn/ui
- **JWT** para autenticación
- Tema de color dinámico configurable

## Funcionalidades

- Portal administrativo y portal del empleado
- Alta, edición y baja de empleados con campos configurables
- Carga de documentos (múltiples archivos) con clasificación por tipo
- Envío a firma electrónica y seguimiento de estado
- Dashboard con KPIs y gráficos
- Auditoría de acciones
- Configuración general: nombre, logo, color primario, proveedor de firma

## Instalación

```bash
npm install
```

Configurar el archivo `.env`:

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="tu_clave_secreta"
```

Inicializar la base de datos:

```bash
npx prisma migrate dev
npx prisma db seed
```

## Desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en el navegador.

## Credenciales por defecto

Luego del seed, el usuario administrador es el creado en `prisma/seed.ts`.
