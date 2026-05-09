import { API_URL } from './config'
import type { LoyaltyRulesResponse } from '../types/loyalty'

export async function fetchLoyaltyRules(): Promise<LoyaltyRulesResponse> {
  const res = await fetch(`${API_URL}/loyalty/rules`, {
    headers: { 'Content-Type': 'application/json' },
  })

  if (!res.ok) {
    throw new Error(`Error al obtener reglas (${res.status})`)
  }

  return res.json()
}
