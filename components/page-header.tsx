export function PageHeader({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <header className="flex flex-col gap-1">
      <h1 className="text-2xl font-medium text-balance">{title}</h1>
      {description ? (
        <p className="text-sm text-pretty text-muted-foreground">
          {description}
        </p>
      ) : null}
    </header>
  )
}
