import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useInitiateSlackOAuth } from '@/api/queries'
import { CheckCircle, ExternalLink, Loader2 } from 'lucide-react'

interface SlackConnectProps {
  tenantId: string
  isConnected: boolean
  onComplete: () => void
}

export function SlackConnect({
  tenantId,
  isConnected,
  onComplete,
}: SlackConnectProps) {
  const initiateOAuth = useInitiateSlackOAuth()

  function handleConnect() {
    initiateOAuth.mutate(tenantId, {
      onSuccess: (data) => {
        // Open OAuth URL in a popup or redirect
        window.open(data.redirectUrl, '_blank', 'width=600,height=700')
      },
    })
  }

  if (isConnected) {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <CardTitle>Slack Connected</CardTitle>
          </div>
          <CardDescription>
            Your Slack workspace is successfully connected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onComplete} className="w-full">
            Continue to Asana
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Connect Slack</CardTitle>
        <CardDescription>
          Allow Otto to send messages and interact with your team on Slack.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-muted p-4 text-sm">
          <p className="font-medium">Otto will be able to:</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
            <li>Send direct messages to team members</li>
            <li>Read messages in channels Otto is added to</li>
            <li>Look up user information</li>
          </ul>
        </div>

        {initiateOAuth.isError && (
          <p className="text-sm text-destructive">
            Failed to initiate Slack connection. Please try again.
          </p>
        )}

        <Button
          onClick={handleConnect}
          className="w-full"
          disabled={initiateOAuth.isPending}
        >
          {initiateOAuth.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              Connect Slack
              <ExternalLink className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
