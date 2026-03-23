import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase URLs:', { url: supabaseUrl, key: !!supabaseAnonKey });
    throw new Error('Missing Supabase environment variables');
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

