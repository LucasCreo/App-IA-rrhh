import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['@prisma/client', 'bcryptjs', 'pdf-parse'],
  devIndicators: false,
  // Compat con posts viejos del portal: enrutamos /uploads/posts/* al endpoint
  // que resuelve Aditus (con fallback a disco). Los posts nuevos ya salen con
  // la URL /api/portal/media/serve/... pero los HTML guardados apuntan al viejo path.
  async rewrites() {
    return [
      { source: '/uploads/posts/:path*', destination: '/api/portal/media/serve/:path*' },
    ]
  },
}

export default nextConfig
