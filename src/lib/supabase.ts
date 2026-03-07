import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  'https://tpbluellqgehaqmmmunp.supabase.co'

const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwYmx1ZWxscWdlaGFxbW1tdW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNzgxOTAsImV4cCI6MjA4Nzc1NDE5MH0.ePDzb1FsZKZPClL6nYSvDqqEsD3IBIMJwl38BlWqYSM'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
