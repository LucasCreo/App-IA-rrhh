import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOAuthClient } from '@/lib/google'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const userId = searchParams.get('state')

  if (!code || !userId) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/empleado/perfil?google=error`)
  }

  try {
    const client = getOAuthClient()
    const { tokens } = await client.getToken(code)

    if (!tokens.refresh_token) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/empleado/perfil?google=error`)
    }

    await prisma.user.update({
      where: { id: Number(userId) },
      data: { googleRefreshToken: tokens.refresh_token },
    })

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/empleado/perfil?google=ok`)
  } catch {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/empleado/perfil?google=error`)
  }
}
