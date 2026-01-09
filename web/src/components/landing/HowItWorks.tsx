const steps = [
  {
    step: '01',
    title: 'Task gets assigned to Otto',
    description:
      'When a task in Asana is assigned to your Otto bot user, it triggers the ownership flow automatically.',
  },
  {
    step: '02',
    title: 'Otto finds the right owner',
    description:
      'Using your Google Sheet mapping, Otto identifies who should own the task based on task name or project.',
  },
  {
    step: '03',
    title: 'Owner claims via Slack',
    description:
      'The potential owner receives a Slack DM and can accept or decline with natural language responses.',
  },
  {
    step: '04',
    title: 'Follow-ups until completion',
    description:
      'Otto sends smart reminders at half-time and near-deadline, adapting based on owner responses.',
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            How Otto works
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            A simple four-step process that runs automatically in the background.
          </p>
        </div>

        <div className="mx-auto max-w-3xl">
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-6 top-0 h-full w-px bg-border md:left-1/2" />

            <div className="space-y-12">
              {steps.map((step, index) => (
                <div
                  key={step.step}
                  className={`relative flex items-start gap-6 ${
                    index % 2 === 1 ? 'md:flex-row-reverse' : ''
                  }`}
                >
                  {/* Step number */}
                  <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border bg-background font-bold text-primary">
                    {step.step}
                  </div>

                  {/* Content */}
                  <div
                    className={`flex-1 ${index % 2 === 1 ? 'md:text-right' : ''}`}
                  >
                    <h3 className="text-xl font-semibold">{step.title}</h3>
                    <p className="mt-2 text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
