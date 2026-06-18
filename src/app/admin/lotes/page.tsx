import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { LotesTable } from '@/components/lotes/LotesTable'

export default async function LotesPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') redirect('/login')
  return <LotesTable />
}
