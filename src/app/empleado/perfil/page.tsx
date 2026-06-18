import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { CalendarDays, Tag, Hash } from 'lucide-react'
import { CambiarPasswordButton } from '@/components/empleado/CambiarPasswordButton'
import { SolicitarModificacion } from '@/components/empleado/SolicitarModificacion'

export default async function PerfilPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) redirect('/login')

  const decoded = await verifyToken(token)
  if (!decoded.employeeId) redirect('/login')

  const employee = await prisma.employee.findUnique({
    where: { id: decoded.employeeId },
    include: {
      categoria: true,
      valoresCampos: { include: { campo: true } },
    },
  })
  if (!employee) redirect('/login')

  const customFields = employee.valoresCampos.filter(v => v.campo.visible && !v.campo.eliminado)

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b border-border bg-background flex items-center px-6">
        <h1 className="font-semibold text-green-900 dark:text-green-400">Mi Perfil</h1>
      </header>

      <div className="flex-1 overflow-auto p-6 space-y-5 max-w-2xl">
        {/* Datos básicos */}
        <div className="rounded-xl border bg-card shadow-sm p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Datos personales</p>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground mb-0.5">Nombre completo</dt>
              <dd className="font-medium">{employee.nombre} {employee.apellido}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1"><Hash size={10} /> Legajo</dt>
              <dd className="font-mono font-medium">{employee.legajo}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1"><Tag size={10} /> Categoría</dt>
              <dd className="font-medium">{employee.categoria.nombre}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground mb-0.5">Estado</dt>
              <dd className={employee.estado === 'ACTIVO' ? 'font-medium text-green-700 dark:text-green-400' : 'font-medium text-red-600'}>
                {employee.estado}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1"><CalendarDays size={10} /> Fecha de ingreso</dt>
              <dd className="font-medium">
                {new Date(employee.fechaIngreso).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </dd>
            </div>
            {employee.email && (
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground mb-0.5">Email</dt>
                <dd className="font-medium">{employee.email}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Campos personalizados */}
        {customFields.length > 0 && (
          <div className="rounded-xl border bg-card shadow-sm p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Información adicional</p>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
              {customFields.map(v => (
                <div key={v.id} className={v.campo.tipo === 'archivo' ? 'col-span-2' : ''}>
                  <dt className="text-xs text-muted-foreground mb-0.5">{v.campo.nombre}</dt>
                  <dd className="font-medium">
                    {v.campo.tipo === 'booleano'
                      ? (v.valor === 'true' ? 'Sí' : 'No')
                      : v.campo.tipo === 'archivo'
                        ? <a href={`/api/campos/archivo?file=${v.valor}`} target="_blank" className="text-blue-600 hover:underline text-sm">Ver archivo</a>
                        : v.campo.tipo === 'fecha'
                          ? new Date(v.valor).toLocaleDateString('es-AR')
                          : v.valor}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {/* Seguridad */}
        <div className="rounded-xl border bg-card shadow-sm p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Seguridad</p>
            <p className="text-sm text-muted-foreground mt-1">Cambiá tu contraseña de acceso</p>
          </div>
          <CambiarPasswordButton />
        </div>

        {/* Solicitar modificación */}
        <SolicitarModificacion />
      </div>
    </div>
  )
}
