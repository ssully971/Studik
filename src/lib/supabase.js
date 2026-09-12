import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://pgcjhafcwtreobzrzajs.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnY2poYWZjd3RyZW9ienJ6YWpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxNDI0NzQsImV4cCI6MjEwNDcxODQ3NH0.Hy-a0GnKgL5ZWZ5G8zPtFfAl0avZXl2SY4P6V7Ikpyw'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
