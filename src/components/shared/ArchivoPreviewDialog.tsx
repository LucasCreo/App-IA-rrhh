'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Download, ExternalLink, FileText, FileSpreadsheet, FileType,
  Presentation, FileArchive, FileCode, FileAudio, FileVideo,
} from 'lucide-react'
import { displayNameFromRef } from '@/lib/aditusSolicitudes'

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

/** Metadata visual por tipo de archivo para el fallback sin preview. */
function tipoInfo(ext: string): { Icon: React.ElementType; label: string; color: string; bg: string } {
  switch (ext) {
    case 'xlsx': case 'xls': case 'csv':
      return { Icon: FileSpreadsheet, label: 'Planilla de cálculo', color: 'text-green-700 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-950/40' }
    case 'docx': case 'doc':
      return { Icon: FileType, label: 'Documento Word', color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-950/40' }
    case 'pptx': case 'ppt':
      return { Icon: Presentation, label: 'Presentación', color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-950/40' }
    case 'zip': case 'rar': case '7z': case 'tar': case 'gz':
      return { Icon: FileArchive, label: 'Archivo comprimido', color: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-950/40' }
    case 'json': case 'xml': case 'html': case 'js': case 'ts': case 'css':
      return { Icon: FileCode, label: 'Código', color: 'text-slate-700 dark:text-slate-300', bg: 'bg-slate-100 dark:bg-slate-800/60' }
    case 'mp3': case 'wav': case 'ogg': case 'm4a':
      return { Icon: FileAudio, label: 'Audio', color: 'text-purple-700 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-950/40' }
    case 'mp4': case 'mov': case 'avi': case 'mkv': case 'webm':
      return { Icon: FileVideo, label: 'Video', color: 'text-rose-700 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-950/40' }
    case 'txt': case 'md':
      return { Icon: FileText, label: 'Texto', color: 'text-gray-700 dark:text-gray-300', bg: 'bg-gray-100 dark:bg-gray-800/60' }
    default:
      return { Icon: FileText, label: ext ? ext.toUpperCase() : 'Archivo', color: 'text-muted-foreground', bg: 'bg-muted' }
  }
}

export function ArchivoPreviewDialog({ open, onClose, url, filename, title }: Props) {
  const rawName = filename ? displayNameFromRef(filename) : 'Archivo'
  const rawExt = getExt(rawName)
  const isImg = IMG_EXT.includes(rawExt)
  // Si no hay extensión reconocible, asumimos PDF: los endpoints internos
  // (documentos, recibos, docs-grupos) siempre devuelven PDF.
  const isPdf = rawExt === 'pdf'
    || (url?.toLowerCase().includes('.pdf'))
    || (!isImg && rawExt === '')
  // Nombre para descarga: si asumimos PDF pero el nombre no tiene ext, agregamos .pdf
  const displayName = isPdf && !rawExt ? `${rawName}.pdf` : rawName

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
          ) : (() => {
            const info = tipoInfo(rawExt)
            const { Icon } = info
            return (
              <div className="flex flex-col items-center gap-4 py-12 px-6 text-center">
                <div className={`h-20 w-20 rounded-2xl flex items-center justify-center ${info.bg}`}>
                  <Icon size={40} strokeWidth={1.4} className={info.color} />
                </div>
                <div className="space-y-1 max-w-md">
                  <p className={`text-xs font-medium uppercase tracking-wide ${info.color}`}>
                    {info.label}
                  </p>
                  <p className="text-sm font-medium text-foreground break-all">{displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    Vista previa no disponible para este formato.
                  </p>
                </div>
                <a href={url} download={displayName}>
                  <Button size="sm" className="bg-green-700 hover:bg-green-800 text-white">
                    <Download size={14} className="mr-1.5" /> Descargar
                  </Button>
                </a>
              </div>
            )
          })()}
        </div>
      </DialogContent>
    </Dialog>
  )
}
