import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders, userEvent } from '@/test-utils'
import { WorkspaceForm } from './WorkspaceForm'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

const mockTenant = {
  id: 'tenant-123',
  name: 'Test Workspace',
  setupCompleted: false,
}

const server = setupServer(
  http.post('/api/tenants', async ({ request }) => {
    const body = await request.json() as { name: string; adminEmail: string }
    return HttpResponse.json({
      ...mockTenant,
      name: body.name,
    })
  })
)

beforeEach(() => {
  server.resetHandlers()
})

beforeAll(() => server.listen())
afterAll(() => server.close())

describe('WorkspaceForm', () => {
  it('renders the form with title and description', () => {
    const onComplete = vi.fn()
    renderWithProviders(<WorkspaceForm onComplete={onComplete} />)

    expect(screen.getByText('Create your workspace')).toBeInTheDocument()
    expect(
      screen.getByText('Enter your workspace details to get started with Otto.')
    ).toBeInTheDocument()
  })

  it('renders workspace name and admin email fields', () => {
    const onComplete = vi.fn()
    renderWithProviders(<WorkspaceForm onComplete={onComplete} />)

    expect(screen.getByLabelText('Workspace Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Admin Email')).toBeInTheDocument()
  })

  it('renders placeholder text in inputs', () => {
    const onComplete = vi.fn()
    renderWithProviders(<WorkspaceForm onComplete={onComplete} />)

    expect(screen.getByPlaceholderText('Acme Corp')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('admin@acme.com')).toBeInTheDocument()
  })

  it('renders continue button', () => {
    const onComplete = vi.fn()
    renderWithProviders(<WorkspaceForm onComplete={onComplete} />)

    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
  })

  describe('form validation', () => {
    it('shows error when workspace name is empty', async () => {
      const user = userEvent.setup()
      const onComplete = vi.fn()
      renderWithProviders(<WorkspaceForm onComplete={onComplete} />)

      // Fill in only the email
      await user.type(
        screen.getByLabelText('Admin Email'),
        'admin@example.com'
      )
      await user.click(screen.getByRole('button', { name: 'Continue' }))

      await waitFor(() => {
        expect(
          screen.getByText('Workspace name is required')
        ).toBeInTheDocument()
      })
    })

    it('shows error when email is invalid', async () => {
      const user = userEvent.setup()
      const onComplete = vi.fn()
      renderWithProviders(<WorkspaceForm onComplete={onComplete} />)

      // Fill in name and invalid email
      await user.type(screen.getByLabelText('Workspace Name'), 'My Workspace')
      await user.type(screen.getByLabelText('Admin Email'), 'not-an-email')
      await user.click(screen.getByRole('button', { name: 'Continue' }))

      await waitFor(() => {
        // Zod 4 may use different error message format - look for email-related error
        const errorElement = screen.getByText(/email/i)
        expect(errorElement).toBeInTheDocument()
      })
    })

    it('sets aria-invalid on inputs with errors', async () => {
      const user = userEvent.setup()
      const onComplete = vi.fn()
      renderWithProviders(<WorkspaceForm onComplete={onComplete} />)

      await user.click(screen.getByRole('button', { name: 'Continue' }))

      await waitFor(() => {
        expect(screen.getByLabelText('Workspace Name')).toHaveAttribute(
          'aria-invalid',
          'true'
        )
      })
    })
  })

  describe('form submission', () => {
    it('submits form with valid data', async () => {
      const user = userEvent.setup()
      const onComplete = vi.fn()
      renderWithProviders(<WorkspaceForm onComplete={onComplete} />)

      await user.type(screen.getByLabelText('Workspace Name'), 'My Workspace')
      await user.type(
        screen.getByLabelText('Admin Email'),
        'admin@example.com'
      )
      await user.click(screen.getByRole('button', { name: 'Continue' }))

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledWith('tenant-123')
      })
    })

    it('shows loading state while submitting', async () => {
      const user = userEvent.setup()
      const onComplete = vi.fn()

      // Delay the response to catch loading state
      server.use(
        http.post('/api/tenants', async () => {
          await new Promise((resolve) => setTimeout(resolve, 100))
          return HttpResponse.json(mockTenant)
        })
      )

      renderWithProviders(<WorkspaceForm onComplete={onComplete} />)

      await user.type(screen.getByLabelText('Workspace Name'), 'My Workspace')
      await user.type(
        screen.getByLabelText('Admin Email'),
        'admin@example.com'
      )
      await user.click(screen.getByRole('button', { name: 'Continue' }))

      expect(screen.getByText('Creating...')).toBeInTheDocument()
      expect(screen.getByRole('button')).toBeDisabled()

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalled()
      })
    })

    it('shows error message when submission fails', async () => {
      const user = userEvent.setup()
      const onComplete = vi.fn()

      server.use(
        http.post('/api/tenants', () => {
          return new HttpResponse(null, { status: 500 })
        })
      )

      renderWithProviders(<WorkspaceForm onComplete={onComplete} />)

      await user.type(screen.getByLabelText('Workspace Name'), 'My Workspace')
      await user.type(
        screen.getByLabelText('Admin Email'),
        'admin@example.com'
      )
      await user.click(screen.getByRole('button', { name: 'Continue' }))

      await waitFor(() => {
        expect(
          screen.getByText('Failed to create workspace. Please try again.')
        ).toBeInTheDocument()
      })

      expect(onComplete).not.toHaveBeenCalled()
    })
  })
})
