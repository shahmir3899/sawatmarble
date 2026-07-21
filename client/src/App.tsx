import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import logo from './assets/logo.jpeg'
import { supabase } from './lib/supabaseClient'
import { apiFetch } from './lib/api'
import { LoginForm } from './components/LoginForm'
import './App.css'

type Profile = { id: string; name: string | null; role: 'owner' | 'staff' | 'accountant' }

function App() {
  const [apiStatus, setApiStatus] = useState<'checking' | 'ok' | 'unreachable'>('checking')
  const [session, setSession] = useState<Session | null>(null)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [demoResult, setDemoResult] = useState<string | null>(null)

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'
    fetch(`${apiUrl}/health`)
      .then((res) => setApiStatus(res.ok ? 'ok' : 'unreachable'))
      .catch(() => setApiStatus('unreachable'))

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionChecked(true)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setProfile(null)
      return
    }
    apiFetch('/profile')
      .then((res) => res.json())
      .then((body) => setProfile(body.profile))
      .catch(() => setProfile(null))
  }, [session])

  async function tryCreateCustomer() {
    setDemoResult('Trying…')
    const res = await apiFetch('/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `Demo customer ${Date.now()}` }),
    })
    const body = await res.json()
    setDemoResult(`HTTP ${res.status}: ${JSON.stringify(body)}`)
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <img src={logo} alt="Sawat Marble Stone & Granite" className="app-logo" />
        <h1>Sawat Marble Stone &amp; Granite</h1>
      </header>
      <main>
        <p>Backend API: {apiStatus}</p>

        {!sessionChecked ? (
          <p>Checking session…</p>
        ) : session ? (
          <div className="signed-in-panel">
            <p>Signed in as {session.user.email}</p>
            <p>Role: {profile ? profile.role : 'loading…'}</p>
            <button onClick={tryCreateCustomer}>
              Try: create test customer (requires owner or staff role)
            </button>
            {demoResult && <p className="demo-result">{demoResult}</p>}
            <button className="link-button" onClick={() => supabase.auth.signOut()}>
              Sign out
            </button>
          </div>
        ) : (
          <LoginForm />
        )}
      </main>
    </div>
  )
}

export default App
