import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Bot, Loader2 } from 'lucide-react'
import { useLogin, useRegister } from '../hooks/useAuth'
import ErrorBanner from '../components/shared/ErrorBanner'

const loginSchema = z.object({
  email:    z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

const registerSchema = loginSchema.extend({
  companyName: z.string().min(2, 'Company name must be at least 2 characters'),
})

type LoginForm    = z.infer<typeof loginSchema>
type RegisterForm = z.infer<typeof registerSchema>

// De-marketed 2026-08-05 (Phase 2 item 21) — this product's users are
// internal Karix staff using this daily, not self-serve SMB signups
// evaluating a landing page (project_internal_operator_reframe). Dropped the
// hero pitch, unverified stat tiles ("10k+ conversations daily" etc — never
// confirmed real), and the marketing split-screen layout in favor of a
// single quiet card, consistent with the rest of the app's chrome-whispers
// mood. The "Create account" tab is left functional for now — whether
// self-serve signup should exist at all for an internally-provisioned tool
// is a separate open founder question, tracked but not blocking this fix.
export default function LoginPage() {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [registerSuccess, setRegisterSuccess] = useState(false)
  const login    = useLogin()
  const register = useRegister()

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  })

  const isPending = login.isPending || register.isPending
  const serverError = login.error || register.error

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-navy">
            <Bot className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-semibold text-foreground">Meta Agents</span>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">
            {tab === 'login' ? 'Sign in' : 'Create account'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {tab === 'login'
              ? 'Sign in to manage your Meta agents'
              : 'Set up a new account'}
          </p>
        </div>

        {/* Tab toggle — active state has no shadow by design: a chip, per
            DESIGN.md §2's shadow floor (buttons/chips/inputs never get one). */}
        <div className="flex rounded-lg bg-muted p-1">
          {(['login', 'register'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                tab === t
                  ? 'bg-white text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'login' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        {/* Server error */}
        {serverError && <ErrorBanner error={serverError} />}

        {/* Registration success */}
        {registerSuccess && tab === 'login' && (
          <div role="status" className="rounded-lg border border-green-600/30 bg-green-600/5 px-4 py-3 text-sm text-green-700">
            Account created. Sign in with your new credentials.
          </div>
        )}

        {tab === 'login' ? (
          <form
            onSubmit={loginForm.handleSubmit((d) => login.mutate(d))}
            className="space-y-4"
          >
            <Field
              label="Email"
              type="email"
              placeholder="you@company.com"
              error={loginForm.formState.errors.email?.message}
              {...loginForm.register('email')}
            />
            <Field
              label="Password"
              type="password"
              placeholder="••••••••"
              error={loginForm.formState.errors.password?.message}
              {...loginForm.register('password')}
            />
            <SubmitButton loading={isPending} label="Sign in" />
          </form>
        ) : (
          <form
            onSubmit={registerForm.handleSubmit((d) =>
              register.mutate(d, {
                onSuccess: () => {
                  setRegisterSuccess(true)
                  setTab('login')
                },
              })
            )}
            className="space-y-4"
          >
            <Field
              label="Company name"
              type="text"
              placeholder="Bloom Bakery"
              error={registerForm.formState.errors.companyName?.message}
              {...registerForm.register('companyName')}
            />
            <Field
              label="Email"
              type="email"
              placeholder="you@company.com"
              error={registerForm.formState.errors.email?.message}
              {...registerForm.register('email')}
            />
            <Field
              label="Password"
              type="password"
              placeholder="Min 8 characters"
              error={registerForm.formState.errors.password?.message}
              {...registerForm.register('password')}
            />
            <SubmitButton loading={isPending} label="Create account" />
          </form>
        )}

        <p className="text-center text-xs text-muted-foreground">
          By continuing you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

// 2026-08-05: id/htmlFor association + aria-describedby/role=alert on the
// error text were missing (a regression against CreateAgentPage's own Field
// component, which already gets this right) — a screen reader on the one
// screen every user must clear announced "edit text" with no label and no
// error announcement.
const Field = ({ label, error, id, ...props }: FieldProps) => {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const errorId = `${fieldId}-error`
  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldId} className="text-sm font-medium text-foreground">{label}</label>
      <input
        id={fieldId}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={!!error}
        className={`w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none transition-colors
          placeholder:text-muted-foreground
          focus:border-primary focus:ring-2 focus:ring-primary/20
          ${error ? 'border-destructive focus:border-destructive focus:ring-destructive/20' : 'border-input'}`}
        {...props}
      />
      {error && <p id={errorId} role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

const SubmitButton = ({ loading, label }: { loading: boolean; label: string }) => (
  <button
    type="submit"
    disabled={loading}
    className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-pink px-4 py-2.5
      text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
  >
    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
    {label}
  </button>
)
