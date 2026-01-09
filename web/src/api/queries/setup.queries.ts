import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../client'
import {
  TenantSchema,
  SetupStatusSchema,
  type Tenant,
  type CreateTenantRequest,
  type SetupStatus,
} from '../types'

export const setupKeys = {
  all: ['setup'] as const,
  tenant: (id: string) => ['setup', 'tenant', id] as const,
  status: (tenantId: string) => ['setup', 'status', tenantId] as const,
}

export function useTenant(tenantId: string | null) {
  return useQuery({
    queryKey: setupKeys.tenant(tenantId ?? ''),
    queryFn: () => api.get<Tenant>(`/api/tenants/${tenantId}`, {}, TenantSchema),
    enabled: tenantId !== null,
  })
}

export function useSetupStatus(tenantId: string | null) {
  return useQuery({
    queryKey: setupKeys.status(tenantId ?? ''),
    queryFn: () =>
      api.get<SetupStatus>(
        `/api/setup/status/${tenantId}`,
        {},
        SetupStatusSchema
      ),
    enabled: tenantId !== null,
    refetchInterval: 5000, // Poll for OAuth completion
  })
}

export function useCreateTenant() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateTenantRequest) =>
      api.post<Tenant>('/api/tenants', data, {}, TenantSchema),
    onSuccess: (tenant) => {
      queryClient.setQueryData(setupKeys.tenant(tenant.id), tenant)
    },
  })
}

export function useInitiateSlackOAuth() {
  return useMutation({
    mutationFn: (tenantId: string) =>
      api.post<{ redirectUrl: string }>(`/api/oauth/slack/authorize`, {
        tenantId,
      }),
  })
}

export function useInitiateAsanaOAuth() {
  return useMutation({
    mutationFn: (tenantId: string) =>
      api.post<{ redirectUrl: string }>(`/api/oauth/asana/authorize`, {
        tenantId,
      }),
  })
}
