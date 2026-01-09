import { useState } from 'react'
import { Header, Footer } from '@/components/layout'
import {
  SetupProgress,
  WorkspaceForm,
  TokensForm,
  SetupComplete,
} from '@/components/setup'
import { useAuth } from '@/hooks'

type SetupStep = 'register' | 'tokens' | 'complete'

export function Setup() {
  const { isAuthenticated, tenant, refreshTenant } = useAuth()

  // Determine the current step based on auth state
  function getCurrentStep(): SetupStep {
    if (!isAuthenticated) {
      return 'register'
    }
    if (!tenant?.setupCompleted) {
      return 'tokens'
    }
    return 'complete'
  }

  const [step, setStep] = useState<SetupStep>(getCurrentStep)

  function handleRegistrationComplete() {
    setStep('tokens')
  }

  async function handleTokensComplete() {
    await refreshTenant()
    setStep('complete')
  }

  function handleReset() {
    // Navigate to dashboard after reset
    window.location.href = '/dashboard'
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-12">
        <div className="container mx-auto max-w-2xl px-4">
          <SetupProgress currentStep={step} />

          {step === 'register' && (
            <WorkspaceForm onComplete={handleRegistrationComplete} />
          )}

          {step === 'tokens' && (
            <TokensForm onComplete={handleTokensComplete} />
          )}

          {step === 'complete' && <SetupComplete onReset={handleReset} />}
        </div>
      </main>
      <Footer />
    </div>
  )
}
