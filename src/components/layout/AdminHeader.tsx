interface Props { title: string }

export function AdminHeader({ title }: Props) {
  return (
    <header className="h-14 border-b border-border bg-background flex items-center px-6">
      <h1 className="font-semibold text-green-900 dark:text-green-400">{title}</h1>
    </header>
  )
}
