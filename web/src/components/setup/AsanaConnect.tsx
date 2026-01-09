import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useInitiateAsanaOAuth } from '@/api/queries'
import { CheckCircle, ExternalLink, Loader2 } from 'lucide-react'

interface AsanaConnectProps {
  tenantId: string
  isConnected: boolean
  onComplete: () => void
}

export function AsanaConnect({
  tenantId,
  isConnected,
  onComplete,
}: AsanaConnectProps) {
  const initiateOAuth = useInitiateAsanaOAuth()

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
            <CardTitle>Asana Connected</CardTitle>
          </div>
          <CardDescription>
            Your Asana workspace is successfully connected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onComplete} className="w-full">
            Complete Setup
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Connect Asana</CardTitle>
        <CardDescription>
          Allow Otto to manage tasks and receive webhook notifications from Asana.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-muted p-4 text-sm">
          <p className="font-medium">Otto will be able to:</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
            <li>Read and update tasks assigned to the bot</li>
            <li>Receive notifications when tasks are assigned</li>
            <li>Add comments to tasks</li>
          </ul>
        </div>

        {initiateOAuth.isError && (
          <p className="text-sm text-destructive">
            Failed to initiate Asana connection. Please try again.
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
              Connect Asana
              <ExternalLink className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
