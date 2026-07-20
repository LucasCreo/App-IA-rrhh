'use client'

import Link from 'next/link'
import { FileText, CalendarOff, UserPen, Clock } from 'lucide-react'
import { AvatarDisplay } from '@/components/shared/AvatarDisplay'

interface Props {
  me: {
    nombre: string
    apellido: string
    email: string
    avatarUrl: string | null
    avatarBgColor?: string | null
    avatarTextColor?: string | null
  }
  pendingSolicitudesDoc: number
  pendingSolicitudesMod: number
  pendingAusencias: number
}

function saludo(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function fechaLarga(): string {
  return new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export function WelcomeCard({ me, pendingSolicitudesDoc, pendingSolicitudesMod, pendingAusencias }: Props) {
  const totalPendientes = pendingSolicitudesDoc + pendingSolicitudesMod + pendingAusencias
  const iniciales = me.apellido
    ? `${me.nombre[0]}${me.apellido[0]}`.toUpperCase()
    : me.nombre.slice(0, 2).toUpperCase()

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <AvatarDisplay
          iniciales={iniciales}
          avatarUrl={me.avatarUrl}
          bgColor={me.avatarBgColor}
          textColor={me.avatarTextColor}
          size={56}
        />
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-green-700 dark:text-green-400">
            {saludo()}, {me.nombre}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 capitalize">
            <Clock size={12} /> {fechaLarga()}
          </p>
          {totalPendientes > 0 ? (
            <p className="text-sm text-muted-foreground mt-1">
              Tenés <strong className="text-foreground">{totalPendientes}</strong> {totalPendientes === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'} de revisión.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">No tenés solicitudes pendientes.</p>
          )}
        </div>
      </div>

      {totalPendientes > 0 && (
        <div className="grid grid-cols-3 gap-2 mt-4">
          <Link
            href="/admin/ausencias"
            className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 hover:bg-muted transition-colors"
          >
            <CalendarOff size={14} className="text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">Ausencias</p>
              <p className="text-sm font-semibold">{pendingAusencias}</p>
            </div>
          </Link>
          <Link
            href="/admin/documentos?tab=solicitudes"
            className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 hover:bg-muted transition-colors"
          >
            <FileText size={14} className="text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">Documentos</p>
              <p className="text-sm font-semibold">{pendingSolicitudesDoc}</p>
            </div>
          </Link>
          <Link
            href="/admin/empleados?tab=modificaciones"
            className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 hover:bg-muted transition-colors"
          >
            <UserPen size={14} className="text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">Modificaciones</p>
              <p className="text-sm font-semibold">{pendingSolicitudesMod}</p>
            </div>
          </Link>
        </div>
      )}
    </div>
  )
}
