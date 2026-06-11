import { cookies } from 'next/headers'
import { COOKIE_NAME } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import LogoutButton from '@/components/empleado/LogoutButton'

export default async function EmpleadoLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) redirect('/login')

  const config = await prisma.generalConfig.findFirst()
  const appName = config?.appName ?? 'RRHH'

  return (
    <div className="min-h-screen bg-green-50 dark:bg-gray-950">
      <header className="bg-green-900 text-white px-6 py-4 flex items-center justify-between">
        <span className="font-bold text-lg">📋 Portal — {appName}</span>
        <LogoutButton />
      </header>
      <main className="max-w-4xl mx-auto py-8 px-4">
        {children}
      </main>
    </div>
  )
}
