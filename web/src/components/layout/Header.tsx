import { Button } from '@/components/ui/button'

export function Header() {
  return (
    <header className="border-b bg-background">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
            O
          </div>
          <span className="text-xl font-semibold">Otto</span>
        </div>
        <nav className="flex items-center gap-4">
          <Button variant="ghost" asChild>
            <a href="#features">Features</a>
          </Button>
          <Button variant="ghost" asChild>
            <a href="#how-it-works">How it Works</a>
          </Button>
          <Button asChild>
            <a href="/setup">Get Started</a>
          </Button>
        </nav>
      </div>
    </header>
  )
}
