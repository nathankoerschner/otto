import { describe, it, expect, beforeEach } from 'vitest'
import { useSetupState } from './use-setup-state'

describe('useSetupState', () => {
  beforeEach(() => {
    // Reset the store before each test
    useSetupState.getState().reset()
    // Clear localStorage
    localStorage.clear()
  })

  describe('initial state', () => {
    it('should have workspace as initial step', () => {
      const state = useSetupState.getState()
      expect(state.step).toBe('workspace')
    })

    it('should have null tenantId initially', () => {
      const state = useSetupState.getState()
      expect(state.tenantId).toBeNull()
    })

    it('should have slackConnected as false initially', () => {
      const state = useSetupState.getState()
      expect(state.slackConnected).toBe(false)
    })

    it('should have asanaConnected as false initially', () => {
      const state = useSetupState.getState()
      expect(state.asanaConnected).toBe(false)
    })
  })

  describe('setTenantId', () => {
    it('should set the tenant ID', () => {
      useSetupState.getState().setTenantId('tenant-123')
      expect(useSetupState.getState().tenantId).toBe('tenant-123')
    })
  })

  describe('setSlackConnected', () => {
    it('should set slack connected status to true', () => {
      useSetupState.getState().setSlackConnected(true)
      expect(useSetupState.getState().slackConnected).toBe(true)
    })

    it('should set slack connected status to false', () => {
      useSetupState.getState().setSlackConnected(true)
      useSetupState.getState().setSlackConnected(false)
      expect(useSetupState.getState().slackConnected).toBe(false)
    })
  })

  describe('setAsanaConnected', () => {
    it('should set asana connected status to true', () => {
      useSetupState.getState().setAsanaConnected(true)
      expect(useSetupState.getState().asanaConnected).toBe(true)
    })

    it('should set asana connected status to false', () => {
      useSetupState.getState().setAsanaConnected(true)
      useSetupState.getState().setAsanaConnected(false)
      expect(useSetupState.getState().asanaConnected).toBe(false)
    })
  })

  describe('nextStep', () => {
    it('should advance from workspace to slack', () => {
      useSetupState.getState().nextStep()
      expect(useSetupState.getState().step).toBe('slack')
    })

    it('should advance from slack to asana', () => {
      useSetupState.getState().goToStep('slack')
      useSetupState.getState().nextStep()
      expect(useSetupState.getState().step).toBe('asana')
    })

    it('should advance from asana to complete', () => {
      useSetupState.getState().goToStep('asana')
      useSetupState.getState().nextStep()
      expect(useSetupState.getState().step).toBe('complete')
    })

    it('should not advance past complete', () => {
      useSetupState.getState().goToStep('complete')
      useSetupState.getState().nextStep()
      expect(useSetupState.getState().step).toBe('complete')
    })
  })

  describe('goToStep', () => {
    it('should go to a specific step', () => {
      useSetupState.getState().goToStep('asana')
      expect(useSetupState.getState().step).toBe('asana')
    })

    it('should be able to go backwards', () => {
      useSetupState.getState().goToStep('complete')
      useSetupState.getState().goToStep('workspace')
      expect(useSetupState.getState().step).toBe('workspace')
    })
  })

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      // Set up some state
      useSetupState.getState().setTenantId('tenant-123')
      useSetupState.getState().setSlackConnected(true)
      useSetupState.getState().setAsanaConnected(true)
      useSetupState.getState().goToStep('complete')

      // Reset
      useSetupState.getState().reset()

      // Verify
      const state = useSetupState.getState()
      expect(state.step).toBe('workspace')
      expect(state.tenantId).toBeNull()
      expect(state.slackConnected).toBe(false)
      expect(state.asanaConnected).toBe(false)
    })
  })

  describe('persistence', () => {
    it('should persist state to localStorage', () => {
      useSetupState.getState().setTenantId('tenant-123')
      useSetupState.getState().goToStep('slack')

      const stored = localStorage.getItem('otto-setup-state')
      expect(stored).not.toBeNull()

      const parsed = JSON.parse(stored!)
      expect(parsed.state.tenantId).toBe('tenant-123')
      expect(parsed.state.step).toBe('slack')
    })
  })
})
