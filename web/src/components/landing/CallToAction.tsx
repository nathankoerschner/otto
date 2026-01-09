import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

export function CallToAction() {
  return (
    <section className="bg-primary py-20 text-primary-foreground">
      <div className="container mx-auto px-4 text-center">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Ready to automate task ownership?
          </h2>
          <p className="mt-4 text-lg opacity-90">
            Set up Otto in 5 minutes and never chase task owners again.
          </p>
          <div className="mt-8">
            <Button
              size="lg"
              variant="secondary"
              className="bg-white text-primary hover:bg-white/90"
              asChild
            >
              <a href="/setup">
                Get Started Now
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
