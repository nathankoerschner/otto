import { z } from 'zod'

// Tenant schema and type
export const TenantSchema = z.object({
  id: z.string(),
  name: z.string(),
  slackWorkspaceId: z.string().nullable(),
  asanaWorkspaceId: z.string().nullable(),
  adminSlackUserId: z.string().nullable(),
  createdAt: z.string(),
})

export type Tenant = z.infer<typeof TenantSchema>

// Create tenant request
export const CreateTenantRequestSchema = z.object({
  name: z.string().min(1, 'Workspace name is required'),
  adminEmail: z.string().email('Valid email is required'),
})

export type CreateTenantRequest = z.infer<typeof CreateTenantRequestSchema>

// OAuth URLs response
export const OAuthUrlsSchema = z.object({
  slackAuthorizeUrl: z.string().url(),
  asanaAuthorizeUrl: z.string().url(),
})

export type OAuthUrls = z.infer<typeof OAuthUrlsSchema>

// Setup status
export const SetupStatusSchema = z.object({
  tenantId: z.string(),
  slackConnected: z.boolean(),
  asanaConnected: z.boolean(),
  isComplete: z.boolean(),
})

export type SetupStatus = z.infer<typeof SetupStatusSchema>
