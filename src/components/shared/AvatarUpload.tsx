'use client'

import { useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Props {
  initials: string
  initialAvatar?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: { container: 'h-8 w-8', text: 'text-xs', icon: 10 },
  md: { container: 'h-10 w-10', text: 'text-sm', icon: 13 },
  lg: { container: 'h-20 w-20', text: 'text-2xl', icon: 20 },
}

export function AvatarUpload({ initials, initialAvatar, size = 'md', className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [avatar, setAvatar] = useState<string | null>(initialAvatar ?? null)
  const [uploading, setUploading] = useState(false)
  const s = sizes[size]

  async function handleFile(file: File) {
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/auth/avatar', { method: 'POST', body: fd })
    setUploading(false)
    if (res.ok) {
      const data = await res.json()
      setAvatar(data.avatarUrl)
      toast.success('Foto actualizada')
    } else {
      const err = await res.json().catch(() => ({ error: 'Error al subir la imagen' }))
      toast.error(err.error ?? 'Error al subir la imagen')
    }
  }

  return (
    <div
      className={cn('relative group cursor-pointer shrink-0', className)}
      onClick={() => inputRef.current?.click()}
      title="Cambiar foto de perfil"
    >
      <div className={cn(s.container, s.text, 'rounded-full overflow-hidden bg-green-100 dark:bg-green-950/40 flex items-center justify-center font-bold text-green-700 dark:text-green-400 uppercase select-none')}>
        {avatar
          ? <img src={`/api/auth/avatar?file=${avatar}`} alt="" className="w-full h-full object-cover" />
          : initials}
      </div>
      <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        {uploading
          ? <span className="text-white" style={{ fontSize: s.icon }}>…</span>
          : <Camera size={s.icon} className="text-white" />}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
      />
    </div>
  )
}
