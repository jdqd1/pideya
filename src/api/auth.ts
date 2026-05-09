import { API_URL } from './config'

export interface AuthResponse {
  token: string
  user: { id: string; email: string; role: string; createdAt: string; name?: string; cedula?: string | null }
}

const normalizeAuthEmail = (email: string) => email.trim().toLowerCase()

export async function register(email: string, password: string, cedula: string, name?: string, phone?: string, role?: string): Promise<AuthResponse> {
  const normalizedEmail = normalizeAuthEmail(email)
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalizedEmail, password, cedula, name, phone, role }),
  })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(msg || 'Error al registrar')
  }
  return res.json()
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const normalizedEmail = normalizeAuthEmail(email)
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalizedEmail, password }),
  })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(msg || 'Error al iniciar sesión')
  }
  return res.json()
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  const normalizedEmail = normalizeAuthEmail(email)
  const res = await fetch(`${API_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalizedEmail }),
  })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(msg || 'Error al solicitar código')
  }
  return res.json()
}

export async function resetPassword(email: string, code: string, newPassword: string): Promise<{ message: string }> {
  const normalizedEmail = normalizeAuthEmail(email)
  const res = await fetch(`${API_URL}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalizedEmail, code, newPassword }),
  })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(msg || 'Error al restablecer contraseña')
  }
  return res.json()
}
