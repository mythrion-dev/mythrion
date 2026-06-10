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
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Mythrion</h1>
        <p className="mt-2 text-sm text-gray-400">
          {isRegister ? 'Create your account' : 'Sign in to your account'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="At least 8 characters"
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-900/40 border border-red-700 px-4 py-2.5 text-sm text-red-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
        >
          {submitting
            ? 'Please wait...'
            : isRegister
              ? 'Create account'
              : 'Sign in'}
        </button>
      </form>

      <div className="text-center text-sm text-gray-400">
        {isRegister ? (
          <>
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => setIsRegister(false)}
              className="font-medium text-indigo-400 hover:text-indigo-300"
            >
              Sign in
            </button>
          </>
        ) : (
          <>
            Don't have an account?{' '}
            <button
              type="button"
              onClick={() => setIsRegister(true)}
              className="font-medium text-indigo-400 hover:text-indigo-300"
            >
              Create one
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <main className="flex-1 flex items-center justify-center p-4">
      <Suspense
        fallback={
          <div className="text-sm text-gray-400">Loading...</div>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  )
}