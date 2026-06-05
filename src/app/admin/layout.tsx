import { prisma } from '@/lib/prisma'
import { AdminSidebar } from '@/components/layout/AdminSidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const config = await prisma.generalConfig.findFirst()
  const brand = config?.primaryColor ?? '#166534'
  return (
    <div
      className="flex min-h-screen bg-gray-50"
      style={{ '--brand': brand } as React.CSSProperties}
    >
      <AdminSidebar
        appName={config?.appName ?? 'RRHH'}
        logoUrl={config?.logoUrl ?? null}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  )
}
