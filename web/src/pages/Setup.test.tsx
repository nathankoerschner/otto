import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders, userEvent } from '@/test-utils'
import { Setup } from './Setup'
import { useSetupState } from '@/hooks'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

const mockTenant = {
  id: 'tenant-123',
  name: 'Test Workspace',
  slackWorkspaceId: null,
  asanaWorkspaceId: null,
  adminSlackUserId: null,
  createdAt: '2024-01-01T00:00:00Z',
}

const mockSetupStatus = {
  tenantId: 'tenant-123',
  slackConnected: false,
  asanaConnected: false,
  isComplete: false,
}

const server = setupServer(
  http.post('/api/tenants', () => {
    return HttpResponse.json(mockTenant)
  }),
  http.get('/api/setup/status/:tenantId', () => {
    return HttpResponse.json(mockSetupStatus)
  }),
  http.post('/api/oauth/slack/authorize', () => {
    return HttpResponse.json({
      redirectUrl: 'https://slack.com/oauth/authorize',
    })
  }),
  http.post('/api/oauth/asana/authorize', () => {
    return HttpResponse.json({
      redirectUrl: 'https://app.asana.com/oauth/authorize',
    })
  })
)

beforeEach(() => {
  server.resetHandlers()
  vi.restoreAllMocks()
  // Reset the Zustand store
  useSetupState.getState().reset()
  localStorage.clear()
})

beforeAll(() => server.listen())
afterAll(() => server.close())

describe('Setup', () => {
  it('renders the setup page with header', () => {
    renderWithProviders(<Setup />)

    // Header contains navigation
    expect(screen.getByRole('banner')).toBeInTheDocument()
  })

  it('renders progress indicator', () => {
    renderWithProviders(<Setup />)

    expect(screen.getByText('Workspace')).toBeInTheDocument()
    expect(screen.getByText('Slack')).toBeInTheDocument()
    expect(screen.getByText('Asana')).toBeInTheDocument()
    expect(screen.getByText('Complete')).toBeInTheDocument()
  })

  describe('workspace step', () => {
    it('shows workspace form initially', () => {
      renderWithProviders(<Setup />)

      expect(screen.getByText('Create your workspace')).toBeInTheDocument()
      expect(screen.getByLabelText('Workspace Name')).toBeInTheDocument()
      expect(screen.getByLabelText('Admin Email')).toBeInTheDocument()
    })

    it('advances to slack step after workspace creation', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Setup />)

      await user.type(screen.getByLabelText('Workspace Name'), 'My Workspace')
      await user.type(
        screen.getByLabelText('Admin Email'),
        'admin@example.com'
      )
      await user.click(screen.getByRole('button', { name: 'Continue' }))

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Connect Slack' })).toBeInTheDocument()
      })
    })
  })

  describe('slack step', () => {
    beforeEach(() => {
      // Pre-set state to slack step with connected status already set
      // to avoid the render-during-render warning
      useSetupState.getState().setTenantId('tenant-123')
      useSetupState.getState().goToStep('slack')
    })

    it('shows slack connect component', () => {
      renderWithProviders(<Setup />)

      expect(screen.getByRole('heading', { name: 'Connect Slack' })).toBeInTheDocument()
    })

    it('shows continue button when already connected', async () => {
      // Pre-set slack as connected to avoid polling update during render
      useSetupState.getState().setSlackConnected(true)

      renderWithProviders(<Setup />)

      expect(
        screen.getByRole('button', { name: 'Continue to Asana' })
      ).toBeInTheDocument()
    })
  })

  describe('asana step', () => {
    beforeEach(() => {
      // Pre-set state to asana step
      useSetupState.getState().setTenantId('tenant-123')
      useSetupState.getState().setSlackConnected(true)
      useSetupState.getState().goToStep('asana')
    })

    it('shows asana connect component', () => {
      renderWithProviders(<Setup />)

      expect(screen.getByRole('heading', { name: 'Connect Asana' })).toBeInTheDocument()
    })

    it('shows complete button when already connected', async () => {
      // Pre-set asana as connected to avoid polling update during render
      useSetupState.getState().setAsanaConnected(true)

      renderWithProviders(<Setup />)

      expect(
        screen.getByRole('button', { name: 'Complete Setup' })
      ).toBeInTheDocument()
    })
  })

  describe('complete step', () => {
    beforeEach(() => {
      // Pre-set state to complete step
      useSetupState.getState().setTenantId('tenant-123')
      useSetupState.getState().setSlackConnected(true)
      useSetupState.getState().setAsanaConnected(true)
      useSetupState.getState().goToStep('complete')
    })

    it('shows setup complete component', () => {
      renderWithProviders(<Setup />)

      expect(screen.getByText("You're all set!")).toBeInTheDocument()
    })

    it('resets to workspace step when reset is clicked', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Setup />)

      await user.click(
        screen.getByRole('button', { name: 'Set up another workspace' })
      )

      await waitFor(() => {
        expect(screen.getByText('Create your workspace')).toBeInTheDocument()
      })
    })
  })
})
