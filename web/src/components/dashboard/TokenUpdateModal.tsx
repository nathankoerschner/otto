import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { updateSlackToken, updateAsanaToken } from '@/api/auth'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

interface TokenUpdateModalProps {
  type: 'slack' | 'asana'
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function TokenUpdateModal({
  type,
  open,
  onOpenChange,
  onSuccess,
}: TokenUpdateModalProps) {
  const [token, setToken] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      if (type === 'slack') {
        const result = await updateSlackToken(token)
        if (result.valid) {
          setSuccess(true)
          setTimeout(() => {
            onSuccess()
            onOpenChange(false)
          }, 1000)
        } else {
          setError('Invalid token')
        }
      } else {
        const result = await updateAsanaToken(token)
        if (result.valid) {
          setSuccess(true)
          setTimeout(() => {
            onSuccess()
            onOpenChange(false)
          }, 1000)
        } else {
          setError('Invalid token')
        }
      }
    } catch {
      setError('Failed to update token. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  function handleClose() {
    setToken('')
    setError(null)
    setSuccess(false)
    onOpenChange(false)
  }

  const title = type === 'slack' ? 'Update Slack Token' : 'Update Asana Token'
  const placeholder =
    type === 'slack' ? 'xoxb-...' : 'Your personal access token'
  const helpText =
    type === 'slack'
      ? 'Enter your new Slack bot token (xoxb-...)'
      : 'Enter your new Asana personal access token'

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{helpText}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="token">New Token</Label>
              <Input
                id="token"
                type="password"
                placeholder={placeholder}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={isLoading || success}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert variant="success">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>Token updated successfully!</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!token || isLoading || success}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Token'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
