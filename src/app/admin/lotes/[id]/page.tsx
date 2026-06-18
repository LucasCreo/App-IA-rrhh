import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { LoteDetalle } from '@/components/lotes/LoteDetalle'

export default async function LoteDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') redirect('/login')
  const { id } = await params
  return <LoteDetalle loteId={Number(id)} />
}
