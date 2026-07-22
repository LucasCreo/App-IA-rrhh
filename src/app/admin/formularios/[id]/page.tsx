import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AdminHeader } from '@/components/layout/AdminHeader'
import { AsignacionDetalle } from '@/components/formularios/AsignacionDetalle'

export default async function AsignacionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const { id } = await params
  return (
    <>
      <AdminHeader title="Formularios" />
      <div className="p-4 sm:p-6">
        <AsignacionDetalle id={Number(id)} />
      </div>
    </>
  )
}
