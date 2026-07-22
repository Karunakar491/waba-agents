import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Bot, Loader2 } from 'lucide-react'
import { useLogin, useRegister } from '../hooks/useAuth'

const loginSchema = z.object({
  email:    z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

const registerSchema = loginSchema.extend({
  companyName: z.string().min(2, 'Company name must be at least 2 characters'),
})

type LoginForm    = z.infer<typeof loginSchema>
type RegisterForm = z.infer<typeof registerSchema>

export default function LoginPage() {
  const [tab, setTab] = useState<'login' | 'register'>('login')
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
    <div className="flex min-h-screen">
      {/* Left panel — brand */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-brand-navy p-12">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-pink">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-semibold text-white tracking-tight">Meta Agents</span>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <h1 className="text-4xl font-bold text-white leading-tight">
              Deploy AI agents on<br />WhatsApp in minutes.
            </h1>
            <p className="text-lg text-white/60">
              Connect your Meta Business account, configure your agent,<br />
              and let AI handle customer conversations 24/7.
            </p>
          </div>

          <div className="flex gap-8">
            {[
              { value: '10k+', label: 'Conversations daily' },
              { value: '99.9%', label: 'Uptime SLA' },
              { value: '< 2min', label: 'Agent setup' },
            ].map(({ value, label }) => (
              <div key={label}>
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-sm text-white/50">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm text-white/30">
          Powered by Karix — Meta Business Solution Provider
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12 bg-white">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-navy">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-semibold text-foreground">Meta Agents</span>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">
              {tab === 'login' ? 'Welcome back' : 'Create account'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {tab === 'login'
                ? 'Sign in to manage your Meta agents'
                : 'Start deploying AI agents today'}
            </p>
          </div>

          {/* Tab toggle */}
          <div className="flex rounded-lg bg-muted p-1">
            {(['login', 'register'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                  tab === t
                    ? 'bg-white text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          {/* Server error */}
          {serverError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {(serverError as any)?.response?.data?.message ?? 'Something went wrong. Please try again.'}
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
              onSubmit={registerForm.handleSubmit((d) => register.mutate(d))}
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
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

const Field = ({ label, error, ...props }: FieldProps) => (
  <div className="space-y-1.5">
    <label className="text-sm font-medium text-foreground">{label}</label>
    <input
      className={`w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none transition-colors
        placeholder:text-muted-foreground
        focus:border-primary focus:ring-2 focus:ring-primary/20
        ${error ? 'border-destructive focus:border-destructive focus:ring-destructive/20' : 'border-input'}`}
      {...props}
    />
    {error && <p className="text-xs text-destructive">{error}</p>}
  </div>
)

const SubmitButton = ({ loading, label }: { loading: boolean; label: string }) => (
  <button
    type="submit"
    disabled={loading}
    className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-pink px-4 py-2.5
      text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
  >
    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
    {label}
  </button>
)
