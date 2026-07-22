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

const LECTURA_LABELS: Record<string, string> = {
  ENVIADO_A_FIRMA: 'Pendiente de lectura',
  FIRMADO: 'Leído',
}

const NINGUNA_LABELS: Record<string, string> = {
  ENVIADO_A_FIRMA: 'Enviado',
  FIRMADO: 'Enviado',
}

// Etiquetas desde la perspectiva del empleado (destinatario)
const EMPLEADO_LABELS: Record<string, Record<string, string>> = {
  FIRMA: {
    ENVIADO_A_FIRMA: 'Pendiente de firma',
    FIRMADO: 'Firmado',
    RECHAZADO: 'Rechazado',
  },
  LECTURA: {
    ENVIADO_A_FIRMA: 'Pendiente de lectura',
    FIRMADO: 'Leído',
  },
  NINGUNA: {
    ENVIADO_A_FIRMA: 'Recibido',
    FIRMADO: 'Recibido',
  },
}

interface Props {
  estado: string
  accion?: string
  /** 'admin' (default) muestra "Enviado"; 'empleado' muestra "Pendiente de firma/lectura" */
  pov?: 'admin' | 'empleado'
}

export function StatusBadge({ estado, accion, pov = 'admin' }: Props) {
  const cfg = CONFIG[estado] ?? {
    label: estado, dot: 'bg-gray-400', bg: 'bg-gray-100', text: 'text-gray-700',
  }

  let label = cfg.label
  if (pov === 'empleado' && accion && EMPLEADO_LABELS[accion]?.[estado]) {
    label = EMPLEADO_LABELS[accion][estado]
  } else if (accion === 'LECTURA') {
    label = LECTURA_LABELS[estado] ?? cfg.label
  } else if (accion === 'NINGUNA') {
    label = NINGUNA_LABELS[estado] ?? cfg.label
  }

  // En vista empleado, el "pendiente de firma/lectura" usa colores amarillos
  const useYellow = pov === 'empleado' && estado === 'ENVIADO_A_FIRMA' && (accion === 'FIRMA' || accion === 'LECTURA')
  const dot = useYellow ? 'bg-yellow-500' : cfg.dot
  const bg = useYellow ? 'bg-yellow-50 dark:bg-yellow-950/40' : cfg.bg
  const text = useYellow ? 'text-yellow-700 dark:text-yellow-400' : cfg.text

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium', bg, text)}>
      <span className={cn('inline-block h-1.5 w-1.5 rounded-full shrink-0', dot, cfg.pulse && 'animate-pulse')} />
      {label}
    </span>
  )
}
