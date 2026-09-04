import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PerfilContent } from '@/components/perfil/PerfilContent'

export default async function AdminPerfilPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) redirect('/login')

  const decoded = await verifyToken(token)
  if (!decoded || decoded.role !== 'ADMIN') redirect('/login')

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b border-border bg-background flex items-center px-6">
        <h1 className="font-semibold text-green-900 dark:text-green-400">Mi Perfil</h1>
      </header>
      <PerfilContent
        userId={decoded.userId}
        employeeId={decoded.employeeId}
        role={decoded.role}
      />
    </div>
  )
}
