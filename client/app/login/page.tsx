'use client'

import { Suspense, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') ?? '/dashboard'
  const { login, register } = useAuth()

  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      if (isRegister) {
        await register(email, password)
      } else {
        await login(email, password)
      }
      router.push(redirect)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      {/* Logo */}
      <div className="flex justify-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-surface border border-border ring-1 ring-primary/10 shadow-[0_0_30px_rgba(201,164,75,0.06)]">
          <svg
            className="w-7 h-7 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4-6.2-4.5h7.6L12 2z"
            />
          </svg>
        </div>
      </div>

      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-gradient">
          Mythrion
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isRegister ? 'Create your account' : 'Sign in to continue your journey'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card !p-6 space-y-4">
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-field"
            placeholder="adventurer@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="label">Password</label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-field"
            placeholder="At least 8 characters"
          />
        </div>

        {error && (
          <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full"
        >
          {submitting
            ? 'Please wait...'
            : isRegister
              ? 'Create account'
              : 'Enter the realm'}
        </button>
      </form>

      <div className="text-center text-sm text-muted">
        {isRegister ? (
          <>
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => { setIsRegister(false); setError(null) }}
              className="font-medium text-primary hover:text-primary-hover transition-colors"
            >
              Sign in
            </button>
          </>
        ) : (
          <>
            New to Mythrion?{' '}
            <button
              type="button"
              onClick={() => { setIsRegister(true); setError(null) }}
              className="font-medium text-primary hover:text-primary-hover transition-colors"
            >
              Create an account
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <main className="flex-1 flex items-center justify-center p-4 relative">
      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-gradient-to-b from-accent/5 via-primary/3 to-transparent blur-3xl pointer-events-none" />

      <Suspense
        fallback={
          <div className="text-sm text-muted-foreground">Loading...</div>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  )
}