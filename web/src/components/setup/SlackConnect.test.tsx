import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders, userEvent } from '@/test-utils'
import { SlackConnect } from './SlackConnect'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

const mockOAuthResponse = {
  redirectUrl: 'https://slack.com/oauth/authorize?client_id=123',
}

const server = setupServer(
  http.post('/api/oauth/slack/authorize', () => {
    return HttpResponse.json(mockOAuthResponse)
  })
)

beforeEach(() => {
  server.resetHandlers()
  vi.restoreAllMocks()
})

beforeAll(() => server.listen())
afterAll(() => server.close())

describe('SlackConnect', () => {
  describe('when not connected', () => {
    it('renders connect slack title', () => {
      const onComplete = vi.fn()
      renderWithProviders(
        <SlackConnect
          tenantId="tenant-123"
          isConnected={false}
          onComplete={onComplete}
        />
      )

      expect(screen.getByRole('heading', { name: 'Connect Slack' })).toBeInTheDocument()
    })

    it('renders description of Slack permissions', () => {
      const onComplete = vi.fn()
      renderWithProviders(
        <SlackConnect
          tenantId="tenant-123"
          isConnected={false}
          onComplete={onComplete}
        />
      )

      expect(
        screen.getByText(
          'Allow Otto to send messages and interact with your team on Slack.'
        )
      ).toBeInTheDocument()
    })

    it('renders list of permissions', () => {
      const onComplete = vi.fn()
      renderWithProviders(
        <SlackConnect
          tenantId="tenant-123"
          isConnected={false}
          onComplete={onComplete}
        />
      )

      expect(
        screen.getByText('Send direct messages to team members')
      ).toBeInTheDocument()
      expect(
        screen.getByText('Read messages in channels Otto is added to')
      ).toBeInTheDocument()
      expect(screen.getByText('Look up user information')).toBeInTheDocument()
    })

    it('renders connect button', () => {
      const onComplete = vi.fn()
      renderWithProviders(
        <SlackConnect
          tenantId="tenant-123"
          isConnected={false}
          onComplete={onComplete}
        />
      )

      expect(
        screen.getByRole('button', { name: /connect slack/i })
      ).toBeInTheDocument()
    })

    it('opens OAuth popup when connect button is clicked', async () => {
      const user = userEvent.setup()
      const onComplete = vi.fn()
      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

      renderWithProviders(
        <SlackConnect
          tenantId="tenant-123"
          isConnected={false}
          onComplete={onComplete}
        />
      )

      await user.click(screen.getByRole('button', { name: /connect slack/i }))

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
        http.post('/api/oauth/slack/authorize', async () => {
          await new Promise((resolve) => setTimeout(resolve, 100))
          return HttpResponse.json(mockOAuthResponse)
        })
      )

      renderWithProviders(
        <SlackConnect
          tenantId="tenant-123"
          isConnected={false}
          onComplete={onComplete}
        />
      )

      await user.click(screen.getByRole('button', { name: /connect slack/i }))

      expect(screen.getByText('Connecting...')).toBeInTheDocument()
      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('shows error message when OAuth initiation fails', async () => {
      const user = userEvent.setup()
      const onComplete = vi.fn()

      server.use(
        http.post('/api/oauth/slack/authorize', () => {
          return new HttpResponse(null, { status: 500 })
        })
      )

      renderWithProviders(
        <SlackConnect
          tenantId="tenant-123"
          isConnected={false}
          onComplete={onComplete}
        />
      )

      await user.click(screen.getByRole('button', { name: /connect slack/i }))

      await waitFor(() => {
        expect(
          screen.getByText(
            'Failed to initiate Slack connection. Please try again.'
          )
        ).toBeInTheDocument()
      })
    })
  })

  describe('when connected', () => {
    it('renders connected state title', () => {
      const onComplete = vi.fn()
      renderWithProviders(
        <SlackConnect
          tenantId="tenant-123"
          isConnected={true}
          onComplete={onComplete}
        />
      )

      expect(screen.getByText('Slack Connected')).toBeInTheDocument()
    })

    it('renders success description', () => {
      const onComplete = vi.fn()
      renderWithProviders(
        <SlackConnect
          tenantId="tenant-123"
          isConnected={true}
          onComplete={onComplete}
        />
      )

      expect(
        screen.getByText('Your Slack workspace is successfully connected.')
      ).toBeInTheDocument()
    })

    it('renders continue button', () => {
      const onComplete = vi.fn()
      renderWithProviders(
        <SlackConnect
          tenantId="tenant-123"
          isConnected={true}
          onComplete={onComplete}
        />
      )

      expect(
        screen.getByRole('button', { name: 'Continue to Asana' })
      ).toBeInTheDocument()
    })

    it('calls onComplete when continue button is clicked', async () => {
      const user = userEvent.setup()
      const onComplete = vi.fn()

      renderWithProviders(
        <SlackConnect
          tenantId="tenant-123"
          isConnected={true}
          onComplete={onComplete}
        />
      )

      await user.click(
        screen.getByRole('button', { name: 'Continue to Asana' })
      )

      expect(onComplete).toHaveBeenCalledTimes(1)
    })

    it('does not show permissions list when connected', () => {
      const onComplete = vi.fn()
      renderWithProviders(
        <SlackConnect
          tenantId="tenant-123"
          isConnected={true}
          onComplete={onComplete}
        />
      )

      expect(
        screen.queryByText('Send direct messages to team members')
      ).not.toBeInTheDocument()
    })
  })
})
