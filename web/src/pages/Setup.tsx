import { Header, Footer } from '@/components/layout'
import {
  SetupProgress,
  WorkspaceForm,
  SlackConnect,
  AsanaConnect,
  SetupComplete,
} from '@/components/setup'
import { useSetupState } from '@/hooks'
import { useSetupStatus } from '@/api/queries'

export function Setup() {
  const {
    step,
    tenantId,
    slackConnected,
    asanaConnected,
    setTenantId,
    setSlackConnected,
    setAsanaConnected,
    nextStep,
    reset,
  } = useSetupState()

  // Poll for OAuth completion when we have a tenantId
  const { data: status } = useSetupStatus(tenantId)

  // Update local state when status changes from polling
  if (status) {
    if (status.slackConnected && !slackConnected) {
      setSlackConnected(true)
    }
    if (status.asanaConnected && !asanaConnected) {
      setAsanaConnected(true)
    }
  }

  function handleWorkspaceComplete(id: string) {
    setTenantId(id)
    nextStep()
  }

  function handleSlackComplete() {
    nextStep()
  }

  function handleAsanaComplete() {
    nextStep()
  }

  function handleReset() {
    reset()
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-12">
        <div className="container mx-auto max-w-2xl px-4">
          <SetupProgress currentStep={step} />

          {step === 'workspace' && (
            <WorkspaceForm onComplete={handleWorkspaceComplete} />
          )}

          {step === 'slack' && tenantId !== null && (
            <SlackConnect
              tenantId={tenantId}
              isConnected={slackConnected}
              onComplete={handleSlackComplete}
            />
          )}

          {step === 'asana' && tenantId !== null && (
            <AsanaConnect
              tenantId={tenantId}
              isConnected={asanaConnected}
              onComplete={handleAsanaComplete}
            />
          )}

          {step === 'complete' && <SetupComplete onReset={handleReset} />}
        </div>
      </main>
      <Footer />
    </div>
  )
}
