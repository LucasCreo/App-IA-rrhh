import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AdminHeader } from '@/components/layout/AdminHeader'
import { RondaDetalle } from '@/components/evaluaciones/RondaDetalle'

export default async function RondaPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const { id } = await params
  return (
    <>
      <AdminHeader title="Evaluaciones de desempeño" />
      <div className="p-6">
        <RondaDetalle id={Number(id)} />
      </div>
    </>
  )
}
