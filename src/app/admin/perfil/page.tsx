import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { Shield } from 'lucide-react'
import { AvatarUpload } from '@/components/shared/AvatarUpload'
import { CambiarPasswordButton } from '@/components/empleado/CambiarPasswordButton'

export default async function AdminPerfilPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) redirect('/login')

  const decoded = await verifyToken(token)
  if (!decoded || decoded.role !== 'ADMIN') redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { email: true, avatarUrl: true, role: true },
  })
  if (!dbUser) redirect('/login')

  const initials = dbUser.email.slice(0, 2).toUpperCase()

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b border-border bg-background flex items-center px-6">
        <h1 className="font-semibold text-green-900 dark:text-green-400">Mi Perfil</h1>
      </header>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* Cuenta */}
        <div className="rounded-xl border bg-card shadow-sm p-5">
          <div className="flex items-center gap-4 mb-5">
            <AvatarUpload initials={initials} initialAvatar={dbUser.avatarUrl} size="lg" />
            <div>
              <p className="font-semibold text-lg">{dbUser.email}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Shield size={12} className="text-green-700 dark:text-green-400" />
                <span className="text-sm text-muted-foreground">Administrador</span>
              </div>
            </div>
          </div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Datos de la cuenta</p>
          <dl className="text-sm space-y-3">
            <div>
              <dt className="text-xs text-muted-foreground mb-0.5">Email / usuario</dt>
              <dd className="font-medium">{dbUser.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground mb-0.5">Rol</dt>
              <dd className="font-medium text-green-700 dark:text-green-400">Administrador</dd>
            </div>
          </dl>
        </div>

        {/* Seguridad */}
        <div className="rounded-xl border bg-card shadow-sm p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Seguridad</p>
            <p className="text-sm text-muted-foreground mt-1">Cambiá tu contraseña de acceso</p>
          </div>
          <CambiarPasswordButton />
        </div>
      </div>
    </div>
  )
}
