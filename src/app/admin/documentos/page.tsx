import { AdminHeader } from '@/components/layout/AdminHeader'
import { DocumentosTable } from '@/components/documentos/DocumentosTable'

export default function DocumentosPage() {
  return (
    <>
      <AdminHeader title="Documentos" />
      <div className="p-4 sm:p-6">
        <DocumentosTable esRecibo={false} />
      </div>
    </>
  )
}
