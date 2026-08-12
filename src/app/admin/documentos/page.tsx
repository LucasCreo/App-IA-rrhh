import { AdminHeader } from '@/components/layout/AdminHeader'
import { DocumentosGruposTable } from '@/components/documentos/DocumentosGruposTable'

export default function DocumentosPage() {
  return (
    <>
      <AdminHeader title="Documentos" />
      <div className="p-4 sm:p-6">
        <DocumentosGruposTable />
      </div>
    </>
  )
}
