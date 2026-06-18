import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { MisRecibos } from '@/components/empleado/MisRecibos'

export default async function RecibosPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) redirect('/login')

  const decoded = await verifyToken(token)
  if (!decoded.employeeId) redirect('/login')

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b border-border bg-background flex items-center px-6">
        <h1 className="font-semibold text-green-900 dark:text-green-400">Recibos de sueldo</h1>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <MisRecibos employeeId={decoded.employeeId} />
        </div>
      </div>
    </div>
  )
}
