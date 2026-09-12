import { supabase } from './supabase.js'

export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.user
}

export async function logout() {
  await supabase.auth.signOut()
}

export async function getCurrentUser() {
  const { data } = await supabase.auth.getSession()
  return data.session?.user ?? null
}

export function onAuthChange(callback) {
  supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null)
  })
}

export async function updatePseudo(pseudo) {
  const { data, error } = await supabase.auth.updateUser({ data: { pseudo } })
  if (error) throw error
  return data.user
}

export async function updatePassword(nouveauMotDePasse) {
  const { error } = await supabase.auth.updateUser({ password: nouveauMotDePasse })
  if (error) throw error
}
