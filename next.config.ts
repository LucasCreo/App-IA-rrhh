import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['@prisma/client', 'bcryptjs', 'pdf-parse'],
  devIndicators: false,
}

export default nextConfig
