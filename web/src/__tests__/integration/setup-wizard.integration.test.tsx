/**
 * Integration tests for the complete Setup Wizard flow.
 * These tests verify the full user journey from workspace creation
 * through OAuth connections to completion.
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders, userEvent } from '@/test-utils'
import { Setup } from '@/pages/Setup'
import { useSetupState } from '@/hooks'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

// Mock data
const mockTenant = {
  id: 'tenant-integration-test',
  name: 'Integration Test Workspace',
  slackWorkspaceId: null,
  asanaWorkspaceId: null,
  adminSlackUserId: null,
  createdAt: '2024-01-01T00:00:00Z',
}

let mockSetupStatus = {
  tenantId: 'tenant-integration-test',
  slackConnected: false,
  asanaConnected: false,
  isComplete: false,
}

const server = setupServer(
  http.post('/api/tenants', async ({ request }) => {
    const body = (await request.json()) as { name: string; adminEmail: string }
    return HttpResponse.json({
      ...mockTenant,
      name: body.name,
    })
  }),
  http.get('/api/setup/status/:tenantId', () => {
    return HttpResponse.json(mockSetupStatus)
  }),
  http.post('/api/oauth/slack/authorize', () => {
    return HttpResponse.json({
      redirectUrl: 'https://slack.com/oauth/authorize?client_id=test',
    })
  }),
  http.post('/api/oauth/asana/authorize', () => {
    return HttpResponse.json({
      redirectUrl: 'https://app.asana.com/oauth/authorize?client_id=test',
    })
  })
)

beforeAll(() => server.listen())
afterAll(() => server.close())

beforeEach(() => {
  server.resetHandlers()
  vi.restoreAllMocks()
  useSetupState.getState().reset()
  localStorage.clear()
  // Reset mock status
  mockSetupStatus = {
    tenantId: 'tenant-integration-test',
    slackConnected: false,
    asanaConnected: false,
    isComplete: false,
  }
})

describe('Setup Wizard Integration', () => {
  describe('Complete Setup Flow', () => {
    it('completes workspace step and transitions to slack', async () => {
      const user = userEvent.setup()

      renderWithProviders(<Setup />)

      // Step 1: Verify we're on the workspace step
      expect(screen.getByText('Create your workspace')).toBeInTheDocument()

      // Verify progress shows workspace as current
      const progressSteps = screen.getAllByText(/^(Workspace|Slack|Asana|Complete)$/)
      expect(progressSteps).toHaveLength(4)

      // Fill out workspace form
      await user.type(
        screen.getByLabelText('Workspace Name'),
        'My Integration Test Workspace'
      )
      await user.type(
        screen.getByLabelText('Admin Email'),
        'admin@integration-test.com'
      )

      // Submit form
      await user.click(screen.getByRole('button', { name: 'Continue' }))

      // Step 2: Wait for transition to Slack step
      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: 'Connect Slack' })
        ).toBeInTheDocument()
      })

      // Verify Slack permissions are displayed
      expect(
        screen.getByText('Send direct messages to team members')
      ).toBeInTheDocument()
    })

    it('initiates Slack OAuth flow', async () => {
      const user = userEvent.setup()
      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

      // Start at Slack step
      useSetupState.getState().setTenantId('tenant-integration-test')
      useSetupState.getState().goToStep('slack')

      renderWithProviders(<Setup />)

      // Click connect Slack
      await user.click(screen.getByRole('button', { name: /connect slack/i }))

      // Verify OAuth popup was opened
      await waitFor(() => {
        expect(windowOpenSpy).toHaveBeenCalledWith(
          expect.stringContaining('slack.com/oauth'),
          '_blank',
          'width=600,height=700'
        )
      })

      windowOpenSpy.mockRestore()
    })

    it('transitions from slack to asana when slack is connected', async () => {
      const user = userEvent.setup()

      // Start at Slack step with connection already complete
      useSetupState.getState().setTenantId('tenant-integration-test')
      useSetupState.getState().setSlackConnected(true)
      useSetupState.getState().goToStep('slack')

      renderWithProviders(<Setup />)

      // Verify continue button is shown
      expect(
        screen.getByRole('button', { name: 'Continue to Asana' })
      ).toBeInTheDocument()

      // Click continue
      await user.click(screen.getByRole('button', { name: 'Continue to Asana' }))

      // Verify transition to Asana step
      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: 'Connect Asana' })
        ).toBeInTheDocument()
      })

      // Verify Asana permissions are displayed
      expect(
        screen.getByText('Read and update tasks assigned to the bot')
      ).toBeInTheDocument()
    })

    it('transitions from asana to complete when asana is connected', async () => {
      const user = userEvent.setup()

      // Start at Asana step with connection already complete
      useSetupState.getState().setTenantId('tenant-integration-test')
      useSetupState.getState().setSlackConnected(true)
      useSetupState.getState().setAsanaConnected(true)
      useSetupState.getState().goToStep('asana')

      renderWithProviders(<Setup />)

      // Click complete setup
      await user.click(screen.getByRole('button', { name: 'Complete Setup' }))

      // Verify completion screen
      await waitFor(() => {
        expect(screen.getByText("You're all set!")).toBeInTheDocument()
      })

      // Verify next steps are shown
      expect(screen.getByText('Next steps:')).toBeInTheDocument()
      expect(
        screen.getByText('Create an Asana bot user and add it to your projects')
      ).toBeInTheDocument()

      // Verify navigation options
      expect(
        screen.getByRole('button', { name: 'Set up another workspace' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('link', { name: 'Go to Homepage' })
      ).toBeInTheDocument()
    })

    it('allows restarting the setup wizard after completion', async () => {
      const user = userEvent.setup()

      // Start at completion step
      useSetupState.getState().setTenantId('tenant-123')
      useSetupState.getState().setSlackConnected(true)
      useSetupState.getState().setAsanaConnected(true)
      useSetupState.getState().goToStep('complete')

      renderWithProviders(<Setup />)

      // Verify we're on complete step
      expect(screen.getByText("You're all set!")).toBeInTheDocument()

      // Click to set up another workspace
      await user.click(
        screen.getByRole('button', { name: 'Set up another workspace' })
      )

      // Verify we're back at workspace step
      await waitFor(() => {
        expect(screen.getByText('Create your workspace')).toBeInTheDocument()
      })

      // Verify state was reset
      expect(useSetupState.getState().tenantId).toBeNull()
      expect(useSetupState.getState().slackConnected).toBe(false)
      expect(useSetupState.getState().asanaConnected).toBe(false)
      expect(useSetupState.getState().step).toBe('workspace')
    })
  })

  describe('Form Validation Flow', () => {
    it('prevents progression with empty form', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Setup />)

      // Try to submit empty form
      await user.click(screen.getByRole('button', { name: 'Continue' }))

      // Verify validation errors appear
      await waitFor(() => {
        expect(
          screen.getByText('Workspace name is required')
        ).toBeInTheDocument()
      })

      // Verify we haven't progressed
      expect(screen.getByText('Create your workspace')).toBeInTheDocument()
    })

    it('shows aria-invalid on required fields when empty', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Setup />)

      // Try to submit empty form
      await user.click(screen.getByRole('button', { name: 'Continue' }))

      // Verify inputs are marked as invalid
      await waitFor(() => {
        expect(screen.getByLabelText('Workspace Name')).toHaveAttribute(
          'aria-invalid',
          'true'
        )
      })
    })
  })

  describe('Error Handling Flow', () => {
    it('handles API errors gracefully during workspace creation', async () => {
      const user = userEvent.setup()

      // Override handler to return error
      server.use(
        http.post('/api/tenants', () => {
          return new HttpResponse(null, { status: 500 })
        })
      )

      renderWithProviders(<Setup />)

      await user.type(screen.getByLabelText('Workspace Name'), 'Test Workspace')
      await user.type(
        screen.getByLabelText('Admin Email'),
        'admin@example.com'
      )
      await user.click(screen.getByRole('button', { name: 'Continue' }))

      // Verify error message is shown
      await waitFor(() => {
        expect(
          screen.getByText('Failed to create workspace. Please try again.')
        ).toBeInTheDocument()
      })

      // Verify we haven't progressed
      expect(screen.getByText('Create your workspace')).toBeInTheDocument()
    })

    it('handles OAuth initiation errors gracefully', async () => {
      const user = userEvent.setup()

      // Start at Slack step
      useSetupState.getState().setTenantId('tenant-123')
      useSetupState.getState().goToStep('slack')

      // Override handler to return error
      server.use(
        http.post('/api/oauth/slack/authorize', () => {
          return new HttpResponse(null, { status: 500 })
        })
      )

      renderWithProviders(<Setup />)

      await user.click(screen.getByRole('button', { name: /connect slack/i }))

      // Verify error message is shown
      await waitFor(() => {
        expect(
          screen.getByText('Failed to initiate Slack connection. Please try again.')
        ).toBeInTheDocument()
      })
    })
  })

  describe('State Persistence', () => {
    it('persists setup state across component remounts', async () => {
      const user = userEvent.setup()
      const { unmount } = renderWithProviders(<Setup />)

      // Complete workspace step
      await user.type(screen.getByLabelText('Workspace Name'), 'Persistent Workspace')
      await user.type(
        screen.getByLabelText('Admin Email'),
        'admin@persistent.com'
      )
      await user.click(screen.getByRole('button', { name: 'Continue' }))

      // Wait for transition
      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: 'Connect Slack' })
        ).toBeInTheDocument()
      })

      // Unmount and remount
      unmount()

      // Verify state persisted in localStorage
      const stored = localStorage.getItem('otto-setup-state')
      expect(stored).not.toBeNull()
      const parsed = JSON.parse(stored!)
      expect(parsed.state.step).toBe('slack')
      expect(parsed.state.tenantId).toBe('tenant-integration-test')
    })
  })

  describe('Progress Indicator Integration', () => {
    it('shows workspace as current step initially', () => {
      renderWithProviders(<Setup />)

      expect(screen.getByText('Workspace')).toHaveClass('text-primary')
    })

    it('shows slack as current step when on slack step', () => {
      useSetupState.getState().setTenantId('tenant-123')
      useSetupState.getState().goToStep('slack')

      renderWithProviders(<Setup />)

      expect(screen.getByText('Slack')).toHaveClass('text-primary')
    })

    it('shows asana as current step when on asana step', () => {
      useSetupState.getState().setTenantId('tenant-123')
      useSetupState.getState().setSlackConnected(true)
      useSetupState.getState().goToStep('asana')

      renderWithProviders(<Setup />)

      expect(screen.getByText('Asana')).toHaveClass('text-primary')
    })

    it('shows complete as current step when on complete step', () => {
      useSetupState.getState().setTenantId('tenant-123')
      useSetupState.getState().setSlackConnected(true)
      useSetupState.getState().setAsanaConnected(true)
      useSetupState.getState().goToStep('complete')

      renderWithProviders(<Setup />)

      expect(screen.getByText('Complete')).toHaveClass('text-primary')
    })
  })
})
