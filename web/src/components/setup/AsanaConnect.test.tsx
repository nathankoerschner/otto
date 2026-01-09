import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders, userEvent } from '@/test-utils'
import { AsanaConnect } from './AsanaConnect'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

const mockOAuthResponse = {
  redirectUrl: 'https://app.asana.com/oauth/authorize?client_id=123',
}

const server = setupServer(
  http.post('/api/oauth/asana/authorize', () => {
    return HttpResponse.json(mockOAuthResponse)
  })
)

beforeEach(() => {
  server.resetHandlers()
  vi.restoreAllMocks()
})

beforeAll(() => server.listen())
afterAll(() => server.close())

describe('AsanaConnect', () => {
  describe('when not connected', () => {
    it('renders connect asana title', () => {
      const onComplete = vi.fn()
      renderWithProviders(
        <AsanaConnect
          tenantId="tenant-123"
          isConnected={false}
          onComplete={onComplete}
        />
      )

      expect(screen.getByRole('heading', { name: 'Connect Asana' })).toBeInTheDocument()
    })

    it('renders description of Asana permissions', () => {
      const onComplete = vi.fn()
      renderWithProviders(
        <AsanaConnect
          tenantId="tenant-123"
          isConnected={false}
          onComplete={onComplete}
        />
      )

      expect(
        screen.getByText(
          'Allow Otto to manage tasks and receive webhook notifications from Asana.'
        )
      ).toBeInTheDocument()
    })

    it('renders list of permissions', () => {
      const onComplete = vi.fn()
      renderWithProviders(
        <AsanaConnect
          tenantId="tenant-123"
          isConnected={false}
          onComplete={onComplete}
        />
      )

      expect(
        screen.getByText('Read and update tasks assigned to the bot')
      ).toBeInTheDocument()
      expect(
        screen.getByText('Receive notifications when tasks are assigned')
      ).toBeInTheDocument()
      expect(screen.getByText('Add comments to tasks')).toBeInTheDocument()
    })

    it('renders connect button', () => {
      const onComplete = vi.fn()
      renderWithProviders(
        <AsanaConnect
          tenantId="tenant-123"
          isConnected={false}
          onComplete={onComplete}
        />
      )

      expect(
        screen.getByRole('button', { name: /connect asana/i })
      ).toBeInTheDocument()
    })

    it('opens OAuth popup when connect button is clicked', async () => {
      const user = userEvent.setup()
      const onComplete = vi.fn()
      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

      renderWithProviders(
        <AsanaConnect
          tenantId="tenant-123"
          isConnected={false}
          onComplete={onComplete}
        />
      )

      await user.click(screen.getByRole('button', { name: /connect asana/i }))

      await waitFor(() => {
        expect(windowOpenSpy).toHaveBeenCalledWith(
          mockOAuthResponse.redirectUrl,
          '_blank',
          'width=600,height=700'
        )
      })
    })

    it('shows loading state while initiating OAuth', async () => {
      const user = userEvent.setup()
      const onComplete = vi.fn()

      server.use(
        http.post('/api/oauth/asana/authorize', async () => {
          await new Promise((resolve) => setTimeout(resolve, 100))
          return HttpResponse.json(mockOAuthResponse)
        })
      )

      renderWithProviders(
        <AsanaConnect
          tenantId="tenant-123"
          isConnected={false}
          onComplete={onComplete}
        />
      )

      await user.click(screen.getByRole('button', { name: /connect asana/i }))

      expect(screen.getByText('Connecting...')).toBeInTheDocument()
      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('shows error message when OAuth initiation fails', async () => {
      const user = userEvent.setup()
      const onComplete = vi.fn()

      server.use(
        http.post('/api/oauth/asana/authorize', () => {
          return new HttpResponse(null, { status: 500 })
        })
      )

      renderWithProviders(
        <AsanaConnect
          tenantId="tenant-123"
          isConnected={false}
          onComplete={onComplete}
        />
      )

      await user.click(screen.getByRole('button', { name: /connect asana/i }))

      await waitFor(() => {
        expect(
          screen.getByText(
            'Failed to initiate Asana connection. Please try again.'
          )
        ).toBeInTheDocument()
      })
    })
  })

  describe('when connected', () => {
    it('renders connected state title', () => {
      const onComplete = vi.fn()
      renderWithProviders(
        <AsanaConnect
          tenantId="tenant-123"
          isConnected={true}
          onComplete={onComplete}
        />
      )

      expect(screen.getByText('Asana Connected')).toBeInTheDocument()
    })

    it('renders success description', () => {
      const onComplete = vi.fn()
      renderWithProviders(
        <AsanaConnect
          tenantId="tenant-123"
          isConnected={true}
          onComplete={onComplete}
        />
      )

      expect(
        screen.getByText('Your Asana workspace is successfully connected.')
      ).toBeInTheDocument()
    })

    it('renders complete setup button', () => {
      const onComplete = vi.fn()
      renderWithProviders(
        <AsanaConnect
          tenantId="tenant-123"
          isConnected={true}
          onComplete={onComplete}
        />
      )

      expect(
        screen.getByRole('button', { name: 'Complete Setup' })
      ).toBeInTheDocument()
    })

    it('calls onComplete when complete button is clicked', async () => {
      const user = userEvent.setup()
      const onComplete = vi.fn()

      renderWithProviders(
        <AsanaConnect
          tenantId="tenant-123"
          isConnected={true}
          onComplete={onComplete}
        />
      )

      await user.click(screen.getByRole('button', { name: 'Complete Setup' }))

      expect(onComplete).toHaveBeenCalledTimes(1)
    })

    it('does not show permissions list when connected', () => {
      const onComplete = vi.fn()
      renderWithProviders(
        <AsanaConnect
          tenantId="tenant-123"
          isConnected={true}
          onComplete={onComplete}
        />
      )

      expect(
        screen.queryByText('Read and update tasks assigned to the bot')
      ).not.toBeInTheDocument()
    })
  })
})
