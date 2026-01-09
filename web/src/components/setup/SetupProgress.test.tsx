import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SetupProgress } from './SetupProgress'

describe('SetupProgress', () => {
  it('renders all step labels', () => {
    render(<SetupProgress currentStep="workspace" />)

    expect(screen.getByText('Workspace')).toBeInTheDocument()
    expect(screen.getByText('Slack')).toBeInTheDocument()
    expect(screen.getByText('Asana')).toBeInTheDocument()
    expect(screen.getByText('Complete')).toBeInTheDocument()
  })

  describe('step indicators', () => {
    it('shows step numbers when not completed', () => {
      render(<SetupProgress currentStep="workspace" />)

      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('4')).toBeInTheDocument()
    })

    it('shows checkmark for completed steps', () => {
      render(<SetupProgress currentStep="asana" />)

      // Steps 1 and 2 (workspace and slack) are completed when on asana
      // The checkmark is rendered as an SVG, so we check for its presence
      const circles = document.querySelectorAll('.rounded-full')

      // First two circles should have completed styling (bg-primary)
      expect(circles[0]).toHaveClass('bg-primary')
      expect(circles[1]).toHaveClass('bg-primary')
    })
  })

  describe('current step highlighting', () => {
    it('highlights workspace as current when on workspace step', () => {
      render(<SetupProgress currentStep="workspace" />)

      const workspaceLabel = screen.getByText('Workspace')
      expect(workspaceLabel).toHaveClass('font-medium', 'text-primary')
    })

    it('highlights slack as current when on slack step', () => {
      render(<SetupProgress currentStep="slack" />)

      const slackLabel = screen.getByText('Slack')
      expect(slackLabel).toHaveClass('font-medium', 'text-primary')
    })

    it('highlights asana as current when on asana step', () => {
      render(<SetupProgress currentStep="asana" />)

      const asanaLabel = screen.getByText('Asana')
      expect(asanaLabel).toHaveClass('font-medium', 'text-primary')
    })

    it('highlights complete as current when on complete step', () => {
      render(<SetupProgress currentStep="complete" />)

      const completeLabel = screen.getByText('Complete')
      expect(completeLabel).toHaveClass('font-medium', 'text-primary')
    })
  })

  describe('connector lines', () => {
    it('shows muted connectors for future steps', () => {
      render(<SetupProgress currentStep="workspace" />)

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
      render(<SetupProgress currentStep="asana" />)

      const connectors = document.querySelectorAll('.h-0\\.5')
      // First two connectors should be primary (completed)
      // Last connector should be muted (not yet completed)
      expect(connectors[0]).toHaveClass('bg-primary')
      expect(connectors[1]).toHaveClass('bg-primary')
      expect(connectors[2]).toHaveClass('bg-muted')
    })
  })

  describe('step circle styling', () => {
    it('applies border-primary to current step circle', () => {
      render(<SetupProgress currentStep="slack" />)

      const circles = document.querySelectorAll('.rounded-full')
      // Second circle (slack) should have current styling
      expect(circles[1]).toHaveClass('border-primary')
      expect(circles[1]).not.toHaveClass('bg-primary')
    })

    it('applies muted styling to future step circles', () => {
      render(<SetupProgress currentStep="workspace" />)

      const circles = document.querySelectorAll('.rounded-full')
      // Circles 2, 3, 4 should be muted (future steps)
      expect(circles[1]).toHaveClass('border-muted')
      expect(circles[2]).toHaveClass('border-muted')
      expect(circles[3]).toHaveClass('border-muted')
    })
  })
})
