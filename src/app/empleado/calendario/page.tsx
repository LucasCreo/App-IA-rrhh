import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { CalendarioView } from '@/components/calendario/CalendarioView'

export default async function CalendarioEmpleadoPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) redirect('/login')
  const decoded = await verifyToken(token)
  if (!decoded.employeeId) redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { googleRefreshToken: true, googleLastSync: true },
  })

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b border-border bg-background flex items-center px-6 justify-between">
        <h1 className="font-semibold text-green-900 dark:text-green-400">Calendario</h1>
        {dbUser?.googleRefreshToken && dbUser.googleLastSync && (
          <span className="text-xs text-muted-foreground" suppressHydrationWarning>
            Sincronizado con Google · {new Date(dbUser.googleLastSync).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </header>
      <div className="flex-1 overflow-hidden">
        <CalendarioView
          currentUserId={decoded.userId}
          currentEmployeeId={decoded.employeeId}
          googleConnected={!!dbUser?.googleRefreshToken}
        />
      </div>
    </div>
  )
}
