import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import logo from './assets/logo.jpeg'
import { supabase } from './lib/supabaseClient'
import { apiFetch } from './lib/api'
import { LoginForm } from './components/LoginForm'
import { Sidebar, type Tab } from './components/Sidebar'
import { MenuIcon } from './components/icons'
import { DashboardPage } from './pages/DashboardPage'
import { ContactsPage } from './pages/ContactsPage'
import { InventoryPage } from './pages/InventoryPage'
import { ReceiptsPage } from './pages/ReceiptsPage'
import { QuotationsPage } from './pages/QuotationsPage'
import { ChallansPage } from './pages/ChallansPage'
import type { Role } from './lib/types'
import './App.css'

type Profile = { id: string; name: string | null; role: Role }

function App() {
  const [apiStatus, setApiStatus] = useState<'checking' | 'ok' | 'unreachable'>('checking')
  const [session, setSession] = useState<Session | null>(null)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [tab, setTab] = useState<Tab>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

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
  const canManageQuotations = profile?.role === 'owner' || profile?.role === 'staff'
  const canManageChallans = profile?.role === 'owner' || profile?.role === 'staff'

  if (!sessionChecked) {
    return (
      <div className="app-shell centered-shell">
        <p>Checking session…</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="app-shell centered-shell">
        <div className="login-brand">
          <img src={logo} alt="Sawat Marble Stone & Granite" className="app-logo" />
          <h1>Sawat Marble Stone &amp; Granite</h1>
        </div>
        <LoginForm />
      </div>
    )
  }

  return (
    <div className="app-shell-v2">
      <Sidebar
        tab={tab}
        onSelectTab={setTab}
        email={session.user.email ?? ''}
        role={profile?.role ?? null}
        onSignOut={() => supabase.auth.signOut()}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="main-area">
        <header className="mobile-topbar">
          <button className="hamburger-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <MenuIcon />
          </button>
          <img src={logo} alt="Sawat Marble Stone & Granite" />
          <h1>Sawat Marble Stone &amp; Granite</h1>
        </header>

        {apiStatus !== 'ok' && <div className="api-warning-banner">Backend API: {apiStatus}</div>}

        <main className="main-content">
          {profile &&
            (tab === 'dashboard' ? (
              <DashboardPage />
            ) : tab === 'customers' ? (
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
            ) : tab === 'inventory' ? (
              <InventoryPage canManage={canManageInventory} canDelete={canDeleteInventory} />
            ) : tab === 'receipts' ? (
              <ReceiptsPage />
            ) : tab === 'quotations' ? (
              <QuotationsPage canManage={canManageQuotations} />
            ) : (
              <ChallansPage canManage={canManageChallans} />
            ))}
        </main>
      </div>
    </div>
  )
}

export default App
