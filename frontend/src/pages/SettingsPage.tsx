import { User, CreditCard, ExternalLink, Lock, Trash2 } from 'lucide-react'
import { useAuthStore } from '../store/authStore'

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user)

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your account</p>
      </div>

      {/* Account section */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Account
        </h2>

        <div className="rounded-xl border bg-card shadow-sm divide-y">
          {/* Name */}
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Name</p>
              <p className="text-sm font-medium text-foreground truncate">
                {user?.name ?? '—'}
              </p>
            </div>
          </div>

          {/* Email */}
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <Lock className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">Email</p>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Cannot be changed
                </span>
              </div>
              <p className="text-sm font-medium text-foreground truncate">
                {user?.email ?? '—'}
              </p>
            </div>
          </div>

          {/* Plan */}
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-green/10 shrink-0">
              <CreditCard className="h-4 w-4 text-brand-green" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Current plan</p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-sm font-medium text-foreground">Starter</p>
                <span className="rounded-full bg-brand-green/10 px-2 py-0.5 text-[10px] font-semibold text-brand-green">
                  Active
                </span>
              </div>
            </div>
            <a
              href="#billing"
              className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
              onClick={(e) => e.preventDefault()}
            >
              Manage billing
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-destructive">
          Danger Zone
        </h2>

        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 shrink-0">
              <Trash2 className="h-4 w-4 text-destructive" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Delete account</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Permanently delete your account and all associated agents and data.
              </p>
              <button
                disabled
                title="Account deletion is not available yet. Contact support."
                className="mt-3 flex items-center gap-2 rounded-lg border border-destructive/40
                  px-4 py-2 text-sm font-semibold text-destructive/40 cursor-not-allowed"
              >
                <Trash2 className="h-4 w-4" />
                Delete account
              </button>
              <p className="mt-2 text-xs text-muted-foreground">
                To delete your account, contact{' '}
                <a href="mailto:support@karix.com" className="text-primary hover:underline">
                  support@karix.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
