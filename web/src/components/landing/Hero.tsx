import { Button } from '@/components/ui/button'
import { ArrowRight, Bot, CheckCircle } from 'lucide-react'

export function Hero() {
  return (
    <section className="py-20 md:py-32">
      <div className="container mx-auto px-4 text-center">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6">
          <div className="flex items-center gap-2 rounded-full border bg-muted px-4 py-1.5 text-sm">
            <Bot className="h-4 w-4" />
            <span>Slack + Asana automation</span>
          </div>

          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
            Stop chasing task owners.
            <br />
            <span className="text-muted-foreground">Let Otto handle it.</span>
          </h1>

          <p className="max-w-2xl text-lg text-muted-foreground md:text-xl">
            Otto automatically finds owners for tasks assigned to your bot, sends
            follow-ups, and keeps everyone accountable—all through Slack.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row">
            <Button size="lg" asChild>
              <a href="/setup">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#how-it-works">See How It Works</a>
            </Button>
          </div>

          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 pt-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>5-minute setup</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Works with existing workflows</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
