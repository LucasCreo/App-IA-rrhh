'use client'

import { CalendarDays, Tag, Hash } from 'lucide-react'
import { AvatarDisplay } from '@/components/shared/AvatarDisplay'
import { SolicitarModificacion } from '@/components/empleado/SolicitarModificacion'

interface CampoValor { id: number; valor: string; campo: { nombre: string; tipo: string; visible: boolean } }
interface Empleado {
  nombre: string; apellido: string; legajo: string; email: string
  telefono?: string | null; cuil: string; estado: string
  fechaIngreso: string
  categoria: { nombre: string }
  valoresCampos: CampoValor[]
}

interface Props {
  employee: Empleado
  avatarUrl?: string | null
  avatarBgColor?: string | null
  avatarTextColor?: string | null
}

export function MiLegajoDatos({ employee, avatarUrl, avatarBgColor, avatarTextColor }: Props) {
  const customFields = employee.valoresCampos.filter(v => v.campo.visible)
  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="rounded-xl border bg-card shadow-sm p-5">
        <div className="flex items-center gap-4 mb-5">
          <AvatarDisplay
            iniciales={`${employee.nombre[0] ?? ''}${employee.apellido[0] ?? ''}`}
            avatarUrl={avatarUrl}
            bgColor={avatarBgColor}
            textColor={avatarTextColor}
            size={56}
          />
          <div className="min-w-0">
            <p className="font-semibold text-lg truncate">{employee.nombre} {employee.apellido}</p>
            <p className="text-sm text-muted-foreground truncate">{employee.categoria.nombre}</p>
          </div>
        </div>
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
            <dt className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1"><Tag size={10} /> Categoría</dt>
            <dd className="font-medium">{employee.categoria.nombre}</dd>
          </div>
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

      {/* Solicitar modificación */}
      <SolicitarModificacion />
    </div>
  )
}
