import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AdminHeader } from '@/components/layout/AdminHeader'
import { RondasList } from '@/components/evaluaciones/RondasList'

export default async function EvaluacionesPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <>
      <AdminHeader title="Evaluaciones de desempeño" />
      <div className="p-6">
        <RondasList />
      </div>
    </>
  )
}
