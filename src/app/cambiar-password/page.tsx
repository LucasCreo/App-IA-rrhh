import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { CambiarPasswordForm } from './CambiarPasswordForm'

export default async function CambiarPasswordPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) redirect('/login')

  const decoded = await verifyToken(token).catch(() => null)
  if (!decoded) redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { passwordTemporal: true, role: true },
  })
  if (!dbUser) redirect('/login')

  // Si ya no es temporal, no tiene sentido esta pantalla
  if (!dbUser.passwordTemporal) {
    redirect(dbUser.role === 'ADMIN' ? '/admin' : '/empleado')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      <div className="w-full max-w-sm">
        <h2 className="text-2xl font-bold text-foreground mb-2">Cambiá tu contraseña</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Estás usando una contraseña temporal. Elegí una nueva para continuar.
        </p>
        <CambiarPasswordForm redirectTo={dbUser.role === 'ADMIN' ? '/admin' : '/empleado'} />
      </div>
    </div>
  )
}
