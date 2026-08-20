import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { MisDocumentos } from '@/components/empleado/MisDocumentos'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function DocumentosPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) redirect('/login')

  const decoded = await verifyToken(token)
  if (!decoded.employeeId) redirect('/login')

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b border-border bg-background flex items-center px-6 gap-3">
        <Link href="/empleado" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="font-semibold text-green-900 dark:text-green-400">Documentos</h1>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <MisDocumentos />
      </div>
    </div>
  )
}
