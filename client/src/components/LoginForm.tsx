import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'

export function LoginForm() {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const { error } =
      mode === 'sign-in'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })

    setLoading(false)

    if (error) {
      setMessage(error.message)
    } else if (mode === 'sign-up') {
      setMessage('Account created — you should be signed in now (or check email if confirmation is required).')
    }
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <h2>{mode === 'sign-in' ? 'Sign in' : 'Create account'}</h2>
      <label>
        Email
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label>
        Password
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {message && <p className="login-message">{message}</p>}
      <button type="submit" disabled={loading}>
        {loading ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
      </button>
      <button
        type="button"
        className="link-button"
        onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
      >
        {mode === 'sign-in' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
      </button>
    </form>
  )
}
