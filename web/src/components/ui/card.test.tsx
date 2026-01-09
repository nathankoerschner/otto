import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './card'

describe('Card', () => {
  it('renders card with children', () => {
    render(<Card>Card content</Card>)
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })

  it('applies default classes', () => {
    render(<Card data-testid="card">Content</Card>)
    const card = screen.getByTestId('card')
    expect(card).toHaveClass('rounded-lg', 'border', 'shadow-sm')
  })

  it('applies custom className', () => {
    render(
      <Card className="custom-card" data-testid="card">
        Content
      </Card>
    )
    expect(screen.getByTestId('card')).toHaveClass('custom-card')
  })

  it('forwards ref correctly', () => {
    const ref = vi.fn()
    render(<Card ref={ref}>Content</Card>)
    expect(ref).toHaveBeenCalled()
    expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLDivElement)
  })
})

describe('CardHeader', () => {
  it('renders header with children', () => {
    render(<CardHeader>Header content</CardHeader>)
    expect(screen.getByText('Header content')).toBeInTheDocument()
  })

  it('applies default padding classes', () => {
    render(<CardHeader data-testid="header">Content</CardHeader>)
    expect(screen.getByTestId('header')).toHaveClass('p-6')
  })

  it('applies custom className', () => {
    render(
      <CardHeader className="custom-header" data-testid="header">
        Content
      </CardHeader>
    )
    expect(screen.getByTestId('header')).toHaveClass('custom-header')
  })
})

describe('CardTitle', () => {
  it('renders title as h3 element', () => {
    render(<CardTitle>My Title</CardTitle>)
    const title = screen.getByRole('heading', { level: 3 })
    expect(title).toHaveTextContent('My Title')
  })

  it('applies typography classes', () => {
    render(<CardTitle data-testid="title">Title</CardTitle>)
    const title = screen.getByTestId('title')
    expect(title).toHaveClass('text-2xl', 'font-semibold')
  })

  it('applies custom className', () => {
    render(
      <CardTitle className="custom-title" data-testid="title">
        Title
      </CardTitle>
    )
    expect(screen.getByTestId('title')).toHaveClass('custom-title')
  })
})

describe('CardDescription', () => {
  it('renders description as paragraph', () => {
    render(<CardDescription>Description text</CardDescription>)
    expect(screen.getByText('Description text').tagName).toBe('P')
  })

  it('applies muted text classes', () => {
    render(
      <CardDescription data-testid="desc">Description</CardDescription>
    )
    expect(screen.getByTestId('desc')).toHaveClass('text-muted-foreground')
  })

  it('applies custom className', () => {
    render(
      <CardDescription className="custom-desc" data-testid="desc">
        Description
      </CardDescription>
    )
    expect(screen.getByTestId('desc')).toHaveClass('custom-desc')
  })
})

describe('CardContent', () => {
  it('renders content with children', () => {
    render(<CardContent>Main content</CardContent>)
    expect(screen.getByText('Main content')).toBeInTheDocument()
  })

  it('applies padding classes', () => {
    render(<CardContent data-testid="content">Content</CardContent>)
    const content = screen.getByTestId('content')
    expect(content).toHaveClass('p-6', 'pt-0')
  })

  it('applies custom className', () => {
    render(
      <CardContent className="custom-content" data-testid="content">
        Content
      </CardContent>
    )
    expect(screen.getByTestId('content')).toHaveClass('custom-content')
  })
})

describe('CardFooter', () => {
  it('renders footer with children', () => {
    render(<CardFooter>Footer content</CardFooter>)
    expect(screen.getByText('Footer content')).toBeInTheDocument()
  })

  it('applies flex layout classes', () => {
    render(<CardFooter data-testid="footer">Footer</CardFooter>)
    const footer = screen.getByTestId('footer')
    expect(footer).toHaveClass('flex', 'items-center')
  })

  it('applies custom className', () => {
    render(
      <CardFooter className="custom-footer" data-testid="footer">
        Footer
      </CardFooter>
    )
    expect(screen.getByTestId('footer')).toHaveClass('custom-footer')
  })
})

describe('Card composition', () => {
  it('renders a complete card with all sub-components', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Card Title</CardTitle>
          <CardDescription>Card description text</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Main content goes here</p>
        </CardContent>
        <CardFooter>
          <button>Action</button>
        </CardFooter>
      </Card>
    )

    expect(screen.getByRole('heading', { name: 'Card Title' })).toBeInTheDocument()
    expect(screen.getByText('Card description text')).toBeInTheDocument()
    expect(screen.getByText('Main content goes here')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
  })
})
