# RRHH - Sistema de Firma de Recibos: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack HR web app for managing and electronically signing employee payslips, with Admin and Employee roles.

**Architecture:** Next.js 14 App Router monolith — API Routes as REST backend, Prisma + SQLite (no external DB server), shadcn/ui + Tailwind (green institutional theme). JWTs in HTTP-only cookies, verified in Next.js middleware. PDFs stored in `/uploads/` (gitignored). Signature provider credentials stored in DB, used server-side via a configurable REST client.

**Tech Stack:** Next.js 14, TypeScript, Prisma 5 + SQLite, shadcn/ui (New York, green), Tailwind CSS, `jose` (JWT), `bcryptjs`, `recharts`, `zod`

---

## File Map

| File | Responsibility |
|------|----------------|
| `prisma/schema.prisma` | Models: User, Employee, Category, Document, SignatureConfig, AuditLog |
| `prisma/seed.ts` | Admin + 2 sample employees + 4 categories |
| `src/middleware.ts` | JWT verification + role-based route guards |
| `src/lib/prisma.ts` | Prisma singleton |
| `src/lib/auth.ts` | JWT sign/verify, password hash/compare, cookie name |
| `src/lib/audit.ts` | `logAction(userId, accion, entidad, detalle?)` |
| `src/lib/signature.ts` | `sendToSign()`, `checkSignatureStatus()` |
| `src/app/layout.tsx` | Root layout |
| `src/app/page.tsx` | Redirect → /login |
| `src/app/login/page.tsx` | Login form (client component) |
| `src/app/admin/layout.tsx` | Admin shell (sidebar + header) |
| `src/app/admin/page.tsx` | Admin dashboard |
| `src/app/admin/empleados/page.tsx` | Employees CRUD |
| `src/app/admin/categorias/page.tsx` | Categories CRUD |
| `src/app/admin/documentos/page.tsx` | Documents management |
| `src/app/admin/configuracion/page.tsx` | Signature provider config |
| `src/app/admin/auditoria/page.tsx` | Audit log |
| `src/app/empleado/layout.tsx` | Employee shell |
| `src/app/empleado/page.tsx` | Employee portal (profile + receipts) |
| `src/app/api/auth/login/route.ts` | POST /api/auth/login |
| `src/app/api/auth/logout/route.ts` | POST /api/auth/logout |
| `src/app/api/empleados/route.ts` | GET list + POST create |
| `src/app/api/empleados/[id]/route.ts` | GET, PUT, DELETE by id |
| `src/app/api/categorias/route.ts` | GET list + POST create |
| `src/app/api/categorias/[id]/route.ts` | PUT, DELETE by id |
| `src/app/api/documentos/route.ts` | GET list + POST upload (multipart) |
| `src/app/api/documentos/[id]/route.ts` | GET, PUT, DELETE |
| `src/app/api/documentos/[id]/enviar-firma/route.ts` | POST — send to sign |
| `src/app/api/documentos/[id]/archivo/route.ts` | GET — stream PDF |
| `src/app/api/configuracion/route.ts` | GET + PUT signature config |
| `src/app/api/dashboard/route.ts` | GET KPIs |
| `src/app/api/auditoria/route.ts` | GET audit log |
| `src/components/layout/AdminSidebar.tsx` | Sidebar nav links |
| `src/components/layout/AdminHeader.tsx` | Top bar + logout |
| `src/components/dashboard/KPICards.tsx` | KPI stat cards grid |
| `src/components/dashboard/Charts.tsx` | Donut (document states) + bar (by category) |
| `src/components/empleados/EmpleadosTable.tsx` | Table + search + pagination |
| `src/components/empleados/EmpleadoDialog.tsx` | Create/edit modal |
| `src/components/categorias/CategoriasTable.tsx` | Categories table |
| `src/components/categorias/CategoriaDialog.tsx` | Create/edit modal |
| `src/components/documentos/DocumentosTable.tsx` | Documents table + state badges + actions |
| `src/components/documentos/DocumentoUploadDialog.tsx` | PDF upload + employee assign |
| `src/components/empleado/MisRecibos.tsx` | Employee's receipt list |

---

## Task 1: Project Setup

**Files:**
- Create: `c:\LPA\rrhh\` (project root, via Next.js CLI from `c:\LPA\`)
- Create: `.env`
- Create: `.gitignore`
- Create: `next.config.ts`

- [ ] **Step 1: Scaffold Next.js app**

Run from `c:\LPA\` (not inside rrhh\):
```bash
npx create-next-app@latest rrhh --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git
```
When prompted, answer: Yes to all defaults.

- [ ] **Step 2: Install dependencies**

```bash
cd c:\LPA\rrhh
npm install prisma @prisma/client jose bcryptjs zod recharts
npm install -D @types/bcryptjs prisma
```

- [ ] **Step 3: Initialize Prisma with SQLite**

```bash
npx prisma init --datasource-provider sqlite
```

- [ ] **Step 4: Initialize shadcn/ui**

```bash
npx shadcn@latest init -d
```
When prompted: style = New York, base color = Green, CSS variables = yes.

Then add needed components:
```bash
npx shadcn@latest add button input label card table badge dialog select textarea separator avatar dropdown-menu
```

- [ ] **Step 5: Create `.env`**

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="cambiar-por-secreto-seguro-en-produccion"
```

- [ ] **Step 6: Update `.gitignore`**

Add to the existing `.gitignore`:
```
/uploads
/prisma/dev.db
/prisma/dev.db-journal
```

- [ ] **Step 7: Create `next.config.ts`**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs'],
  },
}

export default nextConfig
```

- [ ] **Step 8: Create uploads directory**

```bash
mkdir uploads
```

- [ ] **Step 9: Verify dev server starts**

```bash
npm run dev
```
Expected: server running at http://localhost:3000 with no errors.

---

## Task 2: Database Schema & Seed

**Files:**
- Create/modify: `prisma/schema.prisma`
- Create: `prisma/seed.ts`

- [ ] **Step 1: Write Prisma schema**

Replace `prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id           Int       @id @default(autoincrement())
  email        String    @unique
  passwordHash String
  role         String    @default("EMPLOYEE")
  employeeId   Int?      @unique
  createdAt    DateTime  @default(now())

  employee  Employee?  @relation(fields: [employeeId], references: [id])
  documents Document[] @relation("CargadoPor")
  auditLogs AuditLog[]
}

model Employee {
  id           Int       @id @default(autoincrement())
  legajo       String    @unique
  nombre       String
  apellido     String
  cuil         String    @unique
  email        String    @unique
  telefono     String?
  fechaIngreso DateTime
  categoriaId  Int
  estado       String    @default("ACTIVO")
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  categoria Category   @relation(fields: [categoriaId], references: [id])
  user      User?
  documents Document[]
}

model Category {
  id        Int        @id @default(autoincrement())
  nombre    String     @unique
  employees Employee[]
}

model Document {
  id              Int       @id @default(autoincrement())
  nombreArchivo   String
  filePath        String
  periodo         String
  fechaCarga      DateTime  @default(now())
  cargadoPorId    Int
  employeeId      Int
  estado          String    @default("BORRADOR")
  firmaExternalId String?
  fechaFirma      DateTime?
  updatedAt       DateTime  @updatedAt

  cargadoPor User     @relation("CargadoPor", fields: [cargadoPorId], references: [id])
  employee   Employee @relation(fields: [employeeId], references: [id])
}

model SignatureConfig {
  id           Int      @id @default(autoincrement())
  providerUrl  String
  apiKey       String
  extraHeaders String   @default("{}")
  updatedAt    DateTime @updatedAt
}

model AuditLog {
  id        Int      @id @default(autoincrement())
  userId    Int
  accion    String
  entidad   String
  detalle   String?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])
}
```

- [ ] **Step 2: Add seed script to `package.json`**

Add inside `"scripts"`:
```json
"db:seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
```

Also add at root level of `package.json`:
```json
"prisma": {
  "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
}
```

Install ts-node:
```bash
npm install -D ts-node
```

- [ ] **Step 3: Write `prisma/seed.ts`**

```typescript
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const cats = await Promise.all([
    prisma.category.upsert({ where: { nombre: 'Administrativo' }, update: {}, create: { nombre: 'Administrativo' } }),
    prisma.category.upsert({ where: { nombre: 'Operario' }, update: {}, create: { nombre: 'Operario' } }),
    prisma.category.upsert({ where: { nombre: 'Supervisor' }, update: {}, create: { nombre: 'Supervisor' } }),
    prisma.category.upsert({ where: { nombre: 'Gerente' }, update: {}, create: { nombre: 'Gerente' } }),
  ])

  await prisma.user.upsert({
    where: { email: 'admin@empresa.com' },
    update: {},
    create: {
      email: 'admin@empresa.com',
      passwordHash: await bcrypt.hash('admin123', 10),
      role: 'ADMIN',
    },
  })

  const emp1 = await prisma.employee.upsert({
    where: { legajo: 'EMP001' },
    update: {},
    create: {
      legajo: 'EMP001',
      nombre: 'Juan',
      apellido: 'García',
      cuil: '20-12345678-9',
      email: 'juan.garcia@empresa.com',
      telefono: '011-4444-5555',
      fechaIngreso: new Date('2022-03-01'),
      categoriaId: cats[0].id,
      estado: 'ACTIVO',
    },
  })

  await prisma.user.upsert({
    where: { email: 'juan.garcia@empresa.com' },
    update: {},
    create: {
      email: 'juan.garcia@empresa.com',
      passwordHash: await bcrypt.hash('empleado123', 10),
      role: 'EMPLOYEE',
      employeeId: emp1.id,
    },
  })

  const emp2 = await prisma.employee.upsert({
    where: { legajo: 'EMP002' },
    update: {},
    create: {
      legajo: 'EMP002',
      nombre: 'María',
      apellido: 'López',
      cuil: '27-98765432-1',
      email: 'maria.lopez@empresa.com',
      fechaIngreso: new Date('2021-06-15'),
      categoriaId: cats[2].id,
      estado: 'ACTIVO',
    },
  })

  await prisma.user.upsert({
    where: { email: 'maria.lopez@empresa.com' },
    update: {},
    create: {
      email: 'maria.lopez@empresa.com',
      passwordHash: await bcrypt.hash('empleado123', 10),
      role: 'EMPLOYEE',
      employeeId: emp2.id,
    },
  })

  console.log('Seed completado.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
```

- [ ] **Step 4: Run migration and seed**

```bash
npx prisma migrate dev --name init
npx prisma db seed
```

Expected: Migration created, seed runs with "Seed completado."

---

## Task 3: Auth Library + Middleware + Login Page

**Files:**
- Create: `src/lib/prisma.ts`
- Create: `src/lib/auth.ts`
- Create: `src/middleware.ts`
- Create: `src/app/login/page.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create `src/lib/prisma.ts`**

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 2: Create `src/lib/auth.ts`**

```typescript
import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'

const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
export const COOKIE_NAME = 'rrhh_token'

export interface TokenPayload {
  userId: number
  role: 'ADMIN' | 'EMPLOYEE'
  employeeId?: number
  email: string
}

export async function signToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('8h')
    .sign(secret)
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, secret)
  return payload as unknown as TokenPayload
}

export const hashPassword = (pw: string) => bcrypt.hash(pw, 10)
export const comparePassword = (pw: string, hash: string) => bcrypt.compare(pw, hash)
```

- [ ] **Step 3: Create `src/middleware.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
const COOKIE = 'rrhh_token'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const token = req.cookies.get(COOKIE)?.value

  if (pathname === '/login') {
    if (!token) return NextResponse.next()
    try {
      const { payload } = await jwtVerify(token, secret)
      const dest = payload.role === 'ADMIN' ? '/admin' : '/empleado'
      return NextResponse.redirect(new URL(dest, req.url))
    } catch {
      return NextResponse.next()
    }
  }

  if (!token) return NextResponse.redirect(new URL('/login', req.url))

  try {
    const { payload } = await jwtVerify(token, secret)
    if (pathname.startsWith('/admin') && payload.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/empleado', req.url))
    }
    if (pathname.startsWith('/empleado') && payload.role !== 'EMPLOYEE') {
      return NextResponse.redirect(new URL('/admin', req.url))
    }
    return NextResponse.next()
  } catch {
    const res = NextResponse.redirect(new URL('/login', req.url))
    res.cookies.delete(COOKIE)
    return res
  }
}

export const config = {
  matcher: ['/admin/:path*', '/empleado/:path*', '/login'],
}
```

- [ ] **Step 4: Create login API `src/app/api/auth/login/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { signToken, comparePassword, COOKIE_NAME } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (!email || !password) {
    return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !(await comparePassword(password, user.passwordHash))) {
    return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
  }

  const token = await signToken({
    userId: user.id,
    role: user.role as 'ADMIN' | 'EMPLOYEE',
    employeeId: user.employeeId ?? undefined,
    email: user.email,
  })

  const res = NextResponse.json({ ok: true, role: user.role })
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  })
  return res
}
```

- [ ] **Step 5: Create logout API `src/app/api/auth/logout/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { COOKIE_NAME } from '@/lib/auth'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(COOKIE_NAME)
  return res
}
```

- [ ] **Step 6: Create `src/app/page.tsx`**

```typescript
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/login')
}
```

- [ ] **Step 7: Create `src/app/login/page.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error)
      setLoading(false)
      return
    }
    router.push(data.role === 'ADMIN' ? '/admin' : '/empleado')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-green-50">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 text-4xl">📋</div>
          <CardTitle className="text-green-800">RRHH — Acceso</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@empresa.com"
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full bg-green-700 hover:bg-green-800" disabled={loading}>
              {loading ? 'Ingresando...' : 'Ingresar'}
            </Button>
          </form>
          <p className="mt-4 text-xs text-center text-muted-foreground">
            Demo: admin@empresa.com / admin123
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 8: Verify auth flow**

Start dev server: `npm run dev`
- Open http://localhost:3000 → should redirect to /login
- Login with `admin@empresa.com` / `admin123` → should redirect to /admin (404 is OK, page not built yet)
- Login with `juan.garcia@empresa.com` / `empleado123` → should redirect to /empleado

---

## Task 4: Admin Layout (Sidebar + Header)

**Files:**
- Create: `src/app/admin/layout.tsx`
- Create: `src/components/layout/AdminSidebar.tsx`
- Create: `src/components/layout/AdminHeader.tsx`
- Create: `src/app/admin/page.tsx` (stub)

- [ ] **Step 1: Create `src/components/layout/AdminSidebar.tsx`**

```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, Tag, FileText, Settings, ClipboardList,
} from 'lucide-react'

const nav = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/empleados', label: 'Empleados', icon: Users },
  { href: '/admin/categorias', label: 'Categorías', icon: Tag },
  { href: '/admin/documentos', label: 'Documentos', icon: FileText },
  { href: '/admin/auditoria', label: 'Auditoría', icon: ClipboardList },
  { href: '/admin/configuracion', label: 'Configuración', icon: Settings },
]

export function AdminSidebar() {
  const pathname = usePathname()
  return (
    <aside className="w-60 min-h-screen bg-green-900 text-white flex flex-col">
      <div className="px-6 py-5 border-b border-green-800">
        <span className="text-lg font-bold tracking-tight">📋 RRHH</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                active
                  ? 'bg-green-700 text-white font-medium'
                  : 'text-green-200 hover:bg-green-800 hover:text-white'
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
```

Install lucide-react if not present:
```bash
npm install lucide-react
```

- [ ] **Step 2: Create `src/components/layout/AdminHeader.tsx`**

```typescript
'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

interface Props { title: string }

export function AdminHeader({ title }: Props) {
  const router = useRouter()

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <header className="h-14 border-b bg-white flex items-center justify-between px-6 shadow-sm">
      <h1 className="font-semibold text-green-900">{title}</h1>
      <Button variant="ghost" size="sm" onClick={logout} className="text-green-700">
        <LogOut size={16} className="mr-1" /> Salir
      </Button>
    </header>
  )
}
```

- [ ] **Step 3: Create `src/app/admin/layout.tsx`**

```typescript
import { AdminSidebar } from '@/components/layout/AdminSidebar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Create stub `src/app/admin/page.tsx`**

```typescript
import { AdminHeader } from '@/components/layout/AdminHeader'

export default function AdminDashboard() {
  return (
    <>
      <AdminHeader title="Dashboard" />
      <div className="p-6">
        <p className="text-muted-foreground">Dashboard — próximamente</p>
      </div>
    </>
  )
}
```

- [ ] **Step 5: Verify layout**

Login as admin → should see green sidebar + header with "Dashboard" title.

---

## Task 5: Categories Module

**Files:**
- Create: `src/app/api/categorias/route.ts`
- Create: `src/app/api/categorias/[id]/route.ts`
- Create: `src/components/categorias/CategoriasTable.tsx`
- Create: `src/components/categorias/CategoriaDialog.tsx`
- Create: `src/app/admin/categorias/page.tsx`

- [ ] **Step 1: Create `src/app/api/categorias/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const data = await prisma.category.findMany({
    orderBy: { nombre: 'asc' },
    include: { _count: { select: { employees: true } } },
  })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const { nombre } = await req.json()
  if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })
  const cat = await prisma.category.create({ data: { nombre: nombre.trim() } })
  return NextResponse.json(cat, { status: 201 })
}
```

- [ ] **Step 2: Create `src/app/api/categorias/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { nombre } = await req.json()
  const cat = await prisma.category.update({
    where: { id: Number(params.id) },
    data: { nombre: nombre.trim() },
  })
  return NextResponse.json(cat)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  await prisma.category.delete({ where: { id: Number(params.id) } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Create `src/components/categorias/CategoriaDialog.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  categoria?: { id: number; nombre: string }
}

export function CategoriaDialog({ open, onClose, onSaved, categoria }: Props) {
  const [nombre, setNombre] = useState(categoria?.nombre ?? '')

  async function handleSave() {
    const url = categoria ? `/api/categorias/${categoria.id}` : '/api/categorias'
    const method = categoria ? 'PUT' : 'POST'
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre }),
    })
    onSaved()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{categoria ? 'Editar' : 'Nueva'} Categoría</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Label>Nombre</Label>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Operario" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button className="bg-green-700 hover:bg-green-800" onClick={handleSave}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Create `src/components/categorias/CategoriasTable.tsx`**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CategoriaDialog } from './CategoriaDialog'
import { Pencil, Trash2, Plus } from 'lucide-react'

interface Categoria { id: number; nombre: string; _count: { employees: number } }

export function CategoriasTable() {
  const [data, setData] = useState<Categoria[]>([])
  const [dialog, setDialog] = useState<{ open: boolean; cat?: Categoria }>({ open: false })

  const load = () => fetch('/api/categorias').then(r => r.json()).then(setData)
  useEffect(() => { load() }, [])

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar categoría?')) return
    await fetch(`/api/categorias/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button className="bg-green-700 hover:bg-green-800" onClick={() => setDialog({ open: true })}>
          <Plus size={16} className="mr-1" /> Nueva Categoría
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Empleados</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map(cat => (
            <TableRow key={cat.id}>
              <TableCell className="font-medium">{cat.nombre}</TableCell>
              <TableCell>{cat._count.employees}</TableCell>
              <TableCell className="text-right space-x-2">
                <Button size="sm" variant="outline" onClick={() => setDialog({ open: true, cat })}>
                  <Pencil size={14} />
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleDelete(cat.id)}>
                  <Trash2 size={14} />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {dialog.open && (
        <CategoriaDialog
          open
          categoria={dialog.cat}
          onClose={() => setDialog({ open: false })}
          onSaved={load}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 5: Create `src/app/admin/categorias/page.tsx`**

```typescript
import { AdminHeader } from '@/components/layout/AdminHeader'
import { CategoriasTable } from '@/components/categorias/CategoriasTable'

export default function CategoriasPage() {
  return (
    <>
      <AdminHeader title="Categorías" />
      <div className="p-6">
        <CategoriasTable />
      </div>
    </>
  )
}
```

- [ ] **Step 6: Verify**

Open /admin/categorias — should show the 4 seeded categories. Test create, edit, delete.

---

## Task 6: Employees Module

**Files:**
- Create: `src/lib/audit.ts`
- Create: `src/app/api/empleados/route.ts`
- Create: `src/app/api/empleados/[id]/route.ts`
- Create: `src/components/empleados/EmpleadoDialog.tsx`
- Create: `src/components/empleados/EmpleadosTable.tsx`
- Create: `src/app/admin/empleados/page.tsx`

- [ ] **Step 1: Create `src/lib/audit.ts`**

```typescript
import { prisma } from './prisma'

export async function logAction(
  userId: number,
  accion: string,
  entidad: string,
  detalle?: string
) {
  await prisma.auditLog.create({ data: { userId, accion, entidad, detalle } })
}
```

- [ ] **Step 2: Create helper to get current user from request cookies**

Add to `src/lib/auth.ts`:

```typescript
import { cookies } from 'next/headers'

export async function getCurrentUser() {
  const cookieStore = cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  try {
    return await verifyToken(token)
  } catch {
    return null
  }
}
```

- [ ] **Step 3: Create `src/app/api/empleados/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { logAction } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') ?? ''
  const estado = searchParams.get('estado') ?? undefined
  const page = Number(searchParams.get('page') ?? '1')
  const limit = 20

  const where = {
    AND: [
      q ? {
        OR: [
          { nombre: { contains: q } },
          { apellido: { contains: q } },
          { legajo: { contains: q } },
          { cuil: { contains: q } },
        ],
      } : {},
      estado ? { estado } : {},
    ],
  }

  const [total, employees] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      include: { categoria: true },
      orderBy: { apellido: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  return NextResponse.json({ employees, total, page, pages: Math.ceil(total / limit) })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  const body = await req.json()
  const emp = await prisma.employee.create({
    data: {
      legajo: body.legajo,
      nombre: body.nombre,
      apellido: body.apellido,
      cuil: body.cuil,
      email: body.email,
      telefono: body.telefono ?? null,
      fechaIngreso: new Date(body.fechaIngreso),
      categoriaId: Number(body.categoriaId),
      estado: body.estado ?? 'ACTIVO',
    },
    include: { categoria: true },
  })
  if (user) await logAction(user.userId, 'CREAR', 'Empleado', `Legajo: ${emp.legajo}`)
  return NextResponse.json(emp, { status: 201 })
}
```

- [ ] **Step 4: Create `src/app/api/empleados/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { logAction } from '@/lib/audit'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const emp = await prisma.employee.findUnique({
    where: { id: Number(params.id) },
    include: { categoria: true },
  })
  if (!emp) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json(emp)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  const body = await req.json()
  const emp = await prisma.employee.update({
    where: { id: Number(params.id) },
    data: {
      legajo: body.legajo,
      nombre: body.nombre,
      apellido: body.apellido,
      cuil: body.cuil,
      email: body.email,
      telefono: body.telefono ?? null,
      fechaIngreso: new Date(body.fechaIngreso),
      categoriaId: Number(body.categoriaId),
      estado: body.estado,
    },
    include: { categoria: true },
  })
  if (user) await logAction(user.userId, 'MODIFICAR', 'Empleado', `Legajo: ${emp.legajo}`)
  return NextResponse.json(emp)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  const emp = await prisma.employee.delete({ where: { id: Number(params.id) } })
  if (user) await logAction(user.userId, 'ELIMINAR', 'Empleado', `Legajo: ${emp.legajo}`)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5: Create `src/components/empleados/EmpleadoDialog.tsx`**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Categoria { id: number; nombre: string }
interface Empleado {
  id?: number; legajo: string; nombre: string; apellido: string; cuil: string
  email: string; telefono?: string; fechaIngreso: string; categoriaId: number; estado: string
}

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  empleado?: Empleado
}

const empty: Empleado = {
  legajo: '', nombre: '', apellido: '', cuil: '', email: '',
  telefono: '', fechaIngreso: '', categoriaId: 0, estado: 'ACTIVO',
}

export function EmpleadoDialog({ open, onClose, onSaved, empleado }: Props) {
  const [form, setForm] = useState<Empleado>(empleado ?? empty)
  const [cats, setCats] = useState<Categoria[]>([])

  useEffect(() => {
    fetch('/api/categorias').then(r => r.json()).then(setCats)
    if (empleado) setForm(empleado)
    else setForm(empty)
  }, [empleado, open])

  const set = (k: keyof Empleado) => (val: string) => setForm(f => ({ ...f, [k]: val }))

  async function handleSave() {
    const url = form.id ? `/api/empleados/${form.id}` : '/api/empleados'
    const method = form.id ? 'PUT' : 'POST'
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    onSaved()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{form.id ? 'Editar' : 'Nuevo'} Empleado</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          {([['legajo','Legajo'],['nombre','Nombre'],['apellido','Apellido'],['cuil','CUIL'],['email','Email'],['telefono','Teléfono']] as [keyof Empleado, string][]).map(([k, label]) => (
            <div key={k}>
              <Label>{label}</Label>
              <Input value={form[k] as string} onChange={e => set(k)(e.target.value)} />
            </div>
          ))}
          <div>
            <Label>Fecha Ingreso</Label>
            <Input type="date" value={form.fechaIngreso?.toString().slice(0,10)} onChange={e => set('fechaIngreso')(e.target.value)} />
          </div>
          <div>
            <Label>Categoría</Label>
            <Select value={String(form.categoriaId)} onValueChange={v => set('categoriaId')(v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                {cats.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Estado</Label>
            <Select value={form.estado} onValueChange={set('estado')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVO">Activo</SelectItem>
                <SelectItem value="INACTIVO">Inactivo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button className="bg-green-700 hover:bg-green-800" onClick={handleSave}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 6: Create `src/components/empleados/EmpleadosTable.tsx`**

```typescript
'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmpleadoDialog } from './EmpleadoDialog'
import { Pencil, Trash2, Plus, Search } from 'lucide-react'

interface Empleado {
  id: number; legajo: string; nombre: string; apellido: string; cuil: string
  email: string; telefono?: string; fechaIngreso: string; estado: string
  categoria: { nombre: string }; categoriaId: number
}

export function EmpleadosTable() {
  const [data, setData] = useState<{ employees: Empleado[]; total: number; pages: number }>({ employees: [], total: 0, pages: 1 })
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState<{ open: boolean; emp?: Empleado }>({ open: false })

  const load = useCallback(() => {
    const params = new URLSearchParams({ q, page: String(page) })
    fetch(`/api/empleados?${params}`).then(r => r.json()).then(setData)
  }, [q, page])

  useEffect(() => { load() }, [load])

  async function handleDelete(id: number, legajo: string) {
    if (!confirm(`¿Eliminar empleado ${legajo}?`)) return
    await fetch(`/api/empleados/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-2.5 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre, legajo, CUIL..."
            value={q}
            onChange={e => { setQ(e.target.value); setPage(1) }}
          />
        </div>
        <Button className="bg-green-700 hover:bg-green-800" onClick={() => setDialog({ open: true })}>
          <Plus size={16} className="mr-1" /> Nuevo Empleado
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Legajo</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>CUIL</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.employees.map(emp => (
            <TableRow key={emp.id}>
              <TableCell className="font-mono">{emp.legajo}</TableCell>
              <TableCell>{emp.apellido}, {emp.nombre}</TableCell>
              <TableCell className="font-mono text-sm">{emp.cuil}</TableCell>
              <TableCell>{emp.categoria.nombre}</TableCell>
              <TableCell>
                <Badge variant={emp.estado === 'ACTIVO' ? 'default' : 'secondary'} className={emp.estado === 'ACTIVO' ? 'bg-green-600' : ''}>
                  {emp.estado}
                </Badge>
              </TableCell>
              <TableCell className="text-right space-x-2">
                <Button size="sm" variant="outline" onClick={() => setDialog({ open: true, emp: { ...emp, fechaIngreso: emp.fechaIngreso } })}>
                  <Pencil size={14} />
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleDelete(emp.id, emp.legajo)}>
                  <Trash2 size={14} />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
        <span>{data.total} empleados</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>←</Button>
          <span className="px-2 py-1">Página {page} de {data.pages}</span>
          <Button size="sm" variant="outline" disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>→</Button>
        </div>
      </div>
      {dialog.open && (
        <EmpleadoDialog
          open
          empleado={dialog.emp}
          onClose={() => setDialog({ open: false })}
          onSaved={load}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 7: Create `src/app/admin/empleados/page.tsx`**

```typescript
import { AdminHeader } from '@/components/layout/AdminHeader'
import { EmpleadosTable } from '@/components/empleados/EmpleadosTable'

export default function EmpleadosPage() {
  return (
    <>
      <AdminHeader title="Empleados" />
      <div className="p-6">
        <EmpleadosTable />
      </div>
    </>
  )
}
```

- [ ] **Step 8: Verify**

Open /admin/empleados — should show 2 seeded employees. Test search, create, edit, delete.

---

## Task 7: Documents Module

**Files:**
- Create: `src/app/api/documentos/route.ts`
- Create: `src/app/api/documentos/[id]/route.ts`
- Create: `src/app/api/documentos/[id]/archivo/route.ts`
- Create: `src/components/documentos/DocumentoUploadDialog.tsx`
- Create: `src/components/documentos/DocumentosTable.tsx`
- Create: `src/app/admin/documentos/page.tsx`

- [ ] **Step 1: Create `src/app/api/documentos/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { logAction } from '@/lib/audit'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get('employeeId')
  const estado = searchParams.get('estado')

  const docs = await prisma.document.findMany({
    where: {
      ...(employeeId ? { employeeId: Number(employeeId) } : {}),
      ...(estado ? { estado } : {}),
    },
    include: {
      employee: { select: { nombre: true, apellido: true, legajo: true } },
      cargadoPor: { select: { email: true } },
    },
    orderBy: { fechaCarga: 'desc' },
  })
  return NextResponse.json(docs)
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File
  const employeeId = Number(formData.get('employeeId'))
  const periodo = formData.get('periodo') as string

  if (!file || !employeeId || !periodo) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const uploadsDir = join(process.cwd(), 'uploads')
  await mkdir(uploadsDir, { recursive: true })

  const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const filePath = join(uploadsDir, fileName)
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(filePath, buffer)

  const doc = await prisma.document.create({
    data: {
      nombreArchivo: file.name,
      filePath,
      periodo,
      employeeId,
      cargadoPorId: user.userId,
      estado: 'BORRADOR',
    },
    include: {
      employee: { select: { nombre: true, apellido: true, legajo: true } },
    },
  })

  await logAction(user.userId, 'CARGAR', 'Documento', `${file.name} → ${doc.employee.legajo}`)
  return NextResponse.json(doc, { status: 201 })
}
```

- [ ] **Step 2: Create `src/app/api/documentos/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { logAction } from '@/lib/audit'
import { unlink } from 'fs/promises'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const doc = await prisma.document.findUnique({
    where: { id: Number(params.id) },
    include: { employee: true, cargadoPor: { select: { email: true } } },
  })
  if (!doc) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json(doc)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const doc = await prisma.document.update({
    where: { id: Number(params.id) },
    data: { estado: body.estado, firmaExternalId: body.firmaExternalId, fechaFirma: body.fechaFirma },
  })
  return NextResponse.json(doc)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  const doc = await prisma.document.delete({ where: { id: Number(params.id) } })
  try { await unlink(doc.filePath) } catch { /* file may not exist */ }
  if (user) await logAction(user.userId, 'ELIMINAR', 'Documento', doc.nombreArchivo)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Create `src/app/api/documentos/[id]/archivo/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { readFile } from 'fs/promises'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const doc = await prisma.document.findUnique({ where: { id: Number(params.id) } })
  if (!doc) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  // Employees can only access their own documents
  if (user.role === 'EMPLOYEE' && doc.employeeId !== user.employeeId) {
    return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
  }

  const buffer = await readFile(doc.filePath)
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${doc.nombreArchivo}"`,
    },
  })
}
```

- [ ] **Step 4: Create `src/components/documentos/DocumentoUploadDialog.tsx`**

```typescript
'use client'

import { useEffect, useState, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload } from 'lucide-react'

interface Empleado { id: number; nombre: string; apellido: string; legajo: string }
interface Props { open: boolean; onClose: () => void; onSaved: () => void }

export function DocumentoUploadDialog({ open, onClose, onSaved }: Props) {
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [empleadoId, setEmpleadoId] = useState('')
  const [periodo, setPeriodo] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/empleados?page=1').then(r => r.json()).then(d => setEmpleados(d.employees))
  }, [open])

  async function handleUpload() {
    if (!file || !empleadoId || !periodo) return
    setLoading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('employeeId', empleadoId)
    fd.append('periodo', periodo)
    await fetch('/api/documentos', { method: 'POST', body: fd })
    setLoading(false)
    onSaved()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Cargar Recibo de Sueldo</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Empleado</Label>
            <Select value={empleadoId} onValueChange={setEmpleadoId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar empleado" /></SelectTrigger>
              <SelectContent>
                {empleados.map(e => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    {e.legajo} — {e.apellido}, {e.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Período (YYYY-MM)</Label>
            <Input
              placeholder="2024-01"
              value={periodo}
              onChange={e => setPeriodo(e.target.value)}
            />
          </div>
          <div>
            <Label>Archivo PDF</Label>
            <div
              className="mt-1 border-2 border-dashed border-green-300 rounded-lg p-6 text-center cursor-pointer hover:border-green-500 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={24} className="mx-auto mb-2 text-green-600" />
              <p className="text-sm text-muted-foreground">
                {file ? file.name : 'Hacé click para seleccionar un PDF'}
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            className="bg-green-700 hover:bg-green-800"
            onClick={handleUpload}
            disabled={!file || !empleadoId || !periodo || loading}
          >
            {loading ? 'Subiendo...' : 'Cargar Recibo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 5: Create `src/components/documentos/DocumentosTable.tsx`**

Estado badge colors: BORRADOR=gray, PENDIENTE_ENVIO=yellow, ENVIADO_A_FIRMA=blue, FIRMADO=green, RECHAZADO=red, ERROR=orange.

```typescript
'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DocumentoUploadDialog } from './DocumentoUploadDialog'
import { FileText, Send, Trash2, Plus, RefreshCw, Eye } from 'lucide-react'

interface Doc {
  id: number; nombreArchivo: string; periodo: string; estado: string
  fechaCarga: string; fechaFirma?: string; firmaExternalId?: string
  employee: { nombre: string; apellido: string; legajo: string }
  cargadoPor: { email: string }
}

const estadoStyles: Record<string, string> = {
  BORRADOR: 'bg-gray-100 text-gray-700',
  PENDIENTE_ENVIO: 'bg-yellow-100 text-yellow-700',
  ENVIADO_A_FIRMA: 'bg-blue-100 text-blue-700',
  FIRMADO: 'bg-green-100 text-green-700',
  RECHAZADO: 'bg-red-100 text-red-700',
  ERROR: 'bg-orange-100 text-orange-700',
}

const estadoLabel: Record<string, string> = {
  BORRADOR: 'Borrador',
  PENDIENTE_ENVIO: 'Pendiente',
  ENVIADO_A_FIRMA: 'Enviado',
  FIRMADO: 'Firmado',
  RECHAZADO: 'Rechazado',
  ERROR: 'Error',
}

export function DocumentosTable() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [uploadOpen, setUploadOpen] = useState(false)
  const [sending, setSending] = useState<number | null>(null)

  const load = useCallback(() =>
    fetch('/api/documentos').then(r => r.json()).then(setDocs), [])

  useEffect(() => { load() }, [load])

  async function handleSendToSign(id: number) {
    setSending(id)
    const res = await fetch(`/api/documentos/${id}/enviar-firma`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) alert(`Error: ${data.error}`)
    setSending(null)
    load()
  }

  async function handleCheckStatus(id: number) {
    const res = await fetch(`/api/documentos/${id}/enviar-firma`, { method: 'PATCH' })
    const data = await res.json()
    if (!res.ok) alert(`Error: ${data.error}`)
    load()
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar documento?')) return
    await fetch(`/api/documentos/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button className="bg-green-700 hover:bg-green-800" onClick={() => setUploadOpen(true)}>
          <Plus size={16} className="mr-1" /> Cargar Recibo
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Empleado</TableHead>
            <TableHead>Período</TableHead>
            <TableHead>Archivo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Cargado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {docs.map(doc => (
            <TableRow key={doc.id}>
              <TableCell>
                <div className="font-medium">{doc.employee.apellido}, {doc.employee.nombre}</div>
                <div className="text-xs text-muted-foreground">{doc.employee.legajo}</div>
              </TableCell>
              <TableCell className="font-mono">{doc.periodo}</TableCell>
              <TableCell>
                <a
                  href={`/api/documentos/${doc.id}/archivo`}
                  target="_blank"
                  className="flex items-center gap-1 text-green-700 hover:underline text-sm"
                >
                  <FileText size={14} /> {doc.nombreArchivo}
                </a>
              </TableCell>
              <TableCell>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${estadoStyles[doc.estado]}`}>
                  {estadoLabel[doc.estado] ?? doc.estado}
                </span>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(doc.fechaCarga).toLocaleDateString('es-AR')}
              </TableCell>
              <TableCell className="text-right space-x-1">
                {(doc.estado === 'BORRADOR' || doc.estado === 'PENDIENTE_ENVIO') && (
                  <Button size="sm" variant="outline" className="text-blue-600" onClick={() => handleSendToSign(doc.id)} disabled={sending === doc.id}>
                    <Send size={14} className="mr-1" /> {sending === doc.id ? '...' : 'Firmar'}
                  </Button>
                )}
                {doc.estado === 'ENVIADO_A_FIRMA' && (
                  <Button size="sm" variant="outline" onClick={() => handleCheckStatus(doc.id)}>
                    <RefreshCw size={14} className="mr-1" /> Estado
                  </Button>
                )}
                <Button size="sm" variant="destructive" onClick={() => handleDelete(doc.id)}>
                  <Trash2 size={14} />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {uploadOpen && (
        <DocumentoUploadDialog open onClose={() => setUploadOpen(false)} onSaved={load} />
      )}
    </div>
  )
}
```

- [ ] **Step 6: Create `src/app/admin/documentos/page.tsx`**

```typescript
import { AdminHeader } from '@/components/layout/AdminHeader'
import { DocumentosTable } from '@/components/documentos/DocumentosTable'

export default function DocumentosPage() {
  return (
    <>
      <AdminHeader title="Documentos" />
      <div className="p-6">
        <DocumentosTable />
      </div>
    </>
  )
}
```

- [ ] **Step 7: Verify**

Open /admin/documentos → upload a PDF, assign to an employee, verify it appears in the table with estado BORRADOR and the PDF link works.

---

## Task 8: Signature Integration

**Files:**
- Create: `src/lib/signature.ts`
- Create: `src/app/api/documentos/[id]/enviar-firma/route.ts`
- Create: `src/app/api/configuracion/route.ts`
- Create: `src/app/admin/configuracion/page.tsx`

- [ ] **Step 1: Create `src/lib/signature.ts`**

```typescript
import { prisma } from './prisma'
import { readFile } from 'fs/promises'

export async function sendToSign(documentId: number, filePath: string, fileName: string): Promise<string> {
  const config = await prisma.signatureConfig.findFirst()
  if (!config) throw new Error('Proveedor de firma no configurado. Configure desde Ajustes.')

  const extraHeaders = JSON.parse(config.extraHeaders || '{}') as Record<string, string>
  const fileBuffer = await readFile(filePath)
  const base64 = fileBuffer.toString('base64')

  const res = await fetch(config.providerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({ documentId: String(documentId), fileName, fileContent: base64 }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Error del proveedor (${res.status}): ${text}`)
  }

  const data = await res.json() as Record<string, unknown>
  const externalId = (data.id ?? data.externalId ?? data.documentId) as string
  if (!externalId) throw new Error('El proveedor no devolvió un ID de documento')
  return String(externalId)
}

export async function checkSignatureStatus(externalId: string): Promise<{ status: string; signedAt?: string }> {
  const config = await prisma.signatureConfig.findFirst()
  if (!config) throw new Error('Proveedor no configurado')

  const extraHeaders = JSON.parse(config.extraHeaders || '{}') as Record<string, string>

  const res = await fetch(`${config.providerUrl.replace(/\/$/, '')}/${externalId}/status`, {
    headers: { Authorization: `Bearer ${config.apiKey}`, ...extraHeaders },
  })

  if (!res.ok) throw new Error(`Error consultando estado (${res.status})`)
  return res.json() as Promise<{ status: string; signedAt?: string }>
}
```

- [ ] **Step 2: Create `src/app/api/documentos/[id]/enviar-firma/route.ts`**

This route handles both POST (send to sign) and PATCH (check status):

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { logAction } from '@/lib/audit'
import { sendToSign, checkSignatureStatus } from '@/lib/signature'

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const doc = await prisma.document.findUnique({ where: { id: Number(params.id) } })
  if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  try {
    const externalId = await sendToSign(doc.id, doc.filePath, doc.nombreArchivo)
    await prisma.document.update({
      where: { id: doc.id },
      data: { estado: 'ENVIADO_A_FIRMA', firmaExternalId: externalId },
    })
    await logAction(user.userId, 'ENVIAR_FIRMA', 'Documento', `ID externo: ${externalId}`)
    return NextResponse.json({ ok: true, externalId })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error desconocido'
    await prisma.document.update({ where: { id: doc.id }, data: { estado: 'ERROR' } })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const doc = await prisma.document.findUnique({ where: { id: Number(params.id) } })
  if (!doc || !doc.firmaExternalId) {
    return NextResponse.json({ error: 'Documento sin ID externo de firma' }, { status: 400 })
  }

  try {
    const result = await checkSignatureStatus(doc.firmaExternalId)
    let newEstado = doc.estado

    if (result.status === 'signed' || result.status === 'firmado') {
      newEstado = 'FIRMADO'
    } else if (result.status === 'rejected' || result.status === 'rechazado') {
      newEstado = 'RECHAZADO'
    }

    await prisma.document.update({
      where: { id: doc.id },
      data: {
        estado: newEstado,
        fechaFirma: newEstado === 'FIRMADO' ? (result.signedAt ? new Date(result.signedAt) : new Date()) : undefined,
      },
    })

    return NextResponse.json({ ok: true, estado: newEstado, raw: result })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 3: Create `src/app/api/configuracion/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const config = await prisma.signatureConfig.findFirst()
  return NextResponse.json(config ?? { providerUrl: '', apiKey: '', extraHeaders: '{}' })
}

export async function PUT(req: NextRequest) {
  const { providerUrl, apiKey, extraHeaders } = await req.json()
  const existing = await prisma.signatureConfig.findFirst()

  const data = { providerUrl, apiKey, extraHeaders: extraHeaders || '{}' }

  const config = existing
    ? await prisma.signatureConfig.update({ where: { id: existing.id }, data })
    : await prisma.signatureConfig.create({ data })

  return NextResponse.json(config)
}
```

- [ ] **Step 4: Create `src/app/admin/configuracion/page.tsx`**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { AdminHeader } from '@/components/layout/AdminHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function ConfiguracionPage() {
  const [form, setForm] = useState({ providerUrl: '', apiKey: '', extraHeaders: '{}' })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/configuracion').then(r => r.json()).then(data => {
      if (data) setForm({ providerUrl: data.providerUrl || '', apiKey: data.apiKey || '', extraHeaders: data.extraHeaders || '{}' })
    })
  }, [])

  async function handleSave() {
    await fetch('/api/configuracion', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <>
      <AdminHeader title="Configuración" />
      <div className="p-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Proveedor de Firma Electrónica</CardTitle>
            <CardDescription>
              Configurá los datos de conexión con tu proveedor. Los documentos se envían vía API REST.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>URL del endpoint de firma</Label>
              <Input
                placeholder="https://proveedor.com/api/sign"
                value={form.providerUrl}
                onChange={e => setForm(f => ({ ...f, providerUrl: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                POST a esta URL con el PDF en base64. GET a esta URL/{`{id}`}/status para consultar.
              </p>
            </div>
            <div>
              <Label>API Key</Label>
              <Input
                type="password"
                placeholder="sk-••••••••••••••••"
                value={form.apiKey}
                onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
              />
            </div>
            <div>
              <Label>Headers adicionales (JSON)</Label>
              <Textarea
                rows={4}
                placeholder='{"X-Custom-Header": "valor"}'
                value={form.extraHeaders}
                onChange={e => setForm(f => ({ ...f, extraHeaders: e.target.value }))}
                className="font-mono text-sm"
              />
            </div>
            <Button
              className="bg-green-700 hover:bg-green-800"
              onClick={handleSave}
            >
              {saved ? '✓ Guardado' : 'Guardar Configuración'}
            </Button>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-sm">Contrato esperado del proveedor</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted rounded p-3 overflow-auto">{`// POST {providerUrl}
// Headers: Authorization: Bearer {apiKey} + extraHeaders
// Body:
{
  "documentId": "123",
  "fileName": "recibo-enero.pdf",
  "fileContent": "<base64>"
}
// Response esperada:
{ "id": "<externalId>" }

// GET {providerUrl}/{externalId}/status
// Response esperada:
{ "status": "signed" | "pending" | "rejected", "signedAt": "ISO date" }`}
            </pre>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
```

- [ ] **Step 5: Verify**

Open /admin/configuracion → fill in a provider URL and API key, save. Then go to /admin/documentos and try "Firmar" on a document — should fail with a descriptive error (since the provider isn't real), but the error message should display correctly. Document state should update to ERROR.

---

## Task 9: Admin Dashboard

**Files:**
- Create: `src/app/api/dashboard/route.ts`
- Create: `src/components/dashboard/KPICards.tsx`
- Create: `src/components/dashboard/Charts.tsx`
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Create `src/app/api/dashboard/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const [
    totalEmpleados, activos, inactivos,
    totalDocs, docsByEstado, empByCategoria,
  ] = await Promise.all([
    prisma.employee.count(),
    prisma.employee.count({ where: { estado: 'ACTIVO' } }),
    prisma.employee.count({ where: { estado: 'INACTIVO' } }),
    prisma.document.count(),
    prisma.document.groupBy({ by: ['estado'], _count: true }),
    prisma.employee.groupBy({ by: ['categoriaId'], _count: true, where: { estado: 'ACTIVO' } }),
  ])

  const categories = await prisma.category.findMany()
  const catMap = Object.fromEntries(categories.map(c => [c.id, c.nombre]))

  const documentsByEstado = Object.fromEntries(docsByEstado.map(d => [d.estado, d._count]))

  return NextResponse.json({
    totalEmpleados,
    activos,
    inactivos,
    totalDocs,
    pendientes: documentsByEstado['PENDIENTE_ENVIO'] ?? 0,
    enviadosAFirma: documentsByEstado['ENVIADO_A_FIRMA'] ?? 0,
    firmados: documentsByEstado['FIRMADO'] ?? 0,
    rechazados: documentsByEstado['RECHAZADO'] ?? 0,
    borradores: documentsByEstado['BORRADOR'] ?? 0,
    empleadosPorCategoria: empByCategoria.map(e => ({
      nombre: catMap[e.categoriaId] ?? 'N/A',
      cantidad: e._count,
    })),
    documentosPorEstado: [
      { name: 'Firmados', value: documentsByEstado['FIRMADO'] ?? 0, color: '#16a34a' },
      { name: 'Enviados', value: documentsByEstado['ENVIADO_A_FIRMA'] ?? 0, color: '#2563eb' },
      { name: 'Pendientes', value: documentsByEstado['PENDIENTE_ENVIO'] ?? 0, color: '#ca8a04' },
      { name: 'Borradores', value: documentsByEstado['BORRADOR'] ?? 0, color: '#6b7280' },
      { name: 'Rechazados', value: documentsByEstado['RECHAZADO'] ?? 0, color: '#dc2626' },
    ],
  })
}
```

- [ ] **Step 2: Create `src/components/dashboard/KPICards.tsx`**

```typescript
interface KPI { label: string; value: number; color?: string }

export function KPICards({ data }: { data: Record<string, number> }) {
  const kpis: KPI[] = [
    { label: 'Total Empleados', value: data.totalEmpleados },
    { label: 'Activos', value: data.activos, color: 'text-green-700' },
    { label: 'Inactivos', value: data.inactivos, color: 'text-gray-500' },
    { label: 'Total Recibos', value: data.totalDocs },
    { label: 'Firmados', value: data.firmados, color: 'text-green-700' },
    { label: 'En Firma', value: data.enviadosAFirma, color: 'text-blue-600' },
    { label: 'Pendientes', value: data.pendientes, color: 'text-yellow-600' },
    { label: 'Rechazados', value: data.rechazados, color: 'text-red-600' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {kpis.map(kpi => (
        <div key={kpi.label} className="bg-white rounded-lg border p-4 shadow-sm">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
          <p className={`text-3xl font-bold mt-1 ${kpi.color ?? 'text-green-900'}`}>{kpi.value}</p>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create `src/components/dashboard/Charts.tsx`**

```typescript
'use client'

import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface Props {
  documentosPorEstado: Array<{ name: string; value: number; color: string }>
  empleadosPorCategoria: Array<{ nombre: string; cantidad: number }>
}

export function Charts({ documentosPorEstado, empleadosPorCategoria }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
      <div className="bg-white rounded-lg border p-4 shadow-sm">
        <h3 className="font-semibold text-green-900 mb-4">Estado de Documentos</h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={documentosPorEstado} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
              {documentosPorEstado.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-white rounded-lg border p-4 shadow-sm">
        <h3 className="font-semibold text-green-900 mb-4">Empleados por Categoría</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={empleadosPorCategoria} margin={{ left: -20 }}>
            <XAxis dataKey="nombre" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="cantidad" fill="#16a34a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Replace `src/app/admin/page.tsx`**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { AdminHeader } from '@/components/layout/AdminHeader'
import { KPICards } from '@/components/dashboard/KPICards'
import { Charts } from '@/components/dashboard/Charts'

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    fetch('/api/dashboard').then(r => r.json()).then(setData)
  }, [])

  return (
    <>
      <AdminHeader title="Dashboard" />
      <div className="p-6">
        {data ? (
          <>
            <KPICards data={data} />
            <Charts
              documentosPorEstado={data.documentosPorEstado}
              empleadosPorCategoria={data.empleadosPorCategoria}
            />
          </>
        ) : (
          <p className="text-muted-foreground">Cargando...</p>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 5: Verify**

Open /admin → should show 8 KPI cards with real data and 2 charts. If no documents exist yet, charts will show empty/zero state (fine for demo).

---

## Task 10: Audit Log

**Files:**
- Create: `src/app/api/auditoria/route.ts`
- Create: `src/app/admin/auditoria/page.tsx`

- [ ] **Step 1: Create `src/app/api/auditoria/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { user: { select: { email: true } } },
  })
  return NextResponse.json(logs)
}
```

- [ ] **Step 2: Create `src/app/admin/auditoria/page.tsx`**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { AdminHeader } from '@/components/layout/AdminHeader'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface Log {
  id: number; accion: string; entidad: string; detalle?: string; createdAt: string
  user: { email: string }
}

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<Log[]>([])

  useEffect(() => {
    fetch('/api/auditoria').then(r => r.json()).then(setLogs)
  }, [])

  return (
    <>
      <AdminHeader title="Auditoría" />
      <div className="p-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Entidad</TableHead>
              <TableHead>Detalle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map(log => (
              <TableRow key={log.id}>
                <TableCell className="text-sm whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString('es-AR')}
                </TableCell>
                <TableCell className="text-sm">{log.user.email}</TableCell>
                <TableCell>
                  <span className="px-2 py-0.5 bg-green-50 text-green-800 rounded text-xs font-mono">
                    {log.accion}
                  </span>
                </TableCell>
                <TableCell className="text-sm">{log.entidad}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{log.detalle}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
```

- [ ] **Step 3: Verify**

After performing actions (create employee, upload document, send to sign), open /admin/auditoria → should show log entries.

---

## Task 11: Employee Portal

**Files:**
- Create: `src/app/empleado/layout.tsx`
- Create: `src/components/empleado/MisRecibos.tsx`
- Create: `src/app/empleado/page.tsx`

- [ ] **Step 1: Create `src/app/empleado/layout.tsx`**

```typescript
import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import LogoutButton from '@/components/empleado/LogoutButton'

export default async function EmpleadoLayout({ children }: { children: React.ReactNode }) {
  const token = cookies().get(COOKIE_NAME)?.value
  if (!token) redirect('/login')

  return (
    <div className="min-h-screen bg-green-50">
      <header className="bg-green-900 text-white px-6 py-4 flex items-center justify-between">
        <span className="font-bold text-lg">📋 Portal del Empleado</span>
        <LogoutButton />
      </header>
      <main className="max-w-4xl mx-auto py-8 px-4">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/empleado/LogoutButton.tsx`**

```typescript
'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

export default function LogoutButton() {
  const router = useRouter()
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }
  return (
    <Button variant="ghost" size="sm" onClick={logout} className="text-white hover:text-white hover:bg-green-800">
      <LogOut size={16} className="mr-1" /> Salir
    </Button>
  )
}
```

- [ ] **Step 3: Create `src/components/empleado/MisRecibos.tsx`**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { FileText, Download } from 'lucide-react'

interface Doc {
  id: number; nombreArchivo: string; periodo: string; estado: string
  fechaCarga: string; fechaFirma?: string
}

const estadoLabel: Record<string, string> = {
  BORRADOR: 'Borrador', PENDIENTE_ENVIO: 'Pendiente', ENVIADO_A_FIRMA: 'Enviado a firma',
  FIRMADO: 'Firmado', RECHAZADO: 'Rechazado', ERROR: 'Error',
}

const estadoColor: Record<string, string> = {
  BORRADOR: 'text-gray-500', PENDIENTE_ENVIO: 'text-yellow-600', ENVIADO_A_FIRMA: 'text-blue-600',
  FIRMADO: 'text-green-700 font-medium', RECHAZADO: 'text-red-600', ERROR: 'text-orange-600',
}

interface Props { employeeId: number }

export function MisRecibos({ employeeId }: Props) {
  const [docs, setDocs] = useState<Doc[]>([])

  useEffect(() => {
    fetch(`/api/documentos?employeeId=${employeeId}`)
      .then(r => r.json())
      .then(setDocs)
  }, [employeeId])

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Período</TableHead>
          <TableHead>Archivo</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Fecha Firma</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {docs.length === 0 && (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
              No tenés recibos cargados aún.
            </TableCell>
          </TableRow>
        )}
        {docs.map(doc => (
          <TableRow key={doc.id}>
            <TableCell className="font-mono">{doc.periodo}</TableCell>
            <TableCell>{doc.nombreArchivo}</TableCell>
            <TableCell className={estadoColor[doc.estado] ?? ''}>
              {estadoLabel[doc.estado] ?? doc.estado}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {doc.fechaFirma ? new Date(doc.fechaFirma).toLocaleDateString('es-AR') : '—'}
            </TableCell>
            <TableCell className="text-right space-x-1">
              <a href={`/api/documentos/${doc.id}/archivo`} target="_blank">
                <Button size="sm" variant="outline"><FileText size={14} /></Button>
              </a>
              <a href={`/api/documentos/${doc.id}/archivo`} download={doc.nombreArchivo}>
                <Button size="sm" variant="outline"><Download size={14} /></Button>
              </a>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 4: Create `src/app/empleado/page.tsx`**

```typescript
import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MisRecibos } from '@/components/empleado/MisRecibos'
import { Badge } from '@/components/ui/badge'

export default async function EmpleadoPage() {
  const token = cookies().get(COOKIE_NAME)?.value
  if (!token) redirect('/login')

  const decoded = await verifyToken(token)
  if (!decoded.employeeId) redirect('/login')

  const employee = await prisma.employee.findUnique({
    where: { id: decoded.employeeId },
    include: { categoria: true },
  })
  if (!employee) redirect('/login')

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-green-900">
            {employee.apellido}, {employee.nombre}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {[
              ['Legajo', employee.legajo],
              ['CUIL', employee.cuil],
              ['Email', employee.email],
              ['Categoría', employee.categoria.nombre],
              ['Fecha de Ingreso', new Date(employee.fechaIngreso).toLocaleDateString('es-AR')],
              ['Estado', employee.estado],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-green-900">Mis Recibos de Sueldo</CardTitle>
        </CardHeader>
        <CardContent>
          <MisRecibos employeeId={decoded.employeeId} />
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 5: Verify**

Login as `juan.garcia@empresa.com` / `empleado123` → should see employee profile card and (empty) receipts table. Upload a document from admin for that employee → it should appear here. PDF view and download should work.

---

## Self-Review Checklist

- [x] **Spec coverage:** Dashboard ✓, Empleados CRUD ✓, Categorías ✓, Documentos ✓, Firma electrónica configurable ✓, Dashboard empleado ✓, Auditoría ✓, Auth JWT ✓, Roles ADMIN/EMPLOYEE ✓
- [x] **No placeholders:** All code blocks are complete
- [x] **Type consistency:** `TokenPayload` used consistently in auth.ts, middleware, and getCurrentUser(); `params.id` cast to `Number()` consistently in all `[id]` routes
- [x] **Skipped by design (demo scope):** Excel import/export, bulk PDF upload, monthly chart, email notifications, password recovery

---

## Credentials Summary

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@empresa.com | admin123 |
| Empleado | juan.garcia@empresa.com | empleado123 |
| Empleado | maria.lopez@empresa.com | empleado123 |
