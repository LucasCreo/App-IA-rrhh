import { ReactNode } from 'react'

interface Props { title: string; actions?: ReactNode }

export function AdminHeader({ title, actions }: Props) {
  return (
    <header className="h-14 border-b border-border bg-background flex items-center justify-between px-6">
      <h1 className="font-semibold text-green-900 dark:text-green-400">{title}</h1>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  )
}
