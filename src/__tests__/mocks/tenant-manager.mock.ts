/**
 * Mock TenantManagerService for testing
 */
import { Tenant } from '../../models';

export const createMockTenantManager = () => {
  const tenants = new Map<string, Tenant>();

  return {
    tenants,

    addTenant(tenant: Tenant) {
      tenants.set(tenant.id, tenant);
    },

    getTenant: jest.fn((tenantId: string) => tenants.get(tenantId) || undefined),

    getTenantBySlackWorkspace: jest.fn((workspaceId: string) => {
      for (const tenant of tenants.values()) {
        if (tenant.slackWorkspaceId === workspaceId) {
          return tenant;
        }
      }
      return undefined;
    }),

    getTenantByAsanaWorkspace: jest.fn((workspaceId: string) => {
      for (const tenant of tenants.values()) {
        if (tenant.asanaWorkspaceId === workspaceId) {
          return tenant;
        }
      }
      return undefined;
    }),

    getTenantByAsanaBotUserId: jest.fn((botUserId: string) => {
      for (const tenant of tenants.values()) {
        if (tenant.asanaBotUserId === botUserId) {
          return tenant;
        }
      }
      return undefined;
    }),

    getAllTenants: jest.fn(() => Array.from(tenants.values())),

    initializeTenants: jest.fn(async () => {}),

    reset() {
      tenants.clear();
      jest.clearAllMocks();
    },
  };
};

export type MockTenantManager = ReturnType<typeof createMockTenantManager>;
