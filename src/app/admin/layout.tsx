import { prisma } from '@/lib/prisma'
import { AdminSidebar } from '@/components/layout/AdminSidebar'
import { getCurrentUser } from '@/lib/auth'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  const [config, dbUser, pendingModificaciones, pendingSolicitudes] = await Promise.all([
    prisma.generalConfig.findFirst(),
    user ? prisma.user.findUnique({ where: { id: user.userId }, select: { avatarUrl: true, rolId: true } }) : null,
    prisma.solicitudModificacion.count({ where: { estado: 'PENDIENTE' } }),
    prisma.solicitudDocumento.count({ where: { estado: 'PENDIENTE' } }),
  ])

  let permisos: string[] | null = null // null = full access
  if (dbUser?.rolId) {
    const rps = await prisma.rolPermiso.findMany({ where: { rolId: dbUser.rolId }, select: { permiso: true } })
    permisos = rps.map(r => r.permiso)
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar
        appName={config?.appName ?? 'RRHH'}
        logoUrl={config?.logoUrl ?? null}
        userEmail={user?.email ?? ''}
        avatarUrl={dbUser?.avatarUrl ?? null}
        pendingModificaciones={pendingModificaciones}
        pendingSolicitudes={pendingSolicitudes}
        permisos={permisos}
      />
      <main className="flex-1 flex flex-col overflow-hidden pt-14 md:pt-0">
        {children}
      </main>
    </div>
  )
}
