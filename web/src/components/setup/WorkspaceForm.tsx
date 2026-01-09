import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useCreateTenant } from '@/api/queries'
import { CreateTenantRequestSchema, type CreateTenantRequest } from '@/api/types'
import { Loader2 } from 'lucide-react'

interface WorkspaceFormProps {
  onComplete: (tenantId: string) => void
}

export function WorkspaceForm({ onComplete }: WorkspaceFormProps) {
  const createTenant = useCreateTenant()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateTenantRequest>({
    resolver: zodResolver(CreateTenantRequestSchema),
  })

  function onSubmit(data: CreateTenantRequest) {
    createTenant.mutate(data, {
      onSuccess: (tenant) => onComplete(tenant.id),
    })
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Create your workspace</CardTitle>
        <CardDescription>
          Enter your workspace details to get started with Otto.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Workspace Name</Label>
            <Input
              id="name"
              placeholder="Acme Corp"
              {...register('name')}
              aria-invalid={errors.name ? 'true' : 'false'}
            />
            {errors.name?.message && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="adminEmail">Admin Email</Label>
            <Input
              id="adminEmail"
              type="email"
              placeholder="admin@acme.com"
              {...register('adminEmail')}
              aria-invalid={errors.adminEmail ? 'true' : 'false'}
            />
            {errors.adminEmail?.message && (
              <p className="text-sm text-destructive">
                {errors.adminEmail.message}
              </p>
            )}
          </div>

          {createTenant.isError && (
            <p className="text-sm text-destructive">
              Failed to create workspace. Please try again.
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={createTenant.isPending}
          >
            {createTenant.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Continue'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
