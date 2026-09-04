import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { CalendarDays, Tag, Hash, BookOpen, ArrowRight, Shield } from 'lucide-react'
import { AvatarUpload } from '@/components/shared/AvatarUpload'
import { CambiarPasswordButton } from '@/components/empleado/CambiarPasswordButton'
import { SolicitarModificacion } from '@/components/empleado/SolicitarModificacion'
import { GoogleCalendarSync } from '@/components/empleado/GoogleCalendarSync'

interface Props {
  userId: number
  employeeId?: number | null
  role: 'ADMIN' | 'EMPLOYEE'
}

export async function PerfilContent({ userId, employeeId, role }: Props) {
  const [dbUser, employee] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true, avatarUrl: true, avatarBgColor: true, avatarTextColor: true, role: true,
        googleRefreshToken: true, googleLastSync: true,
      },
    }),
    employeeId
      ? prisma.employee.findUnique({
          where: { id: employeeId },
          include: { area: true, categoria: true, valoresCampos: { include: { campo: true } } },
        })
      : Promise.resolve(null),
  ])
  if (!dbUser) return null

  const initials = employee
    ? `${employee.nombre[0]}${employee.apellido[0]}`.toUpperCase()
    : dbUser.email.slice(0, 2).toUpperCase()

  const nombreVisible = employee ? `${employee.nombre} ${employee.apellido}` : dbUser.email
  const subtituloVisible = employee?.categoria.nombre ?? (role === 'ADMIN' ? 'Administrador' : '')
  const customFields = employee?.valoresCampos.filter(v => v.campo.visible) ?? []

  return (
    <div className="flex-1 overflow-auto p-6 space-y-5">
      {/* Header con avatar */}
      <div className="rounded-xl border bg-card shadow-sm p-5">
        <div className="flex items-center gap-4 mb-5">
          <AvatarUpload
            initials={initials}
            initialAvatar={dbUser.avatarUrl}
            initialBgColor={dbUser.avatarBgColor}
            initialTextColor={dbUser.avatarTextColor}
            size="lg"
          />
          <div>
            <p className="font-semibold text-lg">{nombreVisible}</p>
            {subtituloVisible && (
              <p className="text-sm text-muted-foreground">{subtituloVisible}</p>
            )}
            {dbUser.role === 'ADMIN' && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <Shield size={12} className="text-green-700 dark:text-green-400" />
                <span className="text-xs text-green-700 dark:text-green-400 font-medium">Administrador</span>
              </div>
            )}
          </div>
        </div>

        {employee ? (
          <>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Datos personales</p>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 sm:gap-x-8 gap-y-4 text-sm">
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground mb-0.5">Nombre completo</dt>
                <dd className="font-medium">{employee.nombre} {employee.apellido}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1"><Hash size={10} /> Legajo</dt>
                <dd className="font-mono font-medium">{employee.legajo}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground mb-0.5">Estado</dt>
                <dd className={employee.estado === 'ACTIVO' ? 'font-medium text-green-700 dark:text-green-400' : 'font-medium text-red-600'}>
                  {employee.estado}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground mb-0.5">Área</dt>
                <dd className="font-medium">{employee.area?.nombre ?? '—'}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1"><Tag size={10} /> Categoría</dt>
                <dd className="font-medium">{employee.categoria.nombre}</dd>
              </div>
              {employee.puesto && (
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground mb-0.5">Puesto</dt>
                  <dd className="font-medium">{employee.puesto}</dd>
                </div>
              )}
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1"><CalendarDays size={10} /> Fecha de ingreso</dt>
                <dd className="font-medium">
                  {new Date(employee.fechaIngreso).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground mb-0.5">CUIL</dt>
                <dd className="font-mono font-medium">{employee.cuil}</dd>
              </div>
              {employee.telefono && (
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground mb-0.5">Teléfono</dt>
                  <dd className="font-medium">{employee.telefono}</dd>
                </div>
              )}
              {employee.email && (
                <div className="col-span-4">
                  <dt className="text-xs text-muted-foreground mb-0.5">Email</dt>
                  <dd className="font-medium break-all">{employee.email}</dd>
                </div>
              )}
            </dl>
          </>
        ) : (
          <>
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
          </>
        )}
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

      {/* Bloques disponibles sólo si el user tiene ficha de empleado */}
      {employee && (
        <>
          <GoogleCalendarSync connected={!!dbUser.googleRefreshToken} lastSync={dbUser.googleLastSync?.toISOString()} />
          <SolicitarModificacion />
        </>
      )}

      {/* Manual (sólo hay del empleado por ahora) */}
      {employee && (
        <Link
          href="/manual/empleado"
          className="rounded-xl border bg-card shadow-sm p-5 flex items-center justify-between hover:bg-muted/40 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <BookOpen size={20} className="text-muted-foreground" />
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Manual de uso</p>
              <p className="text-sm text-muted-foreground mt-1">Guía para usar el portal del empleado</p>
            </div>
          </div>
          <ArrowRight size={16} className="text-muted-foreground group-hover:text-foreground transition-colors" />
        </Link>
      )}
    </div>
  )
}
