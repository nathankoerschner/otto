import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from './input'

describe('Input', () => {
  it('renders an input element', () => {
    render(<Input />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('accepts and displays text input', async () => {
    const user = userEvent.setup()
    render(<Input />)

    const input = screen.getByRole('textbox')
    await user.type(input, 'Hello World')

    expect(input).toHaveValue('Hello World')
  })

  it('handles onChange events', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<Input onChange={handleChange} />)

    await user.type(screen.getByRole('textbox'), 'a')
    expect(handleChange).toHaveBeenCalled()
  })

  it('can be disabled', () => {
    render(<Input disabled />)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('does not accept input when disabled', async () => {
    const user = userEvent.setup()
    render(<Input disabled />)

    const input = screen.getByRole('textbox')
    await user.type(input, 'test')

    expect(input).toHaveValue('')
  })

  it('displays placeholder text', () => {
    render(<Input placeholder="Enter your name" />)
    expect(screen.getByPlaceholderText('Enter your name')).toBeInTheDocument()
  })

  it('applies different input types', () => {
    const { container } = render(<Input type="email" />)
    const input = container.querySelector('input')
    expect(input).toHaveAttribute('type', 'email')
  })

  it('renders password type without visible text', () => {
    const { container } = render(<Input type="password" defaultValue="secret" />)
    const input = container.querySelector('input')
    expect(input).toHaveAttribute('type', 'password')
  })

  it('applies custom className', () => {
    render(<Input className="custom-input" />)
    expect(screen.getByRole('textbox')).toHaveClass('custom-input')
  })

  it('forwards ref correctly', () => {
    const ref = vi.fn()
    render(<Input ref={ref} />)
    expect(ref).toHaveBeenCalled()
    expect(ref.mock.calls[0]?.[0]).toBeInstanceOf(HTMLInputElement)
  })

  it('supports controlled value', () => {
    const { rerender } = render(<Input value="initial" onChange={() => {}} />)
    expect(screen.getByRole('textbox')).toHaveValue('initial')

    rerender(<Input value="updated" onChange={() => {}} />)
    expect(screen.getByRole('textbox')).toHaveValue('updated')
  })

  it('supports aria-invalid attribute', () => {
    render(<Input aria-invalid="true" />)
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
  })

  it('supports id for label association', () => {
    render(
      <>
        <label htmlFor="test-input">Name</label>
        <Input id="test-input" />
      </>
    )
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
  })
})
