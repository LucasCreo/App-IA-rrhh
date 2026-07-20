'use client'

import { cn } from '@/lib/utils'

interface Props {
  nombre?: string
  iniciales?: string
  avatarUrl?: string | null
  bgColor?: string | null
  textColor?: string | null
  size?: number
  className?: string
}

export const DEFAULT_BG = '#dcfce7'   // green-100 aprox
export const DEFAULT_TEXT = '#166534' // green-800 aprox

function getIniciales(nombre?: string, iniciales?: string): string {
  if (iniciales) return iniciales.slice(0, 2).toUpperCase()
  if (!nombre) return '?'
  const partes = nombre.trim().split(/\s+/)
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

export function AvatarDisplay({
  nombre, iniciales, avatarUrl, bgColor, textColor, size = 40, className,
}: Props) {
  const style: React.CSSProperties = { width: size, height: size }
  if (avatarUrl) {
    const src = avatarUrl.startsWith('/') || avatarUrl.startsWith('http')
      ? avatarUrl
      : `/api/auth/avatar?file=${avatarUrl}`
    return (
      <img
        src={src}
        alt={nombre ?? ''}
        className={cn('rounded-full object-cover shrink-0', className)}
        style={style}
      />
    )
  }
  const bg = bgColor ?? DEFAULT_BG
  const fg = textColor ?? DEFAULT_TEXT
  return (
    <div
      className={cn('rounded-full flex items-center justify-center font-semibold shrink-0 select-none uppercase', className)}
      style={{ ...style, backgroundColor: bg, color: fg, fontSize: size * 0.4 }}
    >
      {getIniciales(nombre, iniciales)}
    </div>
  )
}
