import { DocumentoGrupoDetalle } from '@/components/documentos/DocumentoGrupoDetalle'

export default async function DocumentoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <DocumentoGrupoDetalle grupoId={Number(id)} />
}
