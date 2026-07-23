'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download, ExternalLink, FileText } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  url: string | null
  filename?: string | null
  title?: string
}

const IMG_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']

function getExt(name?: string | null): string {
  if (!name) return ''
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
}

export function ArchivoPreviewDialog({ open, onClose, url, filename, title }: Props) {
  const displayName = filename?.replace(/^\d+-/, '') ?? 'Archivo'
  const ext = getExt(filename)
  const isPdf = ext === 'pdf' || (url?.toLowerCase().includes('.pdf'))
  const isImg = IMG_EXT.includes(ext)

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-4xl flex flex-col max-h-[90vh] overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center justify-between gap-3 pr-6">
            <span className="truncate">{title ?? displayName}</span>
            <div className="flex items-center gap-1 shrink-0">
              {url && (
                <>
                  <a href={url} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Abrir en pestaña nueva">
                      <ExternalLink size={14} />
                    </Button>
                  </a>
                  <a href={url} download={displayName}>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Descargar">
                      <Download size={14} />
                    </Button>
                  </a>
                </>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-[60vh] bg-muted/40 rounded-lg overflow-hidden flex items-center justify-center">
          {!url ? (
            <p className="text-sm text-muted-foreground">Sin archivo</p>
          ) : isPdf ? (
            <iframe src={`${url}#toolbar=1&view=FitH`} className="w-full h-full min-h-[60vh]" title={displayName} />
          ) : isImg ? (
            <img src={url} alt={displayName} className="max-w-full max-h-[70vh] object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
              <FileText size={40} strokeWidth={1.2} />
              <p className="text-sm">Vista previa no disponible para este formato.</p>
              <a href={url} download={displayName}>
                <Button size="sm" variant="outline">
                  <Download size={14} className="mr-1.5" /> Descargar {displayName}
                </Button>
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
