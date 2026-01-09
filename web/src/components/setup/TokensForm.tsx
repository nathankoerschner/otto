import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { validateSlackToken, validateAsanaToken, completeSetup } from '@/api/auth'
import type { AsanaProject } from '@/api/types'
import { Loader2, CheckCircle2, ExternalLink, AlertCircle } from 'lucide-react'

const tokensSchema = z.object({
  slackToken: z.string().min(1, 'Slack token is required').startsWith('xoxb-', 'Token must start with xoxb-'),
  asanaToken: z.string().min(1, 'Asana token is required'),
  asanaProjectId: z.string().min(1, 'Please select an Asana project'),
  adminSlackUserId: z.string().min(1, 'Slack admin user ID is required'),
})

type TokensFormData = z.infer<typeof tokensSchema>

interface TokensFormProps {
  onComplete: () => void
}

export function TokensForm({ onComplete }: TokensFormProps) {
  const [slackValidated, setSlackValidated] = useState(false)
  const [slackWorkspaceName, setSlackWorkspaceName] = useState<string>('')
  const [asanaValidated, setAsanaValidated] = useState(false)
  const [asanaProjects, setAsanaProjects] = useState<AsanaProject[]>([])
  const [isValidatingSlack, setIsValidatingSlack] = useState(false)
  const [isValidatingAsana, setIsValidatingAsana] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TokensFormData>({
    resolver: zodResolver(tokensSchema),
    defaultValues: {
      slackToken: '',
      asanaToken: '',
      asanaProjectId: '',
      adminSlackUserId: '',
    },
  })

  const slackToken = watch('slackToken')
  const asanaToken = watch('asanaToken')

  async function handleValidateSlack() {
    if (!slackToken) {
      return
    }

    setIsValidatingSlack(true)
    setError(null)

    try {
      const result = await validateSlackToken(slackToken)
      if (result.valid && result.workspace) {
        setSlackValidated(true)
        setSlackWorkspaceName(result.workspace.name)
      } else {
        setError('Invalid Slack token. Please check and try again.')
      }
    } catch {
      setError('Failed to validate Slack token. Please try again.')
    } finally {
      setIsValidatingSlack(false)
    }
  }

  async function handleValidateAsana() {
    if (!asanaToken) {
      return
    }

    setIsValidatingAsana(true)
    setError(null)

    try {
      const result = await validateAsanaToken(asanaToken)
      if (result.valid && result.projects) {
        setAsanaValidated(true)
        setAsanaProjects(result.projects)
        if (result.projects.length === 1) {
          setValue('asanaProjectId', result.projects[0]!.id)
        }
      } else {
        setError('Invalid Asana token. Please check and try again.')
      }
    } catch {
      setError('Failed to validate Asana token. Please try again.')
    } finally {
      setIsValidatingAsana(false)
    }
  }

  async function onSubmit(data: TokensFormData) {
    setIsSubmitting(true)
    setError(null)

    try {
      await completeSetup({
        slackToken: data.slackToken,
        asanaToken: data.asanaToken,
        asanaProjectId: data.asanaProjectId,
        adminSlackUserId: data.adminSlackUserId,
      })
      onComplete()
    } catch {
      setError('Failed to complete setup. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const canSubmit = slackValidated && asanaValidated

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle>Connect your integrations</CardTitle>
        <CardDescription>
          Enter your Slack and Asana tokens to connect Otto to your workspace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Slack Token Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Slack Bot Token</h3>
              {slackValidated && (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="slackToken">Bot Token (xoxb-...)</Label>
              <div className="flex gap-2">
                <Input
                  id="slackToken"
                  type="password"
                  placeholder="xoxb-..."
                  {...register('slackToken')}
                  disabled={slackValidated}
                />
                {!slackValidated && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleValidateSlack}
                    disabled={!slackToken || isValidatingSlack}
                  >
                    {isValidatingSlack ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Validate'
                    )}
                  </Button>
                )}
              </div>
              {errors.slackToken?.message && (
                <p className="text-sm text-destructive">
                  {errors.slackToken.message}
                </p>
              )}
              {slackValidated && slackWorkspaceName && (
                <p className="text-sm text-green-600">
                  Connected to: {slackWorkspaceName}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="adminSlackUserId">Your Slack User ID</Label>
              <Input
                id="adminSlackUserId"
                placeholder="U01234567"
                {...register('adminSlackUserId')}
              />
              {errors.adminSlackUserId?.message && (
                <p className="text-sm text-destructive">
                  {errors.adminSlackUserId.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Find this in Slack: click your profile → More → Copy member ID
              </p>
            </div>

            <a
              href="https://api.slack.com/apps"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Get your Slack bot token
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <Separator />

          {/* Asana Token Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Asana Personal Access Token</h3>
              {asanaValidated && (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="asanaToken">Personal Access Token</Label>
              <div className="flex gap-2">
                <Input
                  id="asanaToken"
                  type="password"
                  placeholder="1/12345..."
                  {...register('asanaToken')}
                  disabled={asanaValidated}
                />
                {!asanaValidated && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleValidateAsana}
                    disabled={!asanaToken || isValidatingAsana}
                  >
                    {isValidatingAsana ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Validate'
                    )}
                  </Button>
                )}
              </div>
              {errors.asanaToken?.message && (
                <p className="text-sm text-destructive">
                  {errors.asanaToken.message}
                </p>
              )}
            </div>

            {asanaValidated && asanaProjects.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="asanaProjectId">Select Project</Label>
                <Select
                  options={asanaProjects.map((p) => ({
                    value: p.id,
                    label: p.name,
                  }))}
                  placeholder="Select a project"
                  onChange={(value) => setValue('asanaProjectId', value)}
                />
                {errors.asanaProjectId?.message && (
                  <p className="text-sm text-destructive">
                    {errors.asanaProjectId.message}
                  </p>
                )}
              </div>
            )}

            <a
              href="https://app.asana.com/0/my-apps"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Get your Asana PAT
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Completing setup...
              </>
            ) : (
              'Complete Setup'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
