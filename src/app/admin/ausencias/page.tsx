import { AusenciasAdmin } from '@/components/ausencias/AusenciasAdmin'

export default function AusenciasPage() {
  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b border-border bg-background flex items-center px-6">
        <h1 className="font-semibold text-green-900 dark:text-green-400">Ausencias y Vacaciones</h1>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <div className="rounded-xl border bg-card shadow-sm p-6">
          <AusenciasAdmin />
        </div>
      </div>
    </div>
  )
}
