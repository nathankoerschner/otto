import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { getDashboardStatus } from '@/api/auth'
import { useAuth } from '@/hooks'
import { TokenUpdateModal } from './TokenUpdateModal'
import type { DashboardStatus } from '@/api/types'
import {
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Settings,
  LogOut,
} from 'lucide-react'

export function Dashboard() {
  const { tenant, logout } = useAuth()
  const [status, setStatus] = useState<DashboardStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updateModalType, setUpdateModalType] = useState<
    'slack' | 'asana' | null
  >(null)

  async function fetchStatus() {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getDashboardStatus()
      setStatus(data)
    } catch {
      setError('Failed to load dashboard status')
    } finally {
      setIsLoading(false)
    }
  }

  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    fetchStatus()
  }, [])

  async function handleLogout() {
    await logout()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!status) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{tenant?.name}</h1>
          <p className="text-muted-foreground">Dashboard</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchStatus}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Tasks</CardDescription>
            <CardTitle className="text-3xl">
              {status.stats.pendingTasks}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Owned Tasks</CardDescription>
            <CardTitle className="text-3xl">{status.stats.ownedTasks}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completed Tasks</CardDescription>
            <CardTitle className="text-3xl">
              {status.stats.completedTasks}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Tasks</CardDescription>
            <CardTitle className="text-3xl">{status.stats.totalTasks}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Separator />

      {/* Integrations Status */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Integrations</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {/* Slack */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  {status.integrations.slack.connected ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  Slack
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setUpdateModalType('slack')}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription>
                {status.integrations.slack.connected
                  ? `Connected to workspace ${status.integrations.slack.workspaceId}`
                  : 'Not connected'}
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Asana */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  {status.integrations.asana.connected ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  Asana
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setUpdateModalType('asana')}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription>
                {status.integrations.asana.connected
                  ? `Connected to workspace ${status.integrations.asana.workspaceId}`
                  : 'Not connected'}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>

      {/* Last Updated */}
      <p className="text-sm text-muted-foreground">
        Last updated: {new Date(status.lastUpdated).toLocaleString()}
      </p>

      {/* Token Update Modal */}
      {updateModalType && (
        <TokenUpdateModal
          type={updateModalType}
          open={true}
          onOpenChange={(open) => !open && setUpdateModalType(null)}
          onSuccess={fetchStatus}
        />
      )}
    </div>
  )
}
