import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { useModuleEntitlements } from '../../hooks/useModuleEntitlements'
import { MODULES, activeModuleFor } from '../../lib/modules'
import { cn } from '../../lib/utils'

/**
 * Module switcher pill (2026-08-11, Figma node 5:53) — before this, the
 * only way back to /select was retyping it in the URL bar. Lives in the
 * command bar next to the client switcher, per DESIGN.md §5's "one mental
 * model for every cross-cutting scope switch" rule.
 */
export default function ModuleSwitcherPill() {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const { data: entitlements } = useModuleEntitlements()
  const activeModuleKey = activeModuleFor(location.pathname)
  const activeModule = MODULES.find((m) => m.key === activeModuleKey) ?? MODULES[0]
  const enabledModules = MODULES.filter((m) => entitlements?.[m.key])

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    window.addEventListener('mousedown', onClick)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  function selectModule(homeRoute: string) {
    setOpen(false)
    triggerRef.current?.focus()
    navigate(homeRoute)
  }

  return (
    <div ref={wrapRef} className="relative hidden shrink-0 md:block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/15"
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-teal" />
        {activeModule.label}
        <ChevronDown className="h-3 w-3 text-white/60" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-2 w-72 rounded-xl border border-border bg-card p-2 shadow-surface-lifted"
        >
          {enabledModules.map((mod) => {
            const isCurrent = mod.key === activeModuleKey
            return (
              <button
                key={mod.key}
                type="button"
                role="menuitem"
                disabled={isCurrent}
                onClick={() => selectModule(mod.homeRoute)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                  isCurrent ? 'bg-muted' : 'text-foreground hover:bg-muted',
                )}
              >
                <span className="flex items-center gap-3">
                  <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-accent-teal" />
                  <span className="font-medium text-foreground">{mod.label}</span>
                </span>
                {isCurrent && (
                  <span className="text-xs font-medium text-accent-teal-solid">Current</span>
                )}
              </button>
            )
          })}
          {enabledModules.length < MODULES.length && (
            <button
              type="button"
              onClick={() => selectModule('/select')}
              className="mt-1 flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted"
            >
              View all features
            </button>
          )}
        </div>
      )}
    </div>
  )
}
