import { createClient } from '@supabase/supabase-js'

const rawUrl = import.meta.env.VITE_SUPABASE_URL
const rawKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

const url = rawUrl ? rawUrl.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '') : ''
const key = rawKey ? rawKey.trim() : ''

export const supabase = url && key ? createClient(url, key) : null
