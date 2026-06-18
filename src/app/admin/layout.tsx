import { prisma } from '@/lib/prisma'
import { AdminSidebar } from '@/components/layout/AdminSidebar'
import { getCurrentUser } from '@/lib/auth'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  const [config, dbUser, pendingModificaciones, pendingSolicitudes] = await Promise.all([
    prisma.generalConfig.findFirst(),
    user ? prisma.user.findUnique({ where: { id: user.userId }, select: { avatarUrl: true } }) : null,
    prisma.solicitudModificacion.count({ where: { estado: 'PENDIENTE' } }),
    prisma.solicitudDocumento.count({ where: { estado: 'PENDIENTE' } }),
  ])
  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar
        appName={config?.appName ?? 'RRHH'}
        logoUrl={config?.logoUrl ?? null}
        userEmail={user?.email ?? ''}
        avatarUrl={dbUser?.avatarUrl ?? null}
        pendingModificaciones={pendingModificaciones}
        pendingSolicitudes={pendingSolicitudes}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  )
}
