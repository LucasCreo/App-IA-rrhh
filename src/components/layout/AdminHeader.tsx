'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props { title: string; actions?: ReactNode }

export function AdminHeader({ title, actions }: Props) {
  const searchParams = useSearchParams()
  const fromDashboard = searchParams.get('from') === 'dashboard'

  return (
    <header
      className={cn(
        'border-b border-border bg-background flex items-center justify-between px-4 sm:px-6 gap-2',
        fromDashboard ? 'py-2' : 'h-14'
      )}
    >
      <div className="flex flex-col min-w-0">
        <h1 className="font-semibold text-green-900 dark:text-green-400 truncate leading-tight">{title}</h1>
        {fromDashboard && (
          <Link
            href="/admin"
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors mt-0.5"
          >
            <ArrowLeft size={11} /> Dashboard
          </Link>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  )
}
