'use client'

import { Clock } from 'lucide-react'
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

export function WelcomeCard({ me }: Props) {
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
        </div>
      </div>
    </div>
  )
}
