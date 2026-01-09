import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Bot, MessageSquare, Clock, Users } from 'lucide-react'

const features = [
  {
    icon: Bot,
    title: 'Automatic Owner Detection',
    description:
      'Otto uses your Google Sheet mapping to automatically find the right owner for each task—no manual assignment needed.',
  },
  {
    icon: MessageSquare,
    title: 'Smart Slack DMs',
    description:
      'Owners receive friendly DMs asking them to claim tasks. Natural language responses work—just say "yes" or "I\'ll take it."',
  },
  {
    icon: Clock,
    title: 'Intelligent Follow-ups',
    description:
      'Half-time and near-deadline reminders keep tasks on track. Otto adapts based on responses and due dates.',
  },
  {
    icon: Users,
    title: 'Multi-Tenant Support',
    description:
      'Perfect for agencies and teams with multiple workspaces. Each tenant has isolated data and configuration.',
  },
]

export function Features() {
  return (
    <section id="features" className="bg-muted/50 py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Everything you need for task accountability
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Otto handles the tedious work of finding owners and following up, so
            your team can focus on getting things done.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
          {features.map((feature) => (
            <Card key={feature.title}>
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <feature.icon className="h-5 w-5" />
                </div>
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
