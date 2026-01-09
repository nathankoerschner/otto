import { Header, Footer } from '@/components/layout'
import { Hero, Features, HowItWorks, CallToAction } from '@/components/landing'

export function Landing() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Hero />
        <Features />
        <HowItWorks />
        <CallToAction />
      </main>
      <Footer />
    </div>
  )
}
