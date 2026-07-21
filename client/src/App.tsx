import { useEffect, useState } from 'react'
import logo from './assets/logo.jpeg'
import './App.css'

function App() {
  const [apiStatus, setApiStatus] = useState<'checking' | 'ok' | 'unreachable'>('checking')

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'
    fetch(`${apiUrl}/health`)
      .then((res) => (res.ok ? setApiStatus('ok') : setApiStatus('unreachable')))
      .catch(() => setApiStatus('unreachable'))
  }, [])

  return (
    <div className="app-shell">
      <header className="app-header">
        <img src={logo} alt="Sawat Marble Stone & Granite" className="app-logo" />
        <h1>Sawat Marble Stone &amp; Granite</h1>
      </header>
      <main>
        <p>Project skeleton is running.</p>
        <p>Backend API: {apiStatus}</p>
      </main>
    </div>
  )
}

export default App
