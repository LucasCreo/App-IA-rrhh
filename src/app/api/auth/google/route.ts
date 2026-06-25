import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { getOAuthClient, SCOPES } from '@/lib/google'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const decoded = await verifyToken(token)
  if (!decoded.userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const client = getOAuthClient()
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state: String(decoded.userId),
  })

  return NextResponse.redirect(url)
}
