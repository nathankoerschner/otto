import { z } from 'zod'

// Create tenant request schema
export const CreateTenantRequestSchema = z.object({
  name: z.string().min(1, 'Workspace name is required'),
  adminEmail: z.string().email('Valid email is required'),
})

export type CreateTenantRequest = z.infer<typeof CreateTenantRequestSchema>

// User schema
export const UserSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
})

export type User = z.infer<typeof UserSchema>

// Tenant schema and type
export const TenantSchema = z.object({
  id: z.string(),
  name: z.string(),
  setupCompleted: z.boolean(),
})

export type Tenant = z.infer<typeof TenantSchema>

// Auth response
export const AuthResponseSchema = z.object({
  user: UserSchema,
  tenant: TenantSchema,
})

export type AuthResponse = z.infer<typeof AuthResponseSchema>

// Slack validation result
export const SlackValidationSchema = z.object({
  valid: z.boolean(),
  workspace: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),
})

export type SlackValidation = z.infer<typeof SlackValidationSchema>

// Asana validation result
export const AsanaProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
})

export const AsanaValidationSchema = z.object({
  valid: z.boolean(),
  workspace: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),
  user: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),
  projects: z.array(AsanaProjectSchema).optional(),
})

export type AsanaValidation = z.infer<typeof AsanaValidationSchema>
export type AsanaProject = z.infer<typeof AsanaProjectSchema>

// Dashboard status
export const DashboardStatusSchema = z.object({
  tenant: z.object({
    id: z.string(),
    name: z.string(),
  }),
  integrations: z.object({
    slack: z.object({
      connected: z.boolean(),
      workspaceId: z.string().nullable(),
    }),
    asana: z.object({
      connected: z.boolean(),
      workspaceId: z.string().nullable(),
      projectId: z.string().nullable(),
    }),
  }),
  stats: z.object({
    pendingTasks: z.number(),
    ownedTasks: z.number(),
    completedTasks: z.number(),
    totalTasks: z.number(),
  }),
  lastUpdated: z.string(),
})

export type DashboardStatus = z.infer<typeof DashboardStatusSchema>
