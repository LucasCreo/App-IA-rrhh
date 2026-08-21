import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { AdminSidebar } from '@/components/layout/AdminSidebar'
import { getCurrentUser } from '@/lib/auth'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  const [config, dbUser, pendingModificaciones, pendingSolicitudesDoc, pendingSolicitudesAus] = await Promise.all([
    prisma.generalConfig.findFirst(),
    user ? prisma.user.findUnique({
      where: { id: user.userId },
      select: { avatarUrl: true, avatarBgColor: true, avatarTextColor: true, passwordTemporal: true, permisos: { select: { permiso: true } } },
    }) : null,
    prisma.solicitudModificacion.count({ where: { estado: 'PENDIENTE' } }),
    prisma.solicitudDocumento.count({ where: { estado: 'PENDIENTE' } }),
    prisma.solicitudAusencia.count({ where: { estado: 'PENDIENTE' } }),
  ])
  if (dbUser?.passwordTemporal) redirect('/cambiar-password')

  // null = acceso total; array vacío o con items = restrictivo
  const permisos: string[] | null = (dbUser?.permisos?.length ?? 0) > 0
    ? dbUser!.permisos.map(p => p.permiso)
    : null

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar
        appName={config?.appName ?? 'RRHH'}
        logoUrl={config?.logoUrl ?? null}
        userEmail={user?.email ?? ''}
        avatarUrl={dbUser?.avatarUrl ?? null}
        avatarBgColor={dbUser?.avatarBgColor ?? null}
        avatarTextColor={dbUser?.avatarTextColor ?? null}
        pendingModificaciones={pendingModificaciones}
        pendingSolicitudes={pendingSolicitudesDoc}
        pendingLicencias={pendingSolicitudesAus}
        permisos={permisos}
        hasEmployeeId={!!user?.employeeId}
      />
      <main className="flex-1 flex flex-col overflow-hidden pt-14 md:pt-0">
        {children}
      </main>
    </div>
  )
}
