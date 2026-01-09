import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SetupComplete } from './SetupComplete'

describe('SetupComplete', () => {
  it('renders success title', () => {
    const onReset = vi.fn()
    render(<SetupComplete onReset={onReset} />)

    expect(screen.getByText("You're all set!")).toBeInTheDocument()
  })

  it('renders success description', () => {
    const onReset = vi.fn()
    render(<SetupComplete onReset={onReset} />)

    expect(
      screen.getByText(
        'Otto is now connected to your Slack and Asana workspaces.'
      )
    ).toBeInTheDocument()
  })

  it('renders next steps heading', () => {
    const onReset = vi.fn()
    render(<SetupComplete onReset={onReset} />)

    expect(screen.getByText('Next steps:')).toBeInTheDocument()
  })

  it('renders all next steps items', () => {
    const onReset = vi.fn()
    render(<SetupComplete onReset={onReset} />)

    expect(
      screen.getByText('Create an Asana bot user and add it to your projects')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Set up your Google Sheet with task-to-owner mappings')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Assign a task to the bot user to test the flow')
    ).toBeInTheDocument()
  })

  it('renders reset button', () => {
    const onReset = vi.fn()
    render(<SetupComplete onReset={onReset} />)

    expect(
      screen.getByRole('button', { name: 'Set up another workspace' })
    ).toBeInTheDocument()
  })

  it('renders homepage link', () => {
    const onReset = vi.fn()
    render(<SetupComplete onReset={onReset} />)

    const link = screen.getByRole('link', { name: 'Go to Homepage' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/')
  })

  it('calls onReset when reset button is clicked', async () => {
    const user = userEvent.setup()
    const onReset = vi.fn()
    render(<SetupComplete onReset={onReset} />)

    await user.click(
      screen.getByRole('button', { name: 'Set up another workspace' })
    )

    expect(onReset).toHaveBeenCalledTimes(1)
  })

  it('applies outline variant to reset button', () => {
    const onReset = vi.fn()
    render(<SetupComplete onReset={onReset} />)

    const button = screen.getByRole('button', {
      name: 'Set up another workspace',
    })
    expect(button).toHaveClass('border')
  })
})
