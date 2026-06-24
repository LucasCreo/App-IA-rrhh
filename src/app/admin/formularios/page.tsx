import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AdminHeader } from '@/components/layout/AdminHeader'
import { AsignacionesList } from '@/components/formularios/AsignacionesList'

export default async function FormulariosPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <>
      <AdminHeader title="Formularios" />
      <div className="p-6">
        <AsignacionesList />
      </div>
    </>
  )
}
