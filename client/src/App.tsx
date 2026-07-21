import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import logo from './assets/logo.jpeg'
import { supabase } from './lib/supabaseClient'
import { apiFetch } from './lib/api'
import { LoginForm } from './components/LoginForm'
import { ContactsPage } from './pages/ContactsPage'
import { InventoryPage } from './pages/InventoryPage'
import type { Role } from './lib/types'
import './App.css'

type Profile = { id: string; name: string | null; role: Role }
type Tab = 'customers' | 'suppliers' | 'inventory'

function App() {
  const [apiStatus, setApiStatus] = useState<'checking' | 'ok' | 'unreachable'>('checking')
  const [session, setSession] = useState<Session | null>(null)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [tab, setTab] = useState<Tab>('customers')

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

  const canManageContacts = profile?.role === 'owner' || profile?.role === 'staff'
  const canEditBalance = profile?.role === 'owner'
  const canManageInventory = profile?.role === 'owner' || profile?.role === 'staff'
  const canDeleteInventory = profile?.role === 'owner'

  return (
    <div className="app-shell">
      <header className="app-header">
        <img src={logo} alt="Sawat Marble Stone & Granite" className="app-logo" />
        <h1>Sawat Marble Stone &amp; Granite</h1>
        {apiStatus !== 'ok' && <span className="api-warning">Backend API: {apiStatus}</span>}
      </header>
      <main>
        {!sessionChecked ? (
          <p>Checking session…</p>
        ) : session ? (
          <>
            <div className="top-bar">
              <span>
                {session.user.email} · {profile ? profile.role : 'loading role…'}
              </span>
              <button className="link-button" onClick={() => supabase.auth.signOut()}>
                Sign out
              </button>
            </div>

            <nav className="tab-bar">
              <button className={tab === 'customers' ? 'active' : ''} onClick={() => setTab('customers')}>
                Customers
              </button>
              <button className={tab === 'suppliers' ? 'active' : ''} onClick={() => setTab('suppliers')}>
                Suppliers
              </button>
              <button className={tab === 'inventory' ? 'active' : ''} onClick={() => setTab('inventory')}>
                Inventory
              </button>
            </nav>

            {profile &&
              (tab === 'customers' ? (
                <ContactsPage
                  resource="customers"
                  title="Customers"
                  canManage={canManageContacts}
                  canEditBalance={canEditBalance}
                />
              ) : tab === 'suppliers' ? (
                <ContactsPage
                  resource="suppliers"
                  title="Suppliers"
                  canManage={canManageContacts}
                  canEditBalance={canEditBalance}
                />
              ) : (
                <InventoryPage canManage={canManageInventory} canDelete={canDeleteInventory} />
              ))}
          </>
        ) : (
          <LoginForm />
        )}
      </main>
    </div>
  )
}

export default App
