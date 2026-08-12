import { AdminHeader } from '@/components/layout/AdminHeader'
import { DocumentoGrupoDetalle } from '@/components/documentos/DocumentoGrupoDetalle'

export default async function DocumentoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <>
      <AdminHeader title="Detalle del documento" />
      <div className="p-4 sm:p-6">
        <DocumentoGrupoDetalle grupoId={Number(id)} />
      </div>
    </>
  )
}
