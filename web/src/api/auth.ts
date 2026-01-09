import { api } from './client'
import {
  type AuthResponse,
  AuthResponseSchema,
  type SlackValidation,
  SlackValidationSchema,
  type AsanaValidation,
  AsanaValidationSchema,
  type DashboardStatus,
  DashboardStatusSchema,
} from './types'

// Auth API calls
export async function register(
  firebaseIdToken: string,
  workspaceName: string
): Promise<AuthResponse> {
  return api.post(
    '/api/auth/register',
    { firebaseIdToken, workspaceName },
    undefined,
    AuthResponseSchema
  )
}

export async function login(firebaseIdToken: string): Promise<AuthResponse> {
  return api.post(
    '/api/auth/login',
    { firebaseIdToken },
    undefined,
    AuthResponseSchema
  )
}

export async function logout(): Promise<void> {
  await api.post('/api/auth/logout', {})
}

export async function getMe(): Promise<AuthResponse> {
  return api.get('/api/auth/me', undefined, AuthResponseSchema)
}

// Setup API calls
export async function validateSlackToken(
  token: string
): Promise<SlackValidation> {
  return api.post(
    '/api/setup/validate-slack',
    { token },
    undefined,
    SlackValidationSchema
  )
}

export async function validateAsanaToken(
  token: string
): Promise<AsanaValidation> {
  return api.post(
    '/api/setup/validate-asana',
    { token },
    undefined,
    AsanaValidationSchema
  )
}

export async function completeSetup(params: {
  slackToken: string
  asanaToken: string
  asanaProjectId: string
  adminSlackUserId: string
}): Promise<{ success: boolean }> {
  return api.post('/api/setup/complete', params)
}

// Dashboard API calls
export async function getDashboardStatus(): Promise<DashboardStatus> {
  return api.get('/api/dashboard/status', undefined, DashboardStatusSchema)
}

export async function updateSlackToken(
  token: string
): Promise<SlackValidation> {
  return api.put(
    '/api/dashboard/tokens/slack',
    { token },
    undefined,
    SlackValidationSchema
  )
}

export async function updateAsanaToken(
  token: string
): Promise<AsanaValidation> {
  return api.put(
    '/api/dashboard/tokens/asana',
    { token },
    undefined,
    AsanaValidationSchema
  )
}
