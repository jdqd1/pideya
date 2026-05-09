import { API_URL } from './config'
import type { LoyaltyRulesResponse } from '../types/loyalty'
import type { CouponDto, CouponInspectResponse, CouponStats, UserCouponsState, UserLevelState } from '../types/userState'
import type { SalesEvent, ProductDef, Expense, CashClosure, CashClosureLine } from '../types/app'
export type { SalesEvent, ProductDef, Expense, CashClosure, CashClosureLine }

type UnauthorizedHandler = (info: { status: number; message: string }) => void

let unauthorizedHandler: UnauthorizedHandler | null = null

export const setUnauthorizedHandler = (handler: UnauthorizedHandler | null) => {
  unauthorizedHandler = handler
}

const readJson = async <T>(res: Response): Promise<T> => {
  const text = await res.text().catch(() => '')
  if (!text) return undefined as T
  try {
    return JSON.parse(text) as T
  } catch {
    return text as unknown as T
  }
}

const readErrorMessage = async (res: Response, fallback: string): Promise<string> => {
  const text = await res.text().catch(() => '')
  if (!text) return fallback
  try {
    const parsed = JSON.parse(text)
    if (typeof parsed?.message === 'string') return parsed.message
    if (Array.isArray(parsed?.message)) return parsed.message.join(', ')
    if (typeof parsed?.error === 'string') return parsed.error
  } catch {
    // Ignore JSON parse errors
  }
  return text || fallback
}

const assertOk = async (res: Response, fallback: string) => {
  if (res.ok) return
  const message = await readErrorMessage(res, fallback)
  const error: any = new Error(message || fallback)
  error.status = res.status
  if (res.status === 401 && unauthorizedHandler) {
    unauthorizedHandler({ status: res.status, message })
  }
  throw error
}

export interface LookupUserResponse extends UserCouponsState {
  user?: {
    id: string
    email?: string
    cedula?: string | null
    phoneNumber?: string | null
    name?: string | null
    role?: string
    createdAt?: string
    isProvisional?: boolean
    provisionalExpiresAt?: string | null
  }
}

export interface RegisterSaleItemPayload {
  code?: string
  codes?: string[]
  name: string
  price: number
  points: number
  productId?: string
  quantity?: number
}

export interface RegisterSalePayload {
  items: RegisterSaleItemPayload[]
  customerEmail?: string
  customerCedula?: string
  customerId?: string
  customerName?: string | null
  customerPhone?: string | null
  documentType?: string | null
  documentNumber?: string | null
  couponId?: string
  subtotal?: number
  total?: number
  discount?: number
  exchangeRate?: number
  paymentMethod?: string
  paymentDetails?: {
    method: string
    amount: number
    currency?: string
    amountNative?: number
    currencyNative?: string
    amountUsd?: number
    exchangeRate?: number | null
  }[]
}

export interface LogSaleEventsPayload extends RegisterSalePayload {
  source?: string
  occurredAt?: string
}

export interface RegisterExpensePayload {
  description: string
  amount: number
  currency?: string
  category?: string
  occurredAt?: string
  exchangeRate?: number
  paymentMethod?: string
}

export interface CreateCashClosurePayload {
  businessDate: string
  exchangeRate?: number | null
  expectedUsd: number
  expectedVes: number
  countedUsd: number
  countedVes: number
  diffUsd: number
  diffVes: number
  differenceCount: number
  lines?: CashClosureLine[]
  note?: string | null
}



export interface RegisterSaleResponse {
  ok: boolean
  totalPoints: number
  pointsAwarded: number
  nextThreshold: number
  rewardsUnlocked?: CouponDto[] | null
  rewardUnlocked?: CouponDto | null
  levelCouponsIssued?: CouponDto[]
  levelState?: UserLevelState
  user?: { id: string; email?: string; cedula?: string | null; isProvisional?: boolean; provisionalExpiresAt?: string | null }
  saleEvents?: SalesEvent[]
  state?: LookupUserResponse | UserCouponsState
}

export async function fetchSecureRules(token: string): Promise<LoyaltyRulesResponse> {
  const res = await fetch(`${API_URL}/loyalty/rules`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })
  await assertOk(res, 'No se pudieron obtener reglas')
  return readJson(res)
}

export async function updateLoyaltyRules(
  payload: LoyaltyRulesResponse,
  token: string,
): Promise<LoyaltyRulesResponse> {
  const res = await fetch(`${API_URL}/loyalty/admin/rules`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
  await assertOk(res, 'No se pudieron actualizar reglas')
  return readJson(res)
}

export async function claimCode(code: string, token: string) {
  const res = await fetch(`${API_URL}/loyalty/claim`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ code }),
  })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(msg || 'Error al reclamar código')
  }
  return res.json()
}

export async function fetchMe(token: string): Promise<UserCouponsState> {
  const res = await fetch(`${API_URL}/loyalty/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  await assertOk(res, 'No se pudo obtener tu estado')
  return res.json()
}

export interface GenerateClaimsResponse {
  created: number
  persisted?: boolean
  sample: string[]
  codes?: string[]
}

export async function generateClaims(
  count: number,
  token: string,
  persist: boolean = false,
  prefix?: string,
  points?: number,
  productMeta?: { productId?: string; productName?: string; price?: number },
): Promise<GenerateClaimsResponse> {
  const res = await fetch(`${API_URL}/loyalty/claims/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ count, persist, prefix, points, ...productMeta }),
  })

  if (!res.ok) {
    const msg = await res.text()
    throw new Error(msg || 'Error al generar códigos')
  }

  return res.json()
}

export async function redeemCoupon(couponId: string, token: string) {
  const res = await fetch(`${API_URL}/loyalty/coupons/redeem`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ couponId }),
  })

  if (!res.ok) {
    const msg = await res.text()
    throw new Error(msg || 'Error al canjear cupón')
  }

  return res.json()
}

export async function transferCoupon(couponId: string, recipientEmail: string, token: string) {
  const res = await fetch(`${API_URL}/loyalty/coupons/transfer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ couponId, recipientEmail }),
  })

  if (!res.ok) {
    const msg = await res.text()
    throw new Error(msg || 'No se pudo transferir el cupón')
  }

  return res.json()
}

export async function inspectCoupon(couponId: string, token: string): Promise<CouponInspectResponse> {
  const res = await fetch(`${API_URL}/loyalty/coupons/inspect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ couponId }),
  })

  if (!res.ok) {
    const msg = await res.text()
    throw new Error(msg || 'No se pudo revisar el cupon')
  }

  return res.json()
}

export async function registerSale(payload: RegisterSalePayload, token: string): Promise<RegisterSaleResponse> {
  const res = await fetch(`${API_URL}/loyalty/sales/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
  await assertOk(res, 'No se pudo registrar la venta')
  return readJson(res)
}

export async function logSaleEvents(payload: LogSaleEventsPayload, token: string): Promise<SalesEvent[]> {
  const res = await fetch(`${API_URL}/loyalty/sales/log`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
  await assertOk(res, 'No se pudo guardar la venta')
  return readJson(res)
}

export async function fetchSalesEvents(token: string, params?: { start?: string; end?: string; limit?: number }): Promise<SalesEvent[]> {
  const url = new URL(`${API_URL}/loyalty/sales`)
  if (params?.start) url.searchParams.set("start", params.start)
  if (params?.end) url.searchParams.set("end", params.end)
  if (params?.limit) url.searchParams.set("limit", String(params.limit))

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  await assertOk(res, 'No se pudo obtener las ventas')
  return res.json()
}

export async function clearClaims(codes: string[], token: string) {
  const res = await fetch(`${API_URL}/loyalty/claims/clear`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ codes }),
  })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(msg || 'No se pudieron borrar los códigos')
  }
  return res.json()
}

export async function verifyClaims(codes: string[], token: string): Promise<string[]> {
  const res = await fetch(`${API_URL}/loyalty/claims/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ codes }),
  })

  if (!res.ok) {
    const msg = await res.text()
    console.error('Verify error', msg)
    throw new Error('Error al verificar códigos')
  }

  return res.json()
}

export async function fetchActiveUsersCount(token: string): Promise<number> {
  const res = await fetch(`${API_URL}/loyalty/users/count`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(msg || 'No se pudo obtener el total de usuarios')
  }
  const data = await res.json()
  if (typeof data?.activeUsers === 'number') return data.activeUsers
  if (typeof data === 'number') return data
  return Number(data?.count ?? 0)
}

export async function fetchCouponStats(token: string): Promise<CouponStats> {
  const res = await fetch(`${API_URL}/loyalty/coupons/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(msg || 'No se pudo obtener el total de cupones')
  }
  const data = await res.json()
  const base: CouponStats = { total: 0, available: 0, used: 0, expired: 0 }
  return {
    total: Number(data?.total ?? base.total),
    available: Number(data?.available ?? base.available),
    used: Number(data?.used ?? base.used),
    expired: Number(data?.expired ?? base.expired),
  }
}

export async function syncCatalog(items: any[], token: string) {
  const res = await fetch(`${API_URL}/admin/catalog`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ items }),
  })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(msg || 'No se pudo sincronizar el catálogo')
  }
  return res.json()
}


export async function lookupUser(
  payload: { cedula?: string; email?: string },
  token: string,
): Promise<LookupUserResponse> {
  const res = await fetch(`${API_URL}/loyalty/users/lookup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    let msg = await res.text()
    try {
      const parsed = JSON.parse(msg)
      if (parsed?.message) msg = parsed.message
    } catch {
      /* ignore parse errors */
    }
    throw new Error(msg || 'No se pudo encontrar al cliente')
  }
  return res.json()
}

export async function lookupUserByCedula(cedula: string, token: string): Promise<LookupUserResponse> {
  return lookupUser({ cedula }, token)
}

export async function deleteUser(userId: string, token: string): Promise<{ deleted: number }> {
  const res = await fetch(`${API_URL}/loyalty/users/${userId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  await assertOk(res, 'No se pudo borrar el usuario')
  return readJson(res)
}

export interface DashboardStats {
  registeredUsers: number
  newUsersToday: number
  totalCoupons: number
  redeemedCoupons: number
  couponsWeek: number
  interactions: {
    total: number
    logins: number
    scans: number
    redeems: number
  }
  couponsGenerated: number
  userGrowth: {
    daily: { date: string; count: number }[]
    weekly: { date: string; count: number }[]
  }
  activityHistory: { date: string; count: number }[]
  couponHistory: { date: string; created: number; redeemed: number }[]
  levelDistribution: { name: string; count: number }[]
  apiStatus?: {
    ok: boolean
    rate: number
    lastCheck: string
  }
}

export async function fetchDashboardStats(token: string): Promise<DashboardStats> {
  const res = await fetch(`${API_URL}/loyalty/admin/dashboard-stats`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  await assertOk(res, 'No se pudieron obtener estadisticas')
  return res.json()
}

import type { PaymentTicket } from '../types/app'

export type TicketsPage = {
  items: PaymentTicket[]
  nextCursor?: string | null
}

export type TicketIntegrityIssueReason =
  | 'missing_claim'
  | 'points_mismatch'
  | 'ticket_points_mismatch'

export type TicketIntegrityIssue = {
  ticketId: number
  userId: string | null
  claimCode: string
  expectedPoints: number
  storedTicketPoints: number
  claimPoints: number | null
  reason: TicketIntegrityIssueReason | string
  confirmedAt?: string | null
  createdAt?: string
}

export type TicketPointsIntegrityResponse = {
  checkedTickets: number
  issueCount: number
  issues: TicketIntegrityIssue[]
}

export type TicketReconcileActionType =
  | 'create_claim'
  | 'increase_claim_points'
  | 'update_ticket_points'
  | 'skip'
  | 'manual_review'

export type TicketReconcileAction = {
  ticketId: number
  userId: string | null
  action: TicketReconcileActionType | string
  dryRun: boolean
  pointsApplied?: number
  pointsDelta?: number
  note?: string
}

export type TicketPointsReconcileResponse = {
  dryRun: boolean
  checkedTickets: number
  issueCount: number
  actionableIssues: number
  actions: TicketReconcileAction[]
}

export type FinanceAuditResponse = {
  limit: number
  missing: {
    sales: { rate: number; date: number }
    tickets: { rate: number; date: number }
    expenses: { rate: number; date: number }
  }
  samples: {
    sales: Array<{ id: string; occurredAt?: string; exchangeRate?: number | null; exchangeRateDate?: string | null }>
    tickets: Array<{ id: number | string; createdAt?: string; exchangeRate?: number | null; exchangeRateDate?: string | null }>
    expenses: Array<{ id: string; occurredAt?: string; exchangeRate?: number | null; exchangeRateDate?: string | null }>
  }
}

export type FinanceReconcileResponse = {
  dryRun: boolean
  checked: number
  resolved: number
  unresolved: number
  actions: Array<{
    table: string
    id: string | number
    dryRun: boolean
    exchangeRate: number | null
    exchangeRateDate: string | null
    status: string
  }>
}

const normalizeTicketsPage = (data: any): TicketsPage => {
  if (Array.isArray(data)) return { items: data, nextCursor: null }
  if (data && Array.isArray(data.items)) {
    return { items: data.items, nextCursor: data.nextCursor ?? null }
  }
  return { items: [], nextCursor: null }
}

export async function fetchTickets(
  token: string,
  params: { limit?: number; cursor?: string | null } = {},
): Promise<TicketsPage> {
  const search = new URLSearchParams()
  if (params.limit) search.set('limit', String(params.limit))
  if (params.cursor) search.set('cursor', params.cursor)
  const query = search.toString()
  const res = await fetch(`${API_URL}/loyalty/tickets${query ? `?${query}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  await assertOk(res, 'Failed to fetch tickets')
  const data = await res.json()
  const page = normalizeTicketsPage(data)
  return page
}

export async function fetchTicketPointsIntegrity(
  token: string,
  limit?: number,
): Promise<TicketPointsIntegrityResponse> {
  const search = new URLSearchParams()
  if (Number.isFinite(limit)) search.set('limit', String(limit))
  const query = search.toString()
  const res = await fetch(`${API_URL}/loyalty/admin/tickets/integrity${query ? `?${query}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  await assertOk(res, 'No se pudo auditar integridad de tickets')
  return readJson(res)
}

export async function reconcileTicketPoints(
  payload: { limit?: number; dryRun?: boolean },
  token: string,
): Promise<TicketPointsReconcileResponse> {
  const res = await fetch(`${API_URL}/loyalty/admin/tickets/reconcile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload ?? {}),
  })
  await assertOk(res, 'No se pudo reconciliar puntos de tickets')
  return readJson(res)
}

export async function fetchFinanceAudit(token: string, limit?: number): Promise<FinanceAuditResponse> {
  const search = new URLSearchParams()
  if (Number.isFinite(limit)) search.set('limit', String(limit))
  const query = search.toString()
  const res = await fetch(`${API_URL}/loyalty/admin/finance/audit${query ? `?${query}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  await assertOk(res, 'No se pudo auditar finanzas')
  return readJson(res)
}

export async function reconcileFinance(
  payload: { limit?: number; dryRun?: boolean },
  token: string,
): Promise<FinanceReconcileResponse> {
  const res = await fetch(`${API_URL}/loyalty/admin/finance/reconcile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload ?? {}),
  })
  await assertOk(res, 'No se pudo reconciliar finanzas')
  return readJson(res)
}

export async function fetchCashClosures(token: string, limit?: number): Promise<CashClosure[]> {
  const search = new URLSearchParams()
  if (Number.isFinite(limit)) search.set('limit', String(limit))
  const query = search.toString()
  const res = await fetch(`${API_URL}/loyalty/admin/cash-closures${query ? `?${query}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  await assertOk(res, 'No se pudieron obtener los cierres de caja')
  return readJson(res)
}

export async function createCashClosure(
  payload: CreateCashClosurePayload,
  token: string,
): Promise<CashClosure> {
  const res = await fetch(`${API_URL}/loyalty/admin/cash-closures`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
  await assertOk(res, 'No se pudo guardar el cierre de caja')
  return readJson(res)
}

export async function createTicket(ticket: Partial<PaymentTicket>, token: string) {
  const res = await fetch(`${API_URL}/loyalty/tickets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(ticket),
  })
  await assertOk(res, 'No se pudo crear el ticket')
  return res.json()
}

export async function cancelTicket(ticketId: number, token: string) {
  const res = await fetch(`${API_URL}/loyalty/tickets/${ticketId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  })
  await assertOk(res, 'No se pudo cancelar el ticket')
  return res.json()
}

export async function confirmTicket(ticketId: number, token: string) {
  const res = await fetch(`${API_URL}/loyalty/tickets/${ticketId}/confirm`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  })
  await assertOk(res, 'No se pudo confirmar el ticket')
  return res.json()
}

export async function updateProfile(data: { phone?: string; cedula?: string; name?: string; hasSeenWelcome?: boolean; hasSeenFirstCoupon?: boolean; lastGiftSeenAt?: string | null }, token: string) {
  const res = await fetch(`${API_URL}/loyalty/me/profile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    throw new Error('No se pudo actualizar el perfil')
  }
  return res.json()
}

// --- PRODUCTS ---

export async function fetchProducts(token: string): Promise<ProductDef[]> {
  const res = await fetch(`${API_URL}/loyalty/products`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error("Failed to fetch products")
  return res.json()
}

export async function fetchPublicProducts(): Promise<ProductDef[]> {
  const res = await fetch(`${API_URL}/loyalty/public/products`)
  if (!res.ok) throw new Error("Failed to fetch products")
  return res.json()
}

export async function createGuestTicket(ticket: any) {
  const res = await fetch(`${API_URL}/loyalty/public/tickets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(ticket),
  })
  if (!res.ok) {
    let message = "Failed to create guest ticket"
    try {
      const data = await res.json()
      if (data?.message) message = data.message
    } catch {
      const text = await res.text().catch(() => "")
      if (text) message = text
    }
    throw new Error(message)
  }
  return res.json()
}

export async function createProduct(product: Partial<ProductDef>, token: string): Promise<ProductDef> {
  const res = await fetch(`${API_URL}/loyalty/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(product),
  })
  if (!res.ok) throw new Error("Failed to create product")
  return res.json()
}

export async function updateProduct(id: string, product: Partial<ProductDef>, token: string): Promise<ProductDef> {
  const res = await fetch(`${API_URL}/loyalty/products/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(product),
  })
  if (!res.ok) throw new Error("Failed to update product")
  return res.json()
}

export async function deleteProduct(id: string, token: string): Promise<void> {
  const res = await fetch(`${API_URL}/loyalty/products/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error("Failed to delete product")
}

export async function adjustProductStock(id: string, delta: number, token: string): Promise<ProductDef> {
  const res = await fetch(`${API_URL}/loyalty/products/${id}/adjust-stock`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ delta }),
  })
  if (!res.ok) throw new Error("Failed to adjust stock")
  return res.json()
}

export async function fetchExpenses(token: string, params?: { start?: string; end?: string; limit?: number }): Promise<Expense[]> {
  const url = new URL(`${API_URL}/loyalty/expenses`)
  if (params?.start) url.searchParams.set("start", params.start)
  if (params?.end) url.searchParams.set("end", params.end)
  if (params?.limit) url.searchParams.set("limit", String(params.limit))

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error("Failed to fetch expenses")
  return res.json()
}

export async function registerExpense(payload: RegisterExpensePayload, token: string): Promise<Expense> {
  const res = await fetch(`${API_URL}/loyalty/expenses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error("Failed to register expense")
  return res.json()
}

export type ResetDataMode = 'all' | 'range'

export type ResetDataPayload = {
  mode?: ResetDataMode
  start?: string
  end?: string
}

export type ResetDataResponse = {
  ok: boolean
  message: string
  mode: ResetDataMode
  start?: string
  end?: string
  deletedSales?: number
  deletedExpenses?: number
}

export async function resetData(token: string, payload: ResetDataPayload = {}): Promise<ResetDataResponse> {
  const res = await fetch(`${API_URL}/loyalty/admin/reset-data`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(msg || 'Error al reiniciar datos')
  }
  return res.json()
}

export interface FinancialSettings {
  fixedExpenses: number
}

const normalizeFinancialSettings = (data: any): FinancialSettings => {
  const fixedExpenses = Number(data?.fixedExpenses ?? 0)
  return {
    fixedExpenses: Number.isFinite(fixedExpenses) ? fixedExpenses : 0,
  }
}

export async function fetchFinancialSettings(_token: string): Promise<FinancialSettings> {
  const res = await fetch(`${API_URL}/recetario/config`)
  await assertOk(res, "No se pudieron obtener los ajustes financieros")
  return normalizeFinancialSettings(await readJson(res))
}

export async function updateFinancialSettings(settings: FinancialSettings, token: string): Promise<FinancialSettings> {
  const res = await fetch(`${API_URL}/recetario/config`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      fixedExpenses: Number(settings.fixedExpenses ?? 0) || 0,
    }),
  })
  await assertOk(res, "No se pudieron guardar los ajustes financieros")
  return normalizeFinancialSettings(await readJson(res))
}
