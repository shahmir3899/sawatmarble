import { supabase } from './supabaseClient'

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

export async function apiFetch(path: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  const headers = new Headers(init?.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)

  return fetch(`${apiUrl}${path}`, { ...init, headers })
}
