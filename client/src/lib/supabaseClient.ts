import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase env vars are not set — auth will not work until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are provided.')
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '')
