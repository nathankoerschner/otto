import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SetupProgress } from './SetupProgress'

describe('SetupProgress', () => {
  it('renders all step labels', () => {
    render(<SetupProgress currentStep="register" />)

    expect(screen.getByText('Register')).toBeInTheDocument()
    expect(screen.getByText('Integrations')).toBeInTheDocument()
    expect(screen.getByText('Complete')).toBeInTheDocument()
  })

  describe('step indicators', () => {
    it('shows step numbers when not completed', () => {
      render(<SetupProgress currentStep="register" />)

      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('shows checkmark for completed steps', () => {
      render(<SetupProgress currentStep="complete" />)

      // Steps 1 and 2 (register and tokens) are completed when on complete
      // The checkmark is rendered as an SVG, so we check for its presence
      const circles = document.querySelectorAll('.rounded-full')

      // First two circles should have completed styling (bg-primary)
      expect(circles[0]).toHaveClass('bg-primary')
      expect(circles[1]).toHaveClass('bg-primary')
    })
  })

  describe('current step highlighting', () => {
    it('highlights register as current when on register step', () => {
      render(<SetupProgress currentStep="register" />)

      const registerLabel = screen.getByText('Register')
      expect(registerLabel).toHaveClass('font-medium', 'text-primary')
    })

    it('highlights integrations as current when on tokens step', () => {
      render(<SetupProgress currentStep="tokens" />)

      const tokensLabel = screen.getByText('Integrations')
      expect(tokensLabel).toHaveClass('font-medium', 'text-primary')
    })

    it('highlights complete as current when on complete step', () => {
      render(<SetupProgress currentStep="complete" />)

      const completeLabel = screen.getByText('Complete')
      expect(completeLabel).toHaveClass('font-medium', 'text-primary')
    })
  })

  describe('connector lines', () => {
    it('shows muted connectors for future steps', () => {
      render(<SetupProgress currentStep="register" />)

      const connectors = document.querySelectorAll('.h-0\\.5')
      // All connectors should be muted since we're on the first step
      connectors.forEach((connector) => {
        expect(connector).toHaveClass('bg-muted')
      })
    })

    it('shows primary connectors for completed steps', () => {
      render(<SetupProgress currentStep="complete" />)

      const connectors = document.querySelectorAll('.h-0\\.5')
      // All connectors should be primary since all steps are completed
      connectors.forEach((connector) => {
        expect(connector).toHaveClass('bg-primary')
      })
    })

    it('shows mixed connectors when partially complete', () => {
      render(<SetupProgress currentStep="tokens" />)

      const connectors = document.querySelectorAll('.h-0\\.5')
      // First connector should be primary (completed)
      // Second connector should be muted (not yet completed)
      expect(connectors[0]).toHaveClass('bg-primary')
      expect(connectors[1]).toHaveClass('bg-muted')
    })
  })

  describe('step circle styling', () => {
    it('applies border-primary to current step circle', () => {
      render(<SetupProgress currentStep="tokens" />)

      const circles = document.querySelectorAll('.rounded-full')
      // Second circle (tokens) should have current styling
      expect(circles[1]).toHaveClass('border-primary')
      expect(circles[1]).not.toHaveClass('bg-primary')
    })

    it('applies muted styling to future step circles', () => {
      render(<SetupProgress currentStep="register" />)

      const circles = document.querySelectorAll('.rounded-full')
      // Circles 2 and 3 should be muted (future steps)
      expect(circles[1]).toHaveClass('border-muted')
      expect(circles[2]).toHaveClass('border-muted')
    })
  })
})
