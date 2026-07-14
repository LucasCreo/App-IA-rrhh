import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
const COOKIE = 'rrhh_token'

function redirectToLogin(req: NextRequest, keepNext: boolean, clearCookie: boolean) {
  const url = new URL('/login', req.url)
  if (keepNext) url.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search)
  const res = NextResponse.redirect(url)
  if (clearCookie) res.cookies.delete(COOKIE)
  return res
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const token = req.cookies.get(COOKIE)?.value

  if (pathname === '/login') {
    if (!token) return NextResponse.next()
    try {
      const { payload } = await jwtVerify(token, secret)
      const next = req.nextUrl.searchParams.get('next')
      const dest = next && next.startsWith('/') ? next : (payload.role === 'ADMIN' ? '/admin' : '/empleado')
      return NextResponse.redirect(new URL(dest, req.url))
    } catch {
      return NextResponse.next()
    }
  }

  if (!token) return redirectToLogin(req, true, false)

  try {
    const { payload } = await jwtVerify(token, secret)
    // Rol equivocado: cerrar sesión y forzar login con el destino original
    if (pathname.startsWith('/admin') && payload.role !== 'ADMIN') {
      return redirectToLogin(req, true, true)
    }
    // /empleado: admins con employeeId también pueden entrar (actúan como su propio empleado)
    if (pathname.startsWith('/empleado')) {
      const esEmpleado = payload.role === 'EMPLOYEE'
      const esAdminConLegajo = payload.role === 'ADMIN' && !!payload.employeeId
      if (!esEmpleado && !esAdminConLegajo) return redirectToLogin(req, true, true)
    }
    // /manual/* accesible por ambos roles (autenticados)
    return NextResponse.next()
  } catch {
    return redirectToLogin(req, true, true)
  }
}

export const config = {
  matcher: ['/admin/:path*', '/empleado/:path*', '/manual/:path*', '/login'],
}
