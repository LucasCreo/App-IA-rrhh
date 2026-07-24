import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { signToken, comparePassword, COOKIE_NAME } from '@/lib/auth'

const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(200),
  password: z.string().min(1).max(200),
})

export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => null)
  const parsed = loginSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Usuario/email y contraseña requeridos' }, { status: 400 })
  }
  const { identifier, password } = parsed.data

  let user = null
  if (identifier.includes('@')) {
    user = await prisma.user.findUnique({ where: { email: identifier } })
  } else {
    user = await prisma.user.findUnique({ where: { username: identifier } })
    if (!user) {
      const employee = await prisma.employee.findUnique({ where: { legajo: identifier } })
      if (employee) user = await prisma.user.findFirst({ where: { employeeId: employee.id } })
    }
    if (!user) {
      user = await prisma.user.findFirst({ where: { email: { startsWith: `${identifier}@` } } })
    }
  }

  if (!user || !(await comparePassword(password, user.passwordHash))) {
    return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
  }

  const token = await signToken({
    userId: user.id,
    role: user.role as 'ADMIN' | 'EMPLOYEE',
    employeeId: user.employeeId ?? undefined,
    email: user.email,
  })

  const res = NextResponse.json({ ok: true, role: user.role })
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  })
  return res
}
