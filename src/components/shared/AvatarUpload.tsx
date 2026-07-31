'use client'

import { useEffect, useRef, useState } from 'react'
import Cropper, { Area } from 'react-easy-crop'
import { Camera, Trash2, Upload, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AvatarDisplay, DEFAULT_BG, DEFAULT_TEXT } from './AvatarDisplay'

interface Props {
  initials: string
  initialAvatar?: string | null
  initialBgColor?: string | null
  initialTextColor?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
  /** Cuando se pasa un userId, se cambia el avatar de ese usuario (admin editando a otro empleado). Por defecto edita el del usuario actual. */
  targetUserId?: number
}

const sizes = { sm: 32, md: 40, lg: 80 }

const PRESETS_BG = ['#dcfce7', '#dbeafe', '#fef3c7', '#fce7f3', '#e9d5ff', '#fee2e2', '#e0e7ff', '#f5f5f5']
const PRESETS_TEXT = ['#166534', '#1d4ed8', '#92400e', '#9d174d', '#6b21a8', '#991b1b', '#3730a3', '#374151']

async function cropToBlob(imageSrc: string, area: Area, tipo = 'image/jpeg'): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const el = new Image()
    el.crossOrigin = 'anonymous'
    el.onload = () => res(el)
    el.onerror = rej
    el.src = imageSrc
  })
  const size = Math.min(512, area.width)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, size, size)
  return new Promise((res, rej) => {
    canvas.toBlob(b => b ? res(b) : rej(new Error('canvas blob')), tipo, 0.92)
  })
}

export function AvatarUpload({
  initials, initialAvatar, initialBgColor, initialTextColor, size = 'md', className, targetUserId,
}: Props) {
  const qs = targetUserId ? `?userId=${targetUserId}` : ''
  const [avatar, setAvatar] = useState<string | null>(initialAvatar ?? null)
  const [bgColor, setBgColor] = useState<string>(initialBgColor ?? DEFAULT_BG)
  const [textColor, setTextColor] = useState<string>(initialTextColor ?? DEFAULT_TEXT)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'foto' | 'iniciales'>(avatar ? 'foto' : 'iniciales')
  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedArea, setCroppedArea] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const px = sizes[size]

  useEffect(() => {
    if (open) setTab(avatar ? 'foto' : 'iniciales')
  }, [open, avatar])

  function handleFile(f: File) {
    if (f.size > 5 * 1024 * 1024) { toast.error('La imagen supera 5 MB'); return }
    const reader = new FileReader()
    reader.onload = () => {
      setImgSrc(reader.result as string)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
    }
    reader.readAsDataURL(f)
  }

  async function guardarFoto() {
    if (!imgSrc || !croppedArea) return
    setBusy(true)
    try {
      const blob = await cropToBlob(imgSrc, croppedArea)
      const fd = new FormData()
      fd.append('file', new File([blob], 'avatar.jpg', { type: 'image/jpeg' }))
      const res = await fetch(`/api/auth/avatar${qs}`, { method: 'POST', body: fd })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Error')
      const data = await res.json()
      setAvatar(data.avatarUrl)
      setImgSrc(null)
      toast.success('Foto actualizada')
      setOpen(false)
    } catch (e: any) {
      toast.error(e.message ?? 'Error al subir')
    } finally {
      setBusy(false)
    }
  }

  async function eliminarFoto() {
    setBusy(true)
    const res = await fetch(`/api/auth/avatar${qs}`, { method: 'DELETE' })
    setBusy(false)
    if (!res.ok) { toast.error('Error al eliminar'); return }
    setAvatar(null)
    setImgSrc(null)
    setTab('iniciales')
    toast.success('Foto eliminada')
  }

  async function guardarColores() {
    setBusy(true)
    const res = await fetch(`/api/auth/avatar${qs}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatarBgColor: bgColor, avatarTextColor: textColor }),
    })
    setBusy(false)
    if (!res.ok) { toast.error('Error al guardar colores'); return }
    toast.success('Colores actualizados')
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        className={cn('relative group shrink-0', className)}
        onClick={() => setOpen(true)}
        title="Cambiar foto de perfil"
      >
        <AvatarDisplay
          iniciales={initials}
          avatarUrl={avatar}
          bgColor={bgColor}
          textColor={textColor}
          size={px}
        />
        <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Camera size={px * 0.35} className="text-white" />
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Foto de perfil</DialogTitle>
          </DialogHeader>

          {/* Tabs */}
          <div className="flex border-b">
            <button
              onClick={() => setTab('foto')}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === 'foto'
                  ? 'border-green-700 text-green-700 dark:border-green-400 dark:text-green-400'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              Foto
            </button>
            <button
              onClick={() => setTab('iniciales')}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === 'iniciales'
                  ? 'border-green-700 text-green-700 dark:border-green-400 dark:text-green-400'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              Iniciales
            </button>
          </div>

          {tab === 'foto' && (
            <div className="py-2 space-y-3">
              {imgSrc ? (
                <>
                  <div className="relative h-64 bg-muted rounded-md overflow-hidden">
                    <Cropper
                      image={imgSrc}
                      crop={crop}
                      zoom={zoom}
                      aspect={1}
                      cropShape="round"
                      showGrid={false}
                      onCropChange={setCrop}
                      onZoomChange={setZoom}
                      onCropComplete={(_, area) => setCroppedArea(area)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Zoom</span>
                    <input
                      type="range"
                      min={1}
                      max={3}
                      step={0.05}
                      value={zoom}
                      onChange={e => setZoom(Number(e.target.value))}
                      className="flex-1 accent-green-700"
                    />
                  </div>
                  <div className="flex justify-between gap-2">
                    <Button variant="outline" size="sm" onClick={() => setImgSrc(null)}>Cancelar</Button>
                    <Button size="sm" className="bg-green-700 hover:bg-green-800" onClick={guardarFoto} disabled={busy}>
                      <Check size={14} className="mr-1" /> Aplicar
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-center">
                    <AvatarDisplay
                      iniciales={initials}
                      avatarUrl={avatar}
                      bgColor={bgColor}
                      textColor={textColor}
                      size={120}
                    />
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
                  />
                  <div className="flex justify-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                      <Upload size={14} className="mr-1" /> {avatar ? 'Cambiar' : 'Subir foto'}
                    </Button>
                    {avatar && (
                      <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={eliminarFoto} disabled={busy}>
                        <Trash2 size={14} className="mr-1" /> Eliminar
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground text-center">JPG, PNG o WebP. Máx 5 MB.</p>
                </div>
              )}
            </div>
          )}

          {tab === 'iniciales' && (
            <div className="py-2 space-y-4">
              <div className="flex justify-center">
                <AvatarDisplay iniciales={initials} bgColor={bgColor} textColor={textColor} size={120} />
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Fondo</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESETS_BG.map(c => (
                    <button
                      key={c}
                      onClick={() => setBgColor(c)}
                      className={cn('h-8 w-8 rounded-full border-2 transition-transform', bgColor === c ? 'border-green-700 scale-110' : 'border-transparent')}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <label className="h-8 w-8 rounded-full border cursor-pointer overflow-hidden relative" title="Color personalizado">
                    <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
                    <div className="h-full w-full" style={{ background: 'conic-gradient(from 0deg, red, yellow, lime, cyan, blue, magenta, red)' }} />
                  </label>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Texto</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESETS_TEXT.map(c => (
                    <button
                      key={c}
                      onClick={() => setTextColor(c)}
                      className={cn('h-8 w-8 rounded-full border-2 transition-transform', textColor === c ? 'border-green-700 scale-110' : 'border-transparent')}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <label className="h-8 w-8 rounded-full border cursor-pointer overflow-hidden relative" title="Color personalizado">
                    <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
                    <div className="h-full w-full" style={{ background: 'conic-gradient(from 0deg, red, yellow, lime, cyan, blue, magenta, red)' }} />
                  </label>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button size="sm" className="bg-green-700 hover:bg-green-800" onClick={guardarColores} disabled={busy}>
                  Guardar colores
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
