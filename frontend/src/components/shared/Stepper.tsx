import { Check } from 'lucide-react'
import { cn } from '../../lib/utils'

/**
 * DESIGN.md §6 — "numbered circles + connecting line, for genuine
 * multi-step flows only." First real use: the manual Create-template flow
 * (Figma node 172:41) — Edit mode stays a flat single-page form (name/
 * category/language are locked on edit, so there's nothing to step
 * through), per the founder's explicit decision amending DESIGN.md's prior
 * blanket "don't invent a wizard" rule for this one form.
 */
export default function Stepper({ steps, currentStep }: { steps: string[]; currentStep: number }) {
  return (
    <div className="flex items-center gap-3">
      {steps.map((label, i) => {
        const stepNum = i + 1
        const done = stepNum < currentStep
        const active = stepNum === currentStep
        return (
          <div key={label} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[11px] font-medium',
                  done ? 'bg-accent-teal-solid text-white' : active ? 'border-2 border-accent-teal-solid' : 'border border-border text-muted-foreground',
                )}
              >
                {done ? <Check className="h-3 w-3" /> : !active && stepNum}
              </span>
              <span className={cn('text-sm', active ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                {label}
              </span>
            </div>
            {stepNum < steps.length && <span className="text-muted-foreground">···</span>}
          </div>
        )
      })}
    </div>
  )
}
