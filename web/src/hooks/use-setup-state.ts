import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type SetupStep = 'workspace' | 'slack' | 'asana' | 'complete'

interface SetupState {
  step: SetupStep
  tenantId: string | null
  slackConnected: boolean
  asanaConnected: boolean

  // Actions
  setTenantId: (id: string) => void
  setSlackConnected: (connected: boolean) => void
  setAsanaConnected: (connected: boolean) => void
  nextStep: () => void
  goToStep: (step: SetupStep) => void
  reset: () => void
}

const STEPS: SetupStep[] = ['workspace', 'slack', 'asana', 'complete']

export const useSetupState = create<SetupState>()(
  persist(
    (set, get) => ({
      step: 'workspace',
      tenantId: null,
      slackConnected: false,
      asanaConnected: false,

      setTenantId: (id) => set({ tenantId: id }),

      setSlackConnected: (connected) => set({ slackConnected: connected }),

      setAsanaConnected: (connected) => set({ asanaConnected: connected }),

      nextStep: () => {
        const { step } = get()
        const currentIndex = STEPS.indexOf(step)
        if (currentIndex < STEPS.length - 1) {
          const nextStep = STEPS[currentIndex + 1]
          if (nextStep) {
            set({ step: nextStep })
          }
        }
      },

      goToStep: (step) => set({ step }),

      reset: () =>
        set({
          step: 'workspace',
          tenantId: null,
          slackConnected: false,
          asanaConnected: false,
        }),
    }),
    {
      name: 'otto-setup-state',
    }
  )
)
