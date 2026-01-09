import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAuth } from '@/hooks'
import { Loader2, AlertCircle } from 'lucide-react'

const registerSchema = z.object({
  workspaceName: z.string().min(1, 'Workspace name is required'),
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type RegisterFormData = z.infer<typeof registerSchema>

const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFormData = z.infer<typeof loginSchema>

interface WorkspaceFormProps {
  onComplete: () => void
}

export function WorkspaceForm({ onComplete }: WorkspaceFormProps) {
  const { registerWithEmail, loginWithEmail, loginWithGoogle, registerGoogleUser, isLoading, error: authError } = useAuth()
  const [mode, setMode] = useState<'register' | 'login'>('register')
  const [error, setError] = useState<string | null>(null)
  const [googleNeedsWorkspace, setGoogleNeedsWorkspace] = useState(false)
  const [workspaceName, setWorkspaceName] = useState('')

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  async function onRegister(data: RegisterFormData) {
    setError(null)
    try {
      await registerWithEmail(data.email, data.password, data.workspaceName)
      onComplete()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed')
    }
  }

  async function onLogin(data: LoginFormData) {
    setError(null)
    try {
      await loginWithEmail(data.email, data.password)
      onComplete()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed')
    }
  }

  async function handleGoogleSignIn() {
    setError(null)
    try {
      const result = await loginWithGoogle()
      if (result.isNewUser) {
        setGoogleNeedsWorkspace(true)
      } else {
        onComplete()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google sign-in failed')
    }
  }

  async function handleGoogleRegister() {
    if (!workspaceName) {
      setError('Please enter a workspace name')
      return
    }
    setError(null)
    try {
      await registerGoogleUser(workspaceName)
      onComplete()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed')
    }
  }

  // Google user needs to enter workspace name
  if (googleNeedsWorkspace) {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>Create your workspace</CardTitle>
          <CardDescription>
            Enter a name for your workspace to complete registration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="workspaceName">Workspace Name</Label>
            <Input
              id="workspaceName"
              placeholder="Acme Corp"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
            />
          </div>

          {(error || authError) && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error || authError}</AlertDescription>
            </Alert>
          )}

          <Button
            className="w-full"
            onClick={handleGoogleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Workspace'
            )}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>
          {mode === 'register' ? 'Create your workspace' : 'Sign in'}
        </CardTitle>
        <CardDescription>
          {mode === 'register'
            ? 'Enter your details to get started with Otto.'
            : 'Sign in to your existing workspace.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {mode === 'register' ? (
          <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="workspaceName">Workspace Name</Label>
              <Input
                id="workspaceName"
                placeholder="Acme Corp"
                {...registerForm.register('workspaceName')}
              />
              {registerForm.formState.errors.workspaceName?.message && (
                <p className="text-sm text-destructive">
                  {registerForm.formState.errors.workspaceName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@acme.com"
                {...registerForm.register('email')}
              />
              {registerForm.formState.errors.email?.message && (
                <p className="text-sm text-destructive">
                  {registerForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 6 characters"
                {...registerForm.register('password')}
              />
              {registerForm.formState.errors.password?.message && (
                <p className="text-sm text-destructive">
                  {registerForm.formState.errors.password.message}
                </p>
              )}
            </div>

            {(error || authError) && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error || authError}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Workspace'
              )}
            </Button>
          </form>
        ) : (
          <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="loginEmail">Email</Label>
              <Input
                id="loginEmail"
                type="email"
                placeholder="admin@acme.com"
                {...loginForm.register('email')}
              />
              {loginForm.formState.errors.email?.message && (
                <p className="text-sm text-destructive">
                  {loginForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="loginPassword">Password</Label>
              <Input
                id="loginPassword"
                type="password"
                {...loginForm.register('password')}
              />
              {loginForm.formState.errors.password?.message && (
                <p className="text-sm text-destructive">
                  {loginForm.formState.errors.password.message}
                </p>
              )}
            </div>

            {(error || authError) && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error || authError}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
        )}

        <div className="mt-4">
          <Separator />
          <div className="my-4">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
            >
              Continue with Google
            </Button>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          {mode === 'register' ? (
            <>
              Already have a workspace?{' '}
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => setMode('login')}
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              Need a workspace?{' '}
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => setMode('register')}
              >
                Create one
              </button>
            </>
          )}
        </p>
      </CardContent>
    </Card>
  )
}
