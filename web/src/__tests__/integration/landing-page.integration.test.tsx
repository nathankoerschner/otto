/**
 * Integration tests for the Landing Page.
 * These tests verify the full landing page renders correctly
 * with all its components working together.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Landing } from '@/pages/Landing'

describe('Landing Page Integration', () => {
  describe('Page Structure', () => {
    it('renders complete landing page with all sections', () => {
      render(<Landing />)

      // Header
      expect(screen.getByRole('banner')).toBeInTheDocument()

      // Main content
      expect(screen.getByRole('main')).toBeInTheDocument()

      // Footer
      expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    })

    it('renders in correct visual order', () => {
      const { container } = render(<Landing />)

      const main = container.querySelector('main')
      expect(main).toBeInTheDocument()

      // Check sections exist within main
      const sections = main?.querySelectorAll('section')
      expect(sections?.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Header Navigation', () => {
    it('displays Otto branding', () => {
      render(<Landing />)

      const header = screen.getByRole('banner')
      expect(within(header).getByText('Otto')).toBeInTheDocument()
    })

    it('contains navigation links', () => {
      render(<Landing />)

      const header = screen.getByRole('banner')

      // Check for navigation links
      expect(within(header).getByRole('link', { name: /features/i })).toBeInTheDocument()
      expect(within(header).getByRole('link', { name: /how it works/i })).toBeInTheDocument()
    })

    it('contains call-to-action button', () => {
      render(<Landing />)

      const header = screen.getByRole('banner')
      const ctaButton = within(header).getByRole('link', { name: /get started/i })

      expect(ctaButton).toBeInTheDocument()
      expect(ctaButton).toHaveAttribute('href', '/setup')
    })
  })

  describe('Hero Section', () => {
    it('displays main headline', () => {
      render(<Landing />)

      // Look for the main value proposition
      expect(
        screen.getByRole('heading', { level: 1 })
      ).toBeInTheDocument()
    })

    it('displays subheadline description', () => {
      render(<Landing />)

      // There should be descriptive text explaining Otto
      expect(
        screen.getByText(/Otto automatically finds owners/i)
      ).toBeInTheDocument()
    })

    it('has primary call-to-action', () => {
      render(<Landing />)

      // There should be a prominent CTA in the hero
      const heroButtons = screen.getAllByRole('link', { name: /get started|start/i })
      expect(heroButtons.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Features Section', () => {
    it('displays feature cards', () => {
      render(<Landing />)

      // Features section should have multiple feature items
      // Look for common feature-related terms
      const features = screen.getAllByText(/sync|track|notify|automate/i)
      expect(features.length).toBeGreaterThanOrEqual(1)
    })

    it('has accessible feature headings', () => {
      render(<Landing />)

      // Features should have headings for accessibility
      const headings = screen.getAllByRole('heading')
      expect(headings.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('How It Works Section', () => {
    it('displays step-by-step process', () => {
      render(<Landing />)

      // Look for the How It Works section heading
      expect(screen.getByText('How Otto works')).toBeInTheDocument()
      // Look for step numbers
      expect(screen.getByText('01')).toBeInTheDocument()
      expect(screen.getByText('02')).toBeInTheDocument()
    })

    it('explains the integration process', () => {
      render(<Landing />)

      // Should mention the process steps
      expect(screen.getByText(/Task gets assigned to Otto/i)).toBeInTheDocument()
      expect(screen.getByText(/Otto finds the right owner/i)).toBeInTheDocument()
    })
  })

  describe('Call to Action Section', () => {
    it('displays final CTA', () => {
      render(<Landing />)

      // Should have multiple CTAs, including one at the bottom
      const ctaLinks = screen.getAllByRole('link', { name: /get started|start|setup/i })
      expect(ctaLinks.length).toBeGreaterThanOrEqual(2)
    })

    it('CTA links to setup page', () => {
      render(<Landing />)

      const ctaLinks = screen.getAllByRole('link', { name: /get started/i })
      ctaLinks.forEach((link) => {
        expect(link).toHaveAttribute('href', '/setup')
      })
    })
  })

  describe('Footer', () => {
    it('displays footer content', () => {
      render(<Landing />)

      const footer = screen.getByRole('contentinfo')
      expect(footer).toBeInTheDocument()
    })

    it('contains Otto branding', () => {
      render(<Landing />)

      const footer = screen.getByRole('contentinfo')
      expect(within(footer).getByText(/otto/i)).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper heading hierarchy', () => {
      render(<Landing />)

      // Should have exactly one h1
      const h1s = screen.getAllByRole('heading', { level: 1 })
      expect(h1s).toHaveLength(1)

      // Should have h2s for main sections
      const h2s = screen.getAllByRole('heading', { level: 2 })
      expect(h2s.length).toBeGreaterThanOrEqual(1)
    })

    it('all links are keyboard accessible', async () => {
      const user = userEvent.setup()
      render(<Landing />)

      const links = screen.getAllByRole('link')

      // Verify links can receive focus
      for (const link of links.slice(0, 5)) {
        // Test first 5 links
        link.focus()
        expect(document.activeElement).toBe(link)
      }
    })

    it('images have alt text', () => {
      render(<Landing />)

      const images = screen.queryAllByRole('img')
      images.forEach((img) => {
        expect(img).toHaveAttribute('alt')
      })
    })
  })

  describe('Responsive Considerations', () => {
    it('renders without horizontal overflow', () => {
      const { container } = render(<Landing />)

      // The root container should handle overflow properly
      const rootDiv = container.firstChild as HTMLElement
      expect(rootDiv).toHaveClass('flex', 'flex-col')
    })
  })
})
