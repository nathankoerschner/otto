import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

type Step = 'workspace' | 'slack' | 'asana' | 'complete'

interface SetupProgressProps {
  currentStep: Step
}

const steps: { id: Step; label: string }[] = [
  { id: 'workspace', label: 'Workspace' },
  { id: 'slack', label: 'Slack' },
  { id: 'asana', label: 'Asana' },
  { id: 'complete', label: 'Complete' },
]

export function SetupProgress({ currentStep }: SetupProgressProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep)

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentIndex
          const isCurrent = index === currentIndex

          return (
            <div key={step.id} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full border-2 font-semibold transition-colors',
                    isCompleted &&
                      'border-primary bg-primary text-primary-foreground',
                    isCurrent && 'border-primary text-primary',
                    !isCompleted && !isCurrent && 'border-muted text-muted-foreground'
                  )}
                >
                  {isCompleted ? <Check className="h-5 w-5" /> : index + 1}
                </div>
                <span
                  className={cn(
                    'mt-2 text-sm',
                    isCurrent && 'font-medium text-primary',
                    !isCurrent && 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'mx-2 h-0.5 flex-1',
                    index < currentIndex ? 'bg-primary' : 'bg-muted'
                  )}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
