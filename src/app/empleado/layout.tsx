import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { EmpleadoSidebar } from '@/components/empleado/EmpleadoSidebar'

export default async function EmpleadoLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) redirect('/login')

  const decoded = await verifyToken(token)
  if (!decoded.employeeId) redirect('/login')

  const [config, employee, dbUser] = await Promise.all([
    prisma.generalConfig.findFirst(),
    prisma.employee.findUnique({
      where: { id: decoded.employeeId },
      select: { nombre: true, apellido: true },
    }),
    prisma.user.findUnique({ where: { employeeId: decoded.employeeId }, select: { avatarUrl: true } }),
  ])
  if (!employee) redirect('/login')

  const initials = `${employee.nombre[0]}${employee.apellido[0]}`.toUpperCase()
  const fullName = `${employee.nombre} ${employee.apellido}`

  return (
    <div className="flex min-h-screen bg-background">
      <EmpleadoSidebar
        appName={config?.appName ?? 'RRHH'}
        logoUrl={config?.logoUrl ?? null}
        initials={initials}
        fullName={fullName}
        avatarUrl={dbUser?.avatarUrl ?? null}
        isAdmin={decoded.role === 'ADMIN'}
      />
      <main className="flex-1 flex flex-col overflow-hidden pt-14 md:pt-0">
        {children}
      </main>
    </div>
  )
}
