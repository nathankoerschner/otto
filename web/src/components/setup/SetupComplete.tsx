import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { CheckCircle, PartyPopper } from 'lucide-react'

interface SetupCompleteProps {
  onReset: () => void
}

export function SetupComplete({ onReset }: SetupCompleteProps) {
  return (
    <Card className="mx-auto max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <PartyPopper className="h-8 w-8 text-green-600" />
        </div>
        <CardTitle>You&apos;re all set!</CardTitle>
        <CardDescription>
          Otto is now connected to your Slack and Asana workspaces.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <h3 className="font-medium">Next steps:</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
              <span>
                Create an Asana bot user and add it to your projects
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
              <span>
                Set up your Google Sheet with task-to-owner mappings
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
              <span>
                Assign a task to the bot user to test the flow
              </span>
            </li>
          </ul>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onReset} className="flex-1">
            Set up another workspace
          </Button>
          <Button asChild className="flex-1">
            <a href="/">Go to Homepage</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
