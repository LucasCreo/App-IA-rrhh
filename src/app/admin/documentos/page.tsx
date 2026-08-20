import { AdminHeader } from '@/components/layout/AdminHeader'
import { DocumentosGruposTable } from '@/components/documentos/DocumentosGruposTable'

export default function DocumentosPage() {
  return (
    <div className="flex flex-col h-full">
      <AdminHeader title="Documentos" />
      <DocumentosGruposTable />
    </div>
  )
}
