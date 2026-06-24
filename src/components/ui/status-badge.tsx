import { cn } from '@/lib/utils'

const CONFIG: Record<string, { label: string; dot: string; bg: string; text: string; pulse?: boolean }> = {
  BORRADOR:        { label: 'Borrador',  dot: 'bg-gray-400',   bg: 'bg-gray-100 dark:bg-gray-800',       text: 'text-gray-700 dark:text-gray-300'    },
  PENDIENTE_ENVIO: { label: 'Pendiente', dot: 'bg-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-950/40', text: 'text-yellow-700 dark:text-yellow-400', pulse: true },
  PENDIENTE:       { label: 'Pendiente', dot: 'bg-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-950/40', text: 'text-yellow-700 dark:text-yellow-400', pulse: true },
  ENVIADO_A_FIRMA: { label: 'Enviado',   dot: 'bg-blue-500',   bg: 'bg-blue-50 dark:bg-blue-950/40',     text: 'text-blue-700 dark:text-blue-400',     pulse: true },
  FIRMADO:         { label: 'Firmado',   dot: 'bg-green-500',  bg: 'bg-green-50 dark:bg-green-950/40',   text: 'text-green-700 dark:text-green-400'  },
  APROBADO:        { label: 'Aprobado',  dot: 'bg-green-500',  bg: 'bg-green-50 dark:bg-green-950/40',   text: 'text-green-700 dark:text-green-400'  },
  RECHAZADO:       { label: 'Rechazado', dot: 'bg-red-500',    bg: 'bg-red-50 dark:bg-red-950/40',       text: 'text-red-700 dark:text-red-400'      },
  ERROR:           { label: 'Error',     dot: 'bg-orange-500', bg: 'bg-orange-50 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-400' },
}

export function StatusBadge({ estado }: { estado: string }) {
  const cfg = CONFIG[estado] ?? {
    label: estado, dot: 'bg-gray-400', bg: 'bg-gray-100', text: 'text-gray-700',
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium', cfg.bg, cfg.text)}>
      <span className={cn('inline-block h-1.5 w-1.5 rounded-full shrink-0', cfg.dot, cfg.pulse && 'animate-pulse')} />
      {cfg.label}
    </span>
  )
}
