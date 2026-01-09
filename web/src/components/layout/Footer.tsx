export function Footer() {
  return (
    <footer className="border-t bg-muted/50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground text-sm font-bold">
              O
            </div>
            <span className="font-semibold">Otto</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Automatic task ownership for Slack + Asana teams
          </p>
        </div>
      </div>
    </footer>
  )
}
