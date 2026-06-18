import { MisSolicitudes } from '@/components/empleado/MisSolicitudes'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function DocumentosPage() {
  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b border-border bg-background flex items-center px-6 gap-3">
        <Link href="/empleado" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="font-semibold text-green-900 dark:text-green-400">Mis Documentos</h1>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <div className="rounded-xl border bg-card shadow-sm p-5">
          <MisSolicitudes />
        </div>
      </div>
    </div>
  )
}
