import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import QRCodeLib from "qrcode"
import JSZip from "jszip"
import { saveAs } from "file-saver"
import { AlertCircle, ArrowRight, ArrowLeft, CheckCircle2, Store, X, Sparkles, Eye, EyeOff, Circle } from "lucide-react"
import LoadingScreen from "./components/ui/LoadingScreen"
import { SpeedInsights } from "@vercel/speed-insights/react"

// -----------------------------------------------------------------------------
// LOGIC & TYPES
// -----------------------------------------------------------------------------

import { login, register, forgotPassword, resetPassword } from "./api/auth"
import { subscribeToNotifications, unsubscribeFromNotifications } from "./api/notifications"
import {
  claimCode,
  fetchDashboardStats,
  fetchMe,
  generateClaims,
  inspectCoupon,
  lookupUser,
  lookupUserByCedula,
  registerSale,
  redeemCoupon,
  transferCoupon,
  fetchTickets,
  fetchTicketPointsIntegrity as fetchTicketPointsIntegrityApi,
  createTicket,
  confirmTicket,
  cancelTicket,
  reconcileTicketPoints as reconcileTicketPointsApi,
  updateProfile,
  logSaleEvents,
  fetchSalesEvents,
  setUnauthorizedHandler,
  fetchProducts,
  createProduct,
  updateProduct,
  deleteUser,
  adjustProductStock,
  updateLoyaltyRules,
  fetchExpenses,
  type DashboardStats,
  type LookupUserResponse,
  type TicketPointsIntegrityResponse,
  type TicketPointsReconcileResponse,
} from "./api/secure"
import { fetchLoyaltyRules } from "./api/loyalty"
import {
  getNextThreshold,
  loyaltyRules as localRules,
  rewardLadder as localLadder,
  levelLadder as localLevelLadder,
  levelWindowDays as localLevelWindow,
} from "./config/loyaltyRules"
import { SITE_URL } from "./api/config"
import type { LoyaltyRulesResponse, LevelDefinition } from "./types/loyalty"
import type {
  AuthUser,
  CouponDto,
  CouponInspectResponse,
  CouponStats,
  UserActivityDto,
  UserCouponsState,
  UserLevelState,
} from "./types/userState"
import type {
  CouponActivity,
  GeneratedQrRecord,
  PendingSale,
  PaymentTicket,
  ProductDef,
  ScannedProduct,
  ScannerState,
  SalesEvent,
  CajaState, // [NEW] Import
  Expense,
  Toast,
  ToastTone,
} from "./types/app"
import ClientInterface from "./interfaces/ClientInterface"
import AdminInterface from "./interfaces/AdminInterface"
import SellerInterface from "./interfaces/SellerInterface"
import GuestInterface from "./interfaces/GuestInterface" // New Import
import { createGuestTicket, fetchPublicProducts } from "./api/secure" // New Import
import { normalizeSaleCode } from "./utils/adminUtils"
import { calculateRecipeCosts, calculateMarginFromPrice } from "./utils/financeUtils"
import { roundUsd } from "./utils/currency"
import { API_URL } from "./api/config"
import type { Recipe } from "./types/recetario"


type QrProductMeta = {
  productId?: string
  name?: string
  price?: number
  points?: number
  productIndex?: number
  quantity?: number
}

// Variables unused removed: PRODUCTS_KEY, AUTH_TOKEN_KEY, initialCatalog
const QR_REGISTRY_KEY = "qr_registry"
const USED_CODES_KEY = "krum-used-codes"
const PROFILE_NAMES_KEY = "loyalty-profile-names"
const MANUAL_SALES_KEY = "manual_sales_v2"
const QR_SALES_LOG_KEY = "qr_sales_log_v2"
const PENDING_SALES_KEY = "pending_sales_v2"
const PENDING_NOTICE_KEY = "pending_notice_v2"
const DAILY_RATE_CACHE_KEY = "daily_rate_cache_v1"
const TICKETS_CACHE_KEY = "payment_tickets_cache_v1"
const TICKETS_CACHE_LIMIT = 200
const HISTORY_LIMIT = 50
const FINANCE_RECORD_LIMIT = 5000
const normalizeCodeId = (code: string) => code.trim().toLowerCase()
const normalizeEmail = (email?: string | null) => {
  const trimmed = email?.trim().toLowerCase()
  return trimmed || null
}
const getTicketsCacheKey = (userId?: string | null, email?: string | null) => {
  const owner = userId || normalizeEmail(email)
  return owner ? `${TICKETS_CACHE_KEY}:${owner}` : null
}
const readCachedTickets = (cacheKey: string | null): PaymentTicket[] => {
  if (!cacheKey || typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(cacheKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(Boolean) : []
  } catch {
    return []
  }
}
const writeCachedTickets = (cacheKey: string | null, tickets: PaymentTicket[]) => {
  if (!cacheKey || typeof window === "undefined") return
  try {
    if (!tickets.length) {
      window.localStorage.removeItem(cacheKey)
      return
    }
    window.localStorage.setItem(cacheKey, JSON.stringify(tickets.slice(0, TICKETS_CACHE_LIMIT)))
  } catch {
    // Ignore cache write failures in private/restricted contexts.
  }
}
const normalizeCedula = (value?: string | null) => {
  const digits = value?.replace(/\D/g, "")
  return digits && digits.length ? digits : null
}

const DEFAULT_RULES: LoyaltyRulesResponse = {
  ...localRules,
  rewardLadder: localLadder,
  levelWindowDays: localLevelWindow,
  levelLadder: localLevelLadder,
}

const readRuleNumber = (value: any, fallback: number | undefined) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

const mergeRules = (incoming?: Partial<LoyaltyRulesResponse> | null): LoyaltyRulesResponse => {
  if (!incoming) return DEFAULT_RULES
  return {
    ...DEFAULT_RULES,
    ...incoming,
    pointsPerProduct: readRuleNumber(incoming.pointsPerProduct, DEFAULT_RULES.pointsPerProduct) ?? DEFAULT_RULES.pointsPerProduct,
    firstThreshold: readRuleNumber(incoming.firstThreshold, DEFAULT_RULES.firstThreshold) ?? DEFAULT_RULES.firstThreshold,
    thresholdStep: readRuleNumber(incoming.thresholdStep, DEFAULT_RULES.thresholdStep) ?? DEFAULT_RULES.thresholdStep,
    couponExpiryDays: readRuleNumber(incoming.couponExpiryDays, DEFAULT_RULES.couponExpiryDays) ?? DEFAULT_RULES.couponExpiryDays,
    levelMonthlyCouponExpiryDays: readRuleNumber(incoming.levelMonthlyCouponExpiryDays, DEFAULT_RULES.levelMonthlyCouponExpiryDays) ?? DEFAULT_RULES.levelMonthlyCouponExpiryDays,
    levelMonthlyCouponRenewDay: readRuleNumber(incoming.levelMonthlyCouponRenewDay, DEFAULT_RULES.levelMonthlyCouponRenewDay) ?? DEFAULT_RULES.levelMonthlyCouponRenewDay,
    levelWindowDays: readRuleNumber(incoming.levelWindowDays, DEFAULT_RULES.levelWindowDays) ?? DEFAULT_RULES.levelWindowDays,
    rewardLadder: Array.isArray(incoming.rewardLadder) ? incoming.rewardLadder : DEFAULT_RULES.rewardLadder,
    levelLadder: Array.isArray(incoming.levelLadder) && incoming.levelLadder.length ? incoming.levelLadder : DEFAULT_RULES.levelLadder,
  }
}

const normalizeProductPrice = (product: ProductDef): ProductDef => {
  const normalized = roundUsd(product.price ?? 0)
  if (!Number.isFinite(normalized)) return product
  if (normalized === product.price) return product
  return { ...product, price: normalized }
}

const normalizeCatalogPrices = (items: ProductDef[]) => items.map(normalizeProductPrice)

const normalizeSalesEventRecord = (event: SalesEvent, idx = 0): SalesEvent => {
  const timestamp = (event.scannedAt || event.occurredAt || (event as any)?.createdAt || "") as string
  const parsedDate = timestamp ? new Date(timestamp) : new Date()
  const safeDate = !Number.isNaN(parsedDate.getTime()) ? parsedDate : new Date()
  const normalizedCode = normalizeSaleCode(event.code || event.key || "")
  const recordId = (event as any)?.id
  const key =
    event.key ||
    normalizedCode ||
    (typeof recordId === "string" || typeof recordId === "number" ? String(recordId) : undefined) ||
    `${event.name}-${safeDate.toISOString()}-${idx}`

  return {
    ...event,
    key,
    code: normalizedCode || event.code,
    scannedAt: safeDate.toISOString(),
    currency: event.currency || "USD",
  }
}

// Helper to determine product from code (supports p{index}- prefix or hash fallback)
const buildProductFromCode = (code: string, defaultPoints: number, catalog: ProductDef[]): ScannedProduct | null => {
  if (!code) return null
  const normalized = code.startsWith("claim:") ? code.replace("claim:", "") : code
  const pool = catalog.length
    ? catalog
    : [{
      name: "Producto sin catalogo",
      price: 0,
      points: defaultPoints,
      stock: 0,
    }]

  // 1. Try Prefix Matching (p0-, p1-, etc.)
  const prefixMatch = normalized.match(/^p(\d+)-/)
  if (prefixMatch) {
    const idx = parseInt(prefixMatch[1])
    if (idx >= 0 && idx < pool.length) {
      const base = pool[idx]
      const points = base.points || defaultPoints
      const productIndex = catalog.length ? Math.min(idx, catalog.length - 1) : undefined

      return {
        code: normalized,
        name: base.name,
        price: base.price,
        points,
        scannedAt: new Date().toISOString(),
        productId: (catalog[productIndex ?? -1] || base)?.id,
        productIndex,
        status: "pending",
      }
    }
  }

  // 2. Handle Ticket Claims
  if (normalized.startsWith("ticket://")) {
    const ticketId = normalized.replace("ticket://", "")
    return {
      code: normalized,
      name: `Orden #${ticketId}`,
      price: 0,
      points: defaultPoints,
      scannedAt: new Date().toISOString(),
      status: "pending",
    }
  }

  // If no prefix match, return null (invalid code)
  return null
}

const parseProductMeta = (raw: string): QrProductMeta | null => {
  if (!raw) return null
  try {
    const maybeUrl = new URL(raw)
    const params = maybeUrl.searchParams
    const name = params.get("name") ?? params.get("product") ?? params.get("n")
    const productId = params.get("productId") ?? params.get("pid")
    const pointsParam = params.get("points") ?? params.get("p") ?? params.get("pts")
    const priceParam = params.get("price") ?? params.get("pr")
    const indexParam = params.get("pIdx") ?? params.get("idx")
    const qtyParam = params.get("qty") ?? params.get("quantity") ?? params.get("q")
    const parsedPoints = pointsParam !== null ? Number(pointsParam) : undefined
    const parsedPrice = priceParam !== null ? Number(priceParam) : undefined
    const parsedIndex = indexParam !== null ? Number(indexParam) : undefined
    const parsedQty = qtyParam !== null ? Number(qtyParam) : undefined
    const hasMeta =
      Boolean(name) ||
      Boolean(productId) ||
      typeof parsedPoints === "number" && !Number.isNaN(parsedPoints) ||
      typeof parsedPrice === "number" && !Number.isNaN(parsedPrice) ||
      typeof parsedIndex === "number" && !Number.isNaN(parsedIndex) ||
      typeof parsedQty === "number" && !Number.isNaN(parsedQty)

    if (!hasMeta) return null

    return {
      name: name ?? undefined,
      productId: productId ?? undefined,
      points: typeof parsedPoints === "number" && !Number.isNaN(parsedPoints) ? parsedPoints : undefined,
      price: typeof parsedPrice === "number" && !Number.isNaN(parsedPrice) ? parsedPrice : undefined,
      productIndex: typeof parsedIndex === "number" && !Number.isNaN(parsedIndex) ? parsedIndex : undefined,
      quantity: typeof parsedQty === "number" && !Number.isNaN(parsedQty) ? parsedQty : undefined,
    }
  } catch {
    return null
  }
}

const resolveProductFromScan = (
  normalizedCode: string,
  rawCode: string,
  defaultPoints: number,
  catalog: ProductDef[],
  registry: GeneratedQrRecord[],
): ScannedProduct => {
  const now = new Date().toISOString()
  if (!normalizedCode) {
    return {
      code: "",
      name: "Código Inválido",
      price: 0,
      points: 0,
      scannedAt: now,
      status: "invalid",
    }
  }
  const registryMatch = registry.find((qr) => qr.id.toLowerCase() === normalizedCode.toLowerCase())
  if (registryMatch) {
    const catalogProduct = registryMatch.productId
      ? catalog.find((p) => p.id === registryMatch.productId)
      : catalog.find((p) => p.name.toLowerCase() === registryMatch.productName.toLowerCase())
    const catalogIndex = catalogProduct ? catalog.indexOf(catalogProduct) : -1
    return {
      code: normalizedCode,
      name: registryMatch.productName,
      price: roundUsd(registryMatch.price ?? 0),
      points: registryMatch.points ?? defaultPoints,
      scannedAt: now,
      productId: catalogProduct?.id ?? registryMatch.productId,
      productIndex: catalogIndex >= 0 ? catalogIndex : undefined,
      status: "pending",
    }
  }

  const meta = parseProductMeta(rawCode)
  if (meta) {
    const explicitIndex = typeof meta.productIndex === "number" ? meta.productIndex : -1
    const matchedById = meta.productId
      ? catalog.find((p) => p.id === meta.productId)
      : undefined
    const indexedProduct = explicitIndex >= 0 && explicitIndex < catalog.length ? catalog[explicitIndex] : undefined
    const metaName = meta.name?.toLowerCase()
    const matchedByName = metaName
      ? catalog.find((p) => p.name.toLowerCase() === metaName)
      : undefined
    const targetProduct = matchedById ?? indexedProduct ?? matchedByName
    const fallback = targetProduct ?? catalog[0] ?? { name: "Producto", price: 0, points: defaultPoints }
    const resolvedIndex = targetProduct
      ? catalog.indexOf(targetProduct)
      : explicitIndex >= 0 && explicitIndex < catalog.length
        ? explicitIndex
        : catalog[0]
          ? 0
          : -1
    return {
      code: normalizedCode,
      name: meta.name || fallback.name,
      price: roundUsd(typeof meta.price === "number" ? meta.price : fallback.price),
      points: typeof meta.points === "number" ? meta.points : (fallback.points || defaultPoints),
      scannedAt: now,
      productId: targetProduct?.id ?? catalog[resolvedIndex]?.id,
      productIndex: resolvedIndex >= 0 ? resolvedIndex : undefined,
      quantity: typeof meta.quantity === "number" ? meta.quantity : undefined,
      status: "pending",
    }
  }

  const built = buildProductFromCode(normalizedCode, defaultPoints, catalog)
  if (built) return built

  // If validation failed
  return {
    code: normalizedCode,
    name: "Código Inválido",
    price: 0,
    points: 0,
    scannedAt: now,
    status: "invalid",
  }
}

const buildLevelState = (
  userState: UserCouponsState,
  ladder: LevelDefinition[],
  _windowDays: number = 30
): UserLevelState => {
  const points = userState.totalPoints
  const sorted = [...ladder].sort((a, b) => a.minPoints - b.minPoints)
  let current = sorted[0] || ladder[0]
  const nextIdx = sorted.findIndex(l => points < l.minPoints)
  const next = nextIdx !== -1 ? sorted[nextIdx] : null
  // If we processed all and points are higher than last, current is the last one
  if (nextIdx === -1 && sorted.length) current = sorted[sorted.length - 1]
  // Else if found next, current is the one before it (if any)
  else if (nextIdx > 0) current = sorted[nextIdx - 1]

  return {
    currentLevel: current,
    nextLevel: next,
    pointsInWindow: points,
    windowStart: new Date().toISOString(),
    windowEnd: new Date().toISOString(),
    expiresAt: null,
    awardedAt: new Date().toISOString(),
    pointsToNext: next ? next.minPoints - points : null,
  }
}

const normalizeUserState = (
  state: UserCouponsState,
  activeRules: LoyaltyRulesResponse,
  previous?: UserCouponsState | null,
): UserCouponsState => {
  const rawPoints = Number.isFinite(Number(state.totalPoints)) ? Number(state.totalPoints) : 0
  const previousPoints = previous?.totalPoints ?? 0

  // Fix: Do not artificially boost points based on coupons (e.g. gifted ones)
  // The totalPoints should reflect actual earnings.
  const totalPoints = Math.max(0, rawPoints, previousPoints)

  return {
    ...state,
    totalPoints,
    nextThreshold: getNextThreshold(totalPoints, activeRules.firstThreshold, activeRules.thresholdStep),
  }
}

export default function App() {
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [me, setMe] = useState<UserCouponsState | null>(null)
  const [userStateLoading, setUserStateLoading] = useState(true)
  const [catalogLoading, setCatalogLoading] = useState(true)

  // --- UI STATE ---
  const [loadingAction, setLoadingAction] = useState(false)
  const [authModeLanding, setAuthModeLanding] = useState<"login" | "register" | "forgot" | "reset" | "menu">("menu")
  const [authError, setAuthError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: "", email: "", cedula: "", password: "", confirmPassword: "", mode: "login" as "login" | "register" })
  const [recoveryCode, setRecoveryCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [resetEmail, setResetEmail] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])

  // --- ADMIN & SELLER STATE ---
  const [adminTab, setAdminTab] = useState<"home" | "register" | "qr" | "validator" | "generator" | "products" | "sales" | "metrics" | "tickets" | "recetario" | "rewards">("home")
  const [adminGen, setAdminGen] = useState({ count: 1, status: "" })
  const [newProduct, setNewProduct] = useState({ name: "", price: "", points: "", stock: "", cost: "", imageUrl: "", description: "" })
  const [editingProduct, setEditingProduct] = useState<{ index: number; draft: { name: string; price: string; points: string; stock: string; cost: string; imageUrl: string; description: string } } | null>(null)
  const [inventoryFilter, setInventoryFilter] = useState<"all" | "low">("all")
  const [registeredUsers, setRegisteredUsers] = useState(0)
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null)
  const [couponStats, setCouponStats] = useState<CouponStats>({ total: 0, available: 0, used: 0, expired: 0 })
  const [adminCouponLookup, setAdminCouponLookup] = useState({ code: "", status: "" })
  const [inspectedCoupon, setInspectedCoupon] = useState<CouponInspectResponse | null>(null)
  const [redeemingCoupon, setRedeemingCoupon] = useState(false)
  const [checkoutCustomer, setCheckoutCustomer] = useState<{
    email: string
    cedula: string
    userId: string | null
    levelState: UserLevelState | null
    coupons: CouponDto[]
    loading: boolean
    error: string | null
  }>({
    email: "",
    cedula: "",
    userId: null,
    levelState: null,
    coupons: [],
    loading: false,
    error: null,
  })

  // [NEW] Lifted Caja State for persistence
  const [cajaState, setCajaState] = useState<CajaState>({
    cartItems: [],
    appliedCoupon: null,
    isRegisteredUser: true,
  })
  const [manualSales, setManualSales] = useState<ScannedProduct[]>([])
  const [qrSalesLedger, setQrSalesLedger] = useState<ScannedProduct[]>([])
  const [salesEvents, setSalesEvents] = useState<SalesEvent[]>([])
  const [pendingSales, setPendingSales] = useState<Record<string, PendingSale[]>>(() => {
    if (typeof window === "undefined") return {}
    const saved = localStorage.getItem(PENDING_SALES_KEY)
    return saved ? JSON.parse(saved) : {}
  })
  const [dismissedPendingNotice, setDismissedPendingNotice] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {}
    const saved = localStorage.getItem(PENDING_NOTICE_KEY)
    return saved ? JSON.parse(saved) : {}
  })
  const [paymentTickets, setPaymentTickets] = useState<PaymentTicket[]>([])
  const [ticketsNextCursor, setTicketsNextCursor] = useState<string | null>(null)
  const [ticketsPagingInitialized, setTicketsPagingInitialized] = useState(false)
  const [ticketsInitialLoading, setTicketsInitialLoading] = useState(false)
  const [ticketsLoadError, setTicketsLoadError] = useState<string | null>(null)
  const [ticketsLoaded, setTicketsLoaded] = useState(false)
  const [ticketsLoadingMore, setTicketsLoadingMore] = useState(false)
  const [confirmingTickets, setConfirmingTickets] = useState<Set<number>>(new Set())
  const ticketsSnapshotRef = useRef<PaymentTicket[]>([])
  const ticketsRefreshRequestRef = useRef(0)
  const [loyaltyRules, setLoyaltyRules] = useState<LoyaltyRulesResponse>(DEFAULT_RULES)
  const [expenses, setExpenses] = useState<Expense[]>([])

  // --- DATA STORES ---
  const [catalog, setCatalog] = useState<ProductDef[]>([])
  const [qrRegistry, setQrRegistry] = useState<GeneratedQrRecord[]>(() => {
    if (typeof window === "undefined") return []
    const saved = localStorage.getItem(QR_REGISTRY_KEY)
    return saved ? JSON.parse(saved) : []
  })
  const [scanHistory, setScanHistory] = useState<ScannedProduct[]>([])
  const [invalidatedCodes, setInvalidatedCodes] = useState<string[]>(() => {
    if (typeof window === "undefined") return []
    const saved = localStorage.getItem(USED_CODES_KEY)
    return saved ? JSON.parse(saved) : []
  })
  const [profileNames, setProfileNames] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {}
    const saved = localStorage.getItem(PROFILE_NAMES_KEY)
    return saved ? JSON.parse(saved) : {}
  })

  const TICKETS_PAGE_SIZE = 100


  // --- INITIAL DATA ---
  useEffect(() => {
    fetchPublicProducts()
      .then((data) => setCatalog(normalizeCatalogPrices(data)))
      .catch(err => console.error("Catalog fetch failed", err))
      .finally(() => setCatalogLoading(false))

    // Restore Auth
    const stored = localStorage.getItem("loyalty-auth")
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed.token && parsed.user) {
          setAuthToken(parsed.token)
          setUser(parsed.user)
          if (parsed.user.role !== "admin" && parsed.user.role !== "seller") {
            unsubscribeFromNotifications()
          }
          fetchMe(parsed.token)
            .then(data => setMe(prev => enrichStateWithLevel(data, prev)))
            .catch(() => {
              // Token invalid, clear it
              setAuthToken(null)
              setUser(null)
              localStorage.removeItem("loyalty-auth")
            })
        }
      } catch (err) {
        console.error("Failed to restore auth", err)
      }
    }
  }, [])

  useEffect(() => {
    let active = true
    let interval: number | undefined
    const loadRules = async () => {
      try {
        const data = await fetchLoyaltyRules()
        if (!active) return
        setLoyaltyRules(mergeRules(data))
      } catch (err) {
        console.error("Rules fetch failed", err)
      }
    }
    loadRules()
    if (user?.role !== "admin") {
      interval = window.setInterval(loadRules, 5 * 60 * 1000)
    }
    return () => {
      active = false
      if (interval) window.clearInterval(interval)
    }
  }, [user?.role])

  // --- SCANNER & CLAIMS ---
  const [claimScanner, setClaimScanner] = useState<ScannerState>({ active: false, status: "", last: "" })


  const handleSubscribeToNotifications = useCallback(async () => {
    if (!authToken) return
    await subscribeToNotifications(authToken)
  }, [authToken])

  const [couponScanner, setCouponScanner] = useState<ScannerState>({ active: false, status: "", last: "" })
  const [claimForm, setClaimForm] = useState({ code: "", status: "" })
  const [scannedProduct, setScannedProduct] = useState<ScannedProduct | null>(null)
  const [pendingCode, setPendingCode] = useState<string | null>(null)
  const [dailyRate, setDailyRate] = useState<number>(0)

  // --- COUPONS & REWARDS ---
  const [redeemModal, setRedeemModal] = useState<{ active: boolean; coupon: CouponDto | null; qr: string | null }>({ active: false, coupon: null, qr: null })
  const [giftingCouponId, setGiftingCouponId] = useState<string | null>(null)
  const [couponActivity, setCouponActivity] = useState<CouponActivity[]>([])
  const [levelGrant, setLevelGrant] = useState<{ levelName: string; coupons: CouponDto[] } | null>(null)
  const [selectedProductIdx, setSelectedProductIdx] = useState(0)

  // --- REFS ---
  const claimVideoRef = useRef<HTMLVideoElement>(null)
  const couponVideoRef = useRef<HTMLVideoElement>(null)
  const claimControlsRef = useRef<any>(null)
  const couponControlsRef = useRef<any>(null)
  const previousCouponsRef = useRef<CouponDto[]>([])
  const selfIssuedCouponIdsRef = useRef<Set<string>>(new Set())
  const unauthorizedHandledRef = useRef(false)

  // --- DAILY RATE FETCH ---
  useEffect(() => {
    let active = true
    let retryTimer: number | null = null

    const parseRate = (value: unknown) => {
      const parsed = Number(value)
      if (!Number.isFinite(parsed) || parsed <= 0) return null
      return Number(parsed.toFixed(2))
    }
    const getRateDateKey = (value: Date | string = new Date()) => {
      const parsed = value instanceof Date ? value : new Date(value)
      if (Number.isNaN(parsed.getTime())) return null
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Caracas",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(parsed)
      const get = (type: string) => parts.find((part) => part.type === type)?.value
      const year = get("year")
      const month = get("month")
      const day = get("day")
      return year && month && day ? `${year}-${month}-${day}` : parsed.toISOString().slice(0, 10)
    }

    const readCachedRate = () => {
      try {
        const cached = window.localStorage.getItem(DAILY_RATE_CACHE_KEY)
        if (!cached) return
        let parsed: number | null = null
        try {
          const data = JSON.parse(cached)
          const today = getRateDateKey()
          const cacheDate = typeof data?.date === "string" ? data.date : null
          parsed = cacheDate && cacheDate === today ? parseRate(data?.rate) : null
        } catch {
          parsed = parseRate(cached)
        }
        if (parsed && active) {
          setDailyRate(parsed)
        }
      } catch {
        // Ignore localStorage failures in private/restricted contexts.
      }
    }

    const persistRate = (rate: number, date?: string | null) => {
      try {
        window.localStorage.setItem(DAILY_RATE_CACHE_KEY, JSON.stringify({
          rate,
          date: date || getRateDateKey() || new Date().toISOString().slice(0, 10),
        }))
      } catch {
        // Ignore localStorage failures in private/restricted contexts.
      }
    }

    const fetchDailyRate = async (scheduleRetry: boolean) => {
      try {
        const res = await fetch(`${API_URL}/loyalty/public/exchange-rate`)
        if (!res.ok) {
          throw new Error(`Daily rate request failed with ${res.status}`)
        }

        const data = await res.json()
        const nextRate = parseRate(data?.rate)
        if (!nextRate) {
          throw new Error("Daily rate payload is invalid")
        }

        if (!active) return
        setDailyRate(nextRate)
        persistRate(nextRate, typeof data?.date === "string" ? data.date : null)
      } catch (err) {
        console.error("Error fetching daily rate", err)
        if (scheduleRetry && active) {
          retryTimer = window.setTimeout(() => {
            void fetchDailyRate(false)
          }, 15000)
        }
      }
    }

    readCachedRate()
    void fetchDailyRate(true)
    const refreshInterval = window.setInterval(() => {
      void fetchDailyRate(false)
    }, 10 * 60 * 1000)

    return () => {
      active = false
      if (retryTimer) window.clearTimeout(retryTimer)
      window.clearInterval(refreshInterval)
    }
  }, [])

  useEffect(() => {
    setPaymentTickets([])
    setTicketsNextCursor(null)
    setTicketsPagingInitialized(false)
    setTicketsLoadingMore(false)
  }, [user?.id])

  // --- HELPERS & DERIVED ---
  const rules = loyaltyRules
  const levelRules = useMemo(() => ({
    ladder: rules.levelLadder ?? localLevelLadder,
    window: Number.isFinite(Number(rules.levelWindowDays)) ? Number(rules.levelWindowDays) : localLevelWindow,
  }), [rules.levelLadder, rules.levelWindowDays])
  const isAdmin = user?.role === "admin"
  const isSeller = user?.role === "seller"
  const isBackoffice = isAdmin || isSeller
  const isAuthed = !!authToken

  const levelState = me?.levelState
  const coupons = me?.coupons || []
  const ladder = rules.rewardLadder ?? localLadder
  const nextReward = ladder.find(r => r.threshold > (me?.nextThreshold || 0))

  // Calculate Punch Slots Logic
  // Find current reward bracket
  const totalPoints = me?.totalPoints || 0
  const sortedLadder = [...ladder].sort((a, b) => a.threshold - b.threshold)
  const nextRewardIndex = sortedLadder.findIndex(r => r.threshold > totalPoints)

  // If nextRewardIndex is -1, user passed all rewards (super user), use last interval or fallback
  // For simplicity, if passed all, maybe show full card or 0. Let's show last interval.
  const targetReward = nextRewardIndex !== -1 ? sortedLadder[nextRewardIndex] : sortedLadder[sortedLadder.length - 1]
  const previousReward = nextRewardIndex > 0 ? sortedLadder[nextRewardIndex - 1] : null

  const prevThreshold = previousReward ? previousReward.threshold : 0
  const nextThreshold = targetReward ? targetReward.threshold : (prevThreshold + 5) // Fallback step

  const punchSlots = nextThreshold - prevThreshold
  const punchesFilled = Math.min(punchSlots, Math.max(0, totalPoints - prevThreshold))

  const showRewardAnimation = false
  const punchPopVersion = 0

  const inventorySummary = useMemo(() => {
    const totalStock = catalog.reduce((acc, p) => acc + (p.stock || 0), 0)
    const items = catalog.length
    const totalValue = catalog.reduce((acc, p) => acc + ((p.stock || 0) * p.price), 0)
    const lowStock = catalog.filter(p => (p.stock || 0) < 5).length
    return { totalStock, items, totalValue, lowStock }
  }, [catalog])

  const filteredInventory = useMemo(() => {
    if (inventoryFilter === "low") return catalog.filter(p => (p.stock || 0) < 5)
    return catalog
  }, [catalog, inventoryFilter])

  const confirmedHistory = scanHistory.filter(h => h.status === "confirmed")
  const lowStockThreshold = 5

  const currentState = me
  const pendingSalesForUser = user?.email ? (pendingSales[normalizeEmail(user.email) || ""] || []) : []
  const shouldShowPendingNotice = user?.email
    ? (pendingSalesForUser.length > 0 && !dismissedPendingNotice[normalizeEmail(user.email) || ""])
    : false
  const ticketsForUser = useMemo(() => {
    if (!user) return []
    return paymentTickets
  }, [paymentTickets, user?.id])
  const clientState: UserCouponsState = currentState ?? {
    totalPoints: 0,
    nextThreshold: getNextThreshold(0, rules.firstThreshold, rules.thresholdStep),
    coupons: [],
  }
  const clientLevelState: UserLevelState =
    clientState.levelState ??
    buildLevelState(clientState, levelRules.ladder, levelRules.window)

  const activeLevelState = checkoutCustomer.levelState ?? levelState

  const mergePaymentTickets = useCallback((current: PaymentTicket[], incoming: PaymentTicket[]) => {
    if (!incoming.length) return current
    const merged = new Map<string, PaymentTicket>()
    incoming.forEach((ticket) => merged.set(String(ticket.id), ticket))
    current.forEach((ticket) => {
      const key = String(ticket.id)
      if (!merged.has(key)) merged.set(key, ticket)
    })
    return Array.from(merged.values()).sort(
      (a, b) => {
        const timeDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        if (timeDiff !== 0) return timeDiff
        return Number(b.id) - Number(a.id)
      },
    )
  }, [])

  useEffect(() => {
    setTicketsNextCursor(null)
    setTicketsPagingInitialized(false)
    setTicketsLoadError(null)

    if (!user) {
      setPaymentTickets([])
      setTicketsLoaded(false)
      setTicketsInitialLoading(false)
      return
    }

    if (user.role === "admin" || user.role === "seller") {
      setPaymentTickets([])
      setTicketsLoaded(false)
      return
    }

    const cached = readCachedTickets(getTicketsCacheKey(user.id, user.email))
    setPaymentTickets(cached)
    setTicketsLoaded(cached.length > 0)
  }, [user?.email, user?.id, user?.role])

  useEffect(() => {
    if (!user || isBackoffice || !ticketsLoaded) return
    writeCachedTickets(getTicketsCacheKey(user.id, user.email), paymentTickets)
  }, [isBackoffice, paymentTickets, ticketsLoaded, user?.email, user?.id])

  const addToast = useCallback((message: string, tone: ToastTone = "info") => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, message, tone }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }, [])

  useEffect(() => {
    if (!me) {
      setCouponActivity([])
      setScanHistory([])
      return
    }

    // Map backend activity to frontend CouponActivity
    const backendActivity: CouponActivity[] = (me.activity ?? []).map<CouponActivity | null>((a: any) => {
      let direction: "in" | "out" = "in"
      let status = "available"
      let title = a.data?.couponTitle || "Actividad"
      let peer: string | null = null

      // Cleaned up titles to be purely descriptive of the item, 
      // the status/direction will be handled by the UI component
      if (a.type === "WIN") {
        direction = "in"
        title = a.data?.couponTitle
      } else if (a.type === "USE") {
        direction = "out"
        status = "used"
        title = a.data?.couponTitle
      } else if (a.type === "SEND") {
        direction = "out"
        title = a.data?.couponTitle
        peer = a.data?.peerName
      } else if (a.type === "RECEIVE") {
        direction = "in"
        title = a.data?.couponTitle
        peer = a.data?.peerName
      } else if (a.type === "LEVEL_UP") {
        direction = "in"
        title = `Nivel Desbloqueado: ${a.data?.levelName}`
      } else if (a.type === "LOGIN") {
        return null // No mostrar logins en el historial de premios
      }

      return {
        couponId: a.data?.couponId || a.id,
        title, // Now mostly just the coupon name
        kind: a.type === "LEVEL_UP" ? "level" : a.type === "LOGIN" ? "login" : "percent",
        status,
        direction,
        peer,
        at: a.createdAt,
        // Helper prop for the UI to know the original event type if needed
        activityType: a.type
      }
    }).filter((entry): entry is CouponActivity => Boolean(entry))

    setCouponActivity(backendActivity)

    setScanHistory(prev => {
      // 1. Filter out OLD PHANTOM PENDING items
      const validPending = prev.filter(item => {
        // Fix: Keep local items (including confirmed) until backend overwrites them.
        // This prevents items from disappearing due to sync delays.
        const check = buildProductFromCode(item.code, 0, catalog)
        return check !== null
      })

      // 2. Map Backend Claims (Source of Truth for Confirmed)
      const backendClaims = (me.claims ?? [])
        .filter(c => c.code)
        .map(c => {
          return {
            ...resolveProductFromScan(c.code, c.code, c.points, catalog, []),
            status: 'confirmed' as const,
            scannedAt: c.claimedAt,
            points: c.points
          }
        })

      // 3. Combine: Valid Pending + Backend Confirmed
      const combined = [...validPending, ...backendClaims]

      // 4. Return sorted unique list
      const uniqueMap = new Map<string, ScannedProduct>()
      combined.forEach(item => uniqueMap.set(item.code, item))

      return Array.from(uniqueMap.values())
        .sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime())
        .slice(0, HISTORY_LIMIT)
    })
  }, [me, catalog])

  useEffect(() => {
    if (!scanHistory.length) return
    const usedAtLookup = new Map<string, string>()
    scanHistory
      .filter((item) => item.status === "confirmed")
      .forEach((item) => usedAtLookup.set(normalizeCodeId(item.code), item.scannedAt))
    setInvalidatedCodes((prev) => {
      const next = new Set(prev.map((code) => normalizeCodeId(code)))
      scanHistory.forEach((item) => next.add(normalizeCodeId(item.code)))
      if (next.size === prev.length) return prev
      return Array.from(next)
    })
    if (usedAtLookup.size) {
      setQrRegistry((prev) => {
        let changed = false
        const next = prev.map((qr) => {
          const usedAt = usedAtLookup.get(normalizeCodeId(qr.id))
          if (!usedAt || qr.usedAt === usedAt) return qr
          changed = true
          return { ...qr, usedAt }
        })
        return changed ? next : prev
      })
    }
  }, [scanHistory])

  useEffect(() => {
    // Optional: Toast for new activity if needed, but pure state sync is handled above.
  }, [me?.activity])
  useEffect(() => {
    if (typeof window === "undefined") return
    const unique = Array.from(new Set(invalidatedCodes.map((code) => normalizeCodeId(code))))
    localStorage.setItem(USED_CODES_KEY, JSON.stringify(unique.slice(0, 800)))
  }, [invalidatedCodes])
  useEffect(() => {
    if (typeof window === "undefined") return
    localStorage.setItem(PROFILE_NAMES_KEY, JSON.stringify(profileNames))
  }, [profileNames])

  // Products catalog is now managed via API, no local storage sync needed
  // useEffect(() => {
  //   localStorage.setItem(PRODUCTS_KEY, JSON.stringify(catalog))
  // }, [catalog])
  useEffect(() => {
    localStorage.setItem(QR_REGISTRY_KEY, JSON.stringify(qrRegistry))
  }, [qrRegistry])
  useEffect(() => {
    localStorage.setItem(PENDING_SALES_KEY, JSON.stringify(pendingSales))
  }, [pendingSales])
  useEffect(() => {
    localStorage.setItem(PENDING_NOTICE_KEY, JSON.stringify(dismissedPendingNotice))
  }, [dismissedPendingNotice])

  useEffect(() => {
    if (!catalog.length) {
      setSelectedProductIdx(0)
      setEditingProduct(null)
      return
    }
    setSelectedProductIdx((prev) => Math.min(prev, catalog.length - 1))
    setEditingProduct((prev) => {
      if (!prev) return prev
      return prev.index >= catalog.length ? null : prev
    })
  }, [catalog.length])

  useEffect(() => {
    if (!catalog.length && !qrRegistry.length) return
    setCajaState((prev) => {
      if (!prev.cartItems.length) return prev
      const productById = new Map<string, ProductDef>()
      const productByName = new Map<string, ProductDef>()
      catalog.forEach((product) => {
        if (product.id) productById.set(product.id, product)
        if (product.name) productByName.set(product.name.toLowerCase(), product)
      })
      const qrPriceByCode = new Map<string, number>()
      qrRegistry.forEach((qr) => {
        const normalized = normalizeSaleCode(qr.id)?.toLowerCase() ?? qr.id.toLowerCase()
        qrPriceByCode.set(normalized, Number(qr.price ?? 0))
      })
      let changed = false
      const nextItems = prev.cartItems.map((item) => {
        const candidateCodes = [item.code, ...(item.codes ?? [])]
          .map((code) => (normalizeSaleCode(code) ?? code)?.toLowerCase())
          .filter((code): code is string => Boolean(code))
        let nextPrice: number | null = null
        for (const code of candidateCodes) {
          if (qrPriceByCode.has(code)) {
            nextPrice = qrPriceByCode.get(code) ?? null
            break
          }
        }
        if (nextPrice === null) {
          if (item.productId && productById.has(item.productId)) {
            nextPrice = Number(productById.get(item.productId)?.price ?? 0)
          } else if (item.name) {
            nextPrice = Number(productByName.get(item.name.toLowerCase())?.price ?? 0)
          }
        }
        if (nextPrice === null || !Number.isFinite(nextPrice)) return item
        const currentPrice = Number(item.price ?? 0)
        if (currentPrice === nextPrice) return item
        changed = true
        return { ...item, price: nextPrice }
      })
      return changed ? { ...prev, cartItems: nextItems } : prev
    })
  }, [catalog, qrRegistry])

  // HELPER FUNCTIONS
  const formatCouponSubtitle = (coupon: CouponDto) => {
    if (coupon.kind === "percent" && coupon.value) return `${coupon.value}% de descuento`
    if (coupon.kind === "free-item") return coupon.capUsd ? `Producto hasta $${coupon.capUsd}` : "Producto gratis"
    if (coupon.kind === "bogo") return "2x1 en brownies"
    if (coupon.kind === "combo") return "Combo especial"
    return "Recompensa"
  }

  const getCouponStatusLabel = (status: CouponDto["status"]) => {
    if (status === "available") return "Disponible"
    if (status === "used") return "Usado"
    return "Expirado"
  }
  const formatMoney = (value: number | string | undefined | null) => `$${Number(value ?? 0).toFixed(2)}`
  const formatPoints = (value: number | string | undefined | null) => {
    const num = Number(value ?? 0)
    return `${Number.isInteger(num) ? num : num.toFixed(2)} pts`
  }
  const mergeSalesEvents = useCallback((incoming: SalesEvent[]) => {
    if (!incoming?.length) return
    setSalesEvents((prev) => {
      const map = new Map<string, SalesEvent>()
      const upsert = (item: SalesEvent, idx = 0) => {
        const normalized = normalizeSalesEventRecord(item, idx)
        if (!normalized.key) return
        const existing = map.get(normalized.key)
        if (existing && (!normalized.paymentDetails?.length && existing.paymentDetails?.length)) {
          map.set(normalized.key, {
            ...normalized,
            paymentDetails: existing.paymentDetails,
            paymentMethod: normalized.paymentMethod ?? existing.paymentMethod,
          })
          return
        }
        map.set(normalized.key, normalized)
      }
      prev.forEach((item, idx) => upsert(item, idx))
      incoming.forEach((item, idx) => upsert(item, idx))
      return Array.from(map.values()).sort(
        (a, b) => new Date(b.scannedAt || b.occurredAt || "").getTime() - new Date(a.scannedAt || a.occurredAt || "").getTime(),
      ).slice(0, 1200)
    })
  }, [])

  const enrichStateWithLevel = useCallback(
    (data: UserCouponsState, previous?: UserCouponsState | null) => {
      const normalized = normalizeUserState(data, rules, previous)
      const nextLevel = buildLevelState(normalized, levelRules.ladder, levelRules.window)
      return { ...normalized, levelState: nextLevel }
    },
    [levelRules, rules],
  )

  const registerInvalidatedCode = useCallback(
    (rawCode: string | null | undefined, usedAt?: string | null) => {
      if (!rawCode) return
      const normalized = normalizeCodeId(rawCode)
      setInvalidatedCodes((prev) => {
        if (prev.includes(normalized)) return prev
        return [normalized, ...prev].slice(0, 800)
      })
      setQrRegistry((prev) => {
        let changed = false
        const next = prev.map((qr) => {
          if (normalizeCodeId(qr.id) !== normalized) return qr
          const timestamp = usedAt ?? qr.usedAt ?? new Date().toISOString()
          if (qr.usedAt === timestamp) return qr
          changed = true
          return { ...qr, usedAt: timestamp }
        })
        return changed ? next : prev
      })
    },
    [setQrRegistry],
  )

  // removeQrCodesFromUi removed as it was unused
  const registerPendingSalesForCustomer = useCallback(
    (email: string | null | undefined, items: PendingSale[]) => {
      const normalizedEmail = normalizeEmail(email)
      if (!normalizedEmail || !items.length) return

      setPendingSales((prev) => {
        const existing = prev[normalizedEmail] ?? []
        const seen = new Set(existing.map((item) => normalizeCodeId(item.code)))
        const merged = [...existing]

        items.forEach((item) => {
          const key = normalizeCodeId(item.code)
          if (seen.has(key)) return
          seen.add(key)
          merged.unshift(item)
        })

        return { ...prev, [normalizedEmail]: merged.slice(0, 60) }
      })
      setDismissedPendingNotice((prev) => ({ ...prev, [normalizedEmail]: false }))
    },
    [],
  )

  const resolvePendingSaleForUser = useCallback((email: string | null | undefined, code: string) => {
    const normalizedEmail = normalizeEmail(email)
    if (!normalizedEmail) return

    setPendingSales((prev) => {
      const list = prev[normalizedEmail] ?? []
      if (!list.length) return prev
      const nextList = list.filter((item) => normalizeCodeId(item.code) !== normalizeCodeId(code))
      if (nextList.length === list.length) return prev
      const next = { ...prev, [normalizedEmail]: nextList }
      if (!nextList.length) delete next[normalizedEmail]
      return next
    })
  }, [])

  const dismissPendingNoticeForUser = useCallback((email: string | null | undefined) => {
    const normalizedEmail = normalizeEmail(email)
    if (!normalizedEmail) return
    setDismissedPendingNotice((prev) => ({ ...prev, [normalizedEmail]: true }))
  }, [])

  const refreshTickets = useCallback(async () => {
    if (!authToken || !user) return
    const requestId = ticketsRefreshRequestRef.current + 1
    ticketsRefreshRequestRef.current = requestId
    const shouldShowInitialLoading = !ticketsLoaded && ticketsSnapshotRef.current.length === 0
    if (shouldShowInitialLoading) setTicketsInitialLoading(true)
    try {
      const page = await fetchTickets(authToken, { limit: TICKETS_PAGE_SIZE })
      if (ticketsRefreshRequestRef.current !== requestId) return
      const previous = ticketsSnapshotRef.current
      const merged = mergePaymentTickets(previous, page.items)
      const previousStatusById = new Map(previous.map((ticket) => [String(ticket.id), ticket.status]))
      const hasNewConfirmation = merged.some((ticket) => {
        if (ticket.status !== "confirmed") return false
        const previousStatus = previousStatusById.get(String(ticket.id))
        return previousStatus === "pending"
      })
      setPaymentTickets((prev) =>
        ticketsPagingInitialized ? mergePaymentTickets(prev, page.items) : mergePaymentTickets([], page.items),
      )
      setTicketsLoaded(true)
      setTicketsLoadError(null)
      if (!ticketsPagingInitialized) {
        setTicketsNextCursor(page.nextCursor ?? null)
        setTicketsPagingInitialized(true)
      }
      if (hasNewConfirmation) {
        try {
          const data = await fetchMe(authToken)
          setMe((prev) => enrichStateWithLevel(data, prev))
        } catch (err) {
          console.error("Failed to refresh user state after ticket confirmation", err)
        }
      }
    } catch (err) {
      if (ticketsRefreshRequestRef.current !== requestId) return
      if ((err as any)?.status === 401) {
        unauthorizedHandledRef.current = true
        setAuthToken(null)
        setUser(null)
        setMe(null)
        setPaymentTickets([])
        localStorage.removeItem("loyalty-auth")
        setTicketsLoaded(false)
        setTicketsLoadError(null)
        return
      }
      console.error("Failed to refresh tickets", err)
      setTicketsLoadError("No se pudieron actualizar tus pedidos. Se reintentara automaticamente.")
      if (ticketsSnapshotRef.current.length > 0) setTicketsLoaded(true)
    } finally {
      if (ticketsRefreshRequestRef.current === requestId) setTicketsInitialLoading(false)
    }
  }, [authToken, enrichStateWithLevel, mergePaymentTickets, ticketsLoaded, ticketsPagingInitialized, user])

  useEffect(() => {
    ticketsSnapshotRef.current = paymentTickets
  }, [paymentTickets])

  const loadMoreTickets = useCallback(async () => {
    if (!authToken || ticketsLoadingMore || !ticketsNextCursor) return
    setTicketsLoadingMore(true)
    try {
      const page = await fetchTickets(authToken, {
        limit: TICKETS_PAGE_SIZE,
        cursor: ticketsNextCursor,
      })
      setPaymentTickets((prev) => mergePaymentTickets(prev, page.items))
      setTicketsNextCursor(page.nextCursor ?? null)
      setTicketsLoaded(true)
      setTicketsLoadError(null)
    } catch (err) {
      console.error("Failed to load more tickets", err)
      setTicketsLoadError("No se pudieron cargar mas pedidos. Intentalo de nuevo.")
    }
    finally {
      setTicketsLoadingMore(false)
    }
  }, [authToken, mergePaymentTickets, ticketsLoadingMore, ticketsNextCursor])

  const createPaymentTicket = useCallback(
    async (payload: Omit<PaymentTicket, "id" | "status" | "createdAt" | "confirmedAt">) => {
      if (!authToken) {
        addToast("Debes iniciar sesión", "error")
        return
      }
      try {
        const response = await createTicket(payload, authToken)
        if (response) {
          setPaymentTickets((prev) => mergePaymentTickets(prev, [response]))
          setTicketsLoaded(true)
          setTicketsLoadError(null)
        }
        if (payload.couponId || payload.couponCode) {
          const data = await fetchMe(authToken)
          setMe((prev) => enrichStateWithLevel(data, prev))
        }
        addToast("Ticket enviado, pendiente de confirmación", "info")
        return response
      } catch (e: any) {
        const msg = e?.message || "Error al crear ticket"
        addToast(msg, "error")
      }
    },
    [addToast, authToken, enrichStateWithLevel, mergePaymentTickets],
  )

  const confirmPaymentTicket = useCallback(
    async (id: number) => {
      if (!authToken) return
      if (confirmingTickets.has(id)) return
      setConfirmingTickets(prev => {
        const next = new Set(prev)
        next.add(id)
        return next
      })
      try {
        await confirmTicket(id, authToken)
        setPaymentTickets((prev) =>
          prev.map((t) => (t.id === id ? { ...t, status: "confirmed", confirmedAt: new Date().toISOString() } : t)),
        )
        if (isBackoffice) {
          try {
            const data = await fetchSalesEvents(authToken, { limit: FINANCE_RECORD_LIMIT })
            setSalesEvents(data.map((item, idx) => normalizeSalesEventRecord(item, idx)))
          } catch (err) {
            console.error("Error al refrescar ventas tras confirmar ticket", err)
          }
        }
        addToast("Ticket confirmado", "success")
      } catch (e: any) {
        const msg = e?.message || "Error al confirmar ticket"
        addToast(msg, "error")
      } finally {
        setConfirmingTickets(prev => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }
    },
    [addToast, authToken, confirmingTickets, isBackoffice],
  )

  const handleAuditTicketPoints = useCallback(
    async (limit?: number): Promise<TicketPointsIntegrityResponse> => {
      if (!authToken) throw new Error("Debes iniciar sesión")
      return fetchTicketPointsIntegrityApi(authToken, limit)
    },
    [authToken],
  )

  const handleReconcileTicketPoints = useCallback(
    async (payload: { limit?: number; dryRun?: boolean }): Promise<TicketPointsReconcileResponse> => {
      if (!authToken) throw new Error("Debes iniciar sesión")
      const result = await reconcileTicketPointsApi(payload, authToken)

      if (!result.dryRun) {
        await refreshTickets()
        try {
          const data = await fetchMe(authToken)
          setMe((prev) => enrichStateWithLevel(data, prev))
        } catch (err) {
          console.error("Failed to refresh user state after ticket reconciliation", err)
        }
      }

      return result
    },
    [authToken, enrichStateWithLevel, refreshTickets],
  )

  const handleUpdateProfile = useCallback(async (data: { phone?: string; cedula?: string; name?: string; hasSeenWelcome?: boolean; hasSeenFirstCoupon?: boolean; lastGiftSeenAt?: string | null }) => {
    if (!authToken) return
    try {
      await updateProfile(data, authToken)
      // Update local user state immediately
      if (user) {
        const nextUser: AuthUser = {
          ...user,
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.hasSeenWelcome !== undefined ? { hasSeenWelcome: data.hasSeenWelcome } : {}),
          ...(data.hasSeenFirstCoupon !== undefined ? { hasSeenFirstCoupon: data.hasSeenFirstCoupon } : {}),
          ...(data.lastGiftSeenAt !== undefined ? { lastGiftSeenAt: data.lastGiftSeenAt ?? null } : {}),
        }
        setUser(nextUser)
        if (data.name !== undefined) {
          setProfileNames(prev => ({ ...prev, [user.id]: data.name || "" }))
        }
      }
      const hasProfileChange = data.name !== undefined || data.phone !== undefined || data.cedula !== undefined
      if (hasProfileChange) addToast("Perfil actualizado", "success")
    } catch (error) {
      console.error(error)
      addToast("Error al actualizar perfil", "error")
    }
  }, [authToken, addToast, user])

  const handleUpdateLoyaltyRules = useCallback(async (nextRules: LoyaltyRulesResponse) => {
    if (!authToken) {
      addToast("Debes iniciar sesion", "error")
      throw new Error("Sin sesion")
    }
    if (!isAdmin) {
      addToast("No tienes permisos", "error")
      throw new Error("Sin permisos")
    }
    try {
      const saved = await updateLoyaltyRules(nextRules, authToken)
      const merged = mergeRules(saved)
      setLoyaltyRules(merged)
      addToast("Premios actualizados", "success")
      return merged
    } catch (error: any) {
      const message = error?.message || "Error al guardar premios"
      addToast(message, "error")
      throw error
    }
  }, [authToken, addToast, isAdmin])

  useEffect(() => {
    if (!authToken) return
    refreshTickets()
    const interval = setInterval(refreshTickets, 15000)
    return () => clearInterval(interval)
  }, [authToken, refreshTickets])

  useEffect(() => {
    if (!authToken || !isBackoffice) return
    let cancelled = false
    const loadSales = async () => {
      try {
        const data = await fetchSalesEvents(authToken, { limit: FINANCE_RECORD_LIMIT })
        if (cancelled) return
        const normalized = data.map((item, idx) => normalizeSalesEventRecord(item, idx))
        setSalesEvents(normalized)
      } catch (err) {
        console.error("Error al cargar ventas", err)
      }
    }
    loadSales()
    const interval = setInterval(loadSales, 45000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [authToken, isBackoffice])

  useEffect(() => {
    if (!authToken || !isBackoffice) return
    let cancelled = false
    const loadProducts = async () => {
      try {
        const data = await fetchProducts(authToken)
        if (cancelled) return
        setCatalog(normalizeCatalogPrices(data))
      } catch (err) {
        console.error("Error al cargar productos", err)
      }
    }
    loadProducts()
    const interval = setInterval(loadProducts, 60000) // Poll every 60s
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [authToken, isBackoffice])

  useEffect(() => {
    if (!authToken || !isBackoffice) return
    if (typeof window === "undefined") return
    const parseLegacy = (raw: string | null) => {
      if (!raw) return []
      try {
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    }
    const legacyManual: ScannedProduct[] = parseLegacy(localStorage.getItem(MANUAL_SALES_KEY))
    const legacyQr: ScannedProduct[] = parseLegacy(localStorage.getItem(QR_SALES_LOG_KEY))
    const legacyCombined = [...legacyManual, ...legacyQr]
    if (!legacyCombined.length) return

    const items = legacyCombined.map((record) => ({
      code: record.code,
      codes: record.codes,
      name: record.name,
      price: record.price,
      points: record.points,
      productId: record.productId,
      quantity: record.quantity ?? 1,
      scannedAt: record.scannedAt,
    }))
    const occurredAt = items[0]?.scannedAt

    logSaleEvents(
      {
        items: items.map(({ scannedAt, ...rest }) => rest),
        source: "legacy",
        occurredAt,
      },
      authToken,
    )
      .then((saved) => mergeSalesEvents(saved.map((evt, idx) => normalizeSalesEventRecord(evt, idx))))
      .catch((err) => console.error("No se pudieron migrar ventas locales", err))
      .finally(() => {
        localStorage.removeItem(MANUAL_SALES_KEY)
        localStorage.removeItem(QR_SALES_LOG_KEY)
      })
  }, [authToken, isBackoffice, mergeSalesEvents])

  useEffect(() => {
    const mapped = salesEvents.map((evt) => ({
      code: evt.code || evt.key,
      codes: evt.codes,
      name: evt.name,
      price: evt.price,
      points: evt.points ?? 0,
      quantity: evt.quantity,
      scannedAt: evt.scannedAt || evt.occurredAt || new Date().toISOString(),
      productId: evt.productId,
      origin: (evt.source === "qr" ? "scan" : "sale") as ScannedProduct["origin"],
      status: "confirmed" as const,
    }))
    setManualSales(mapped.slice(0, 500))
  }, [salesEvents])

  useEffect(() => {
    const normalizedEmail = normalizeEmail(user?.email ?? null)
    if (!normalizedEmail || !me) return
    const entries = pendingSales[normalizedEmail] ?? []
    if (!entries.length) return

    const appliedPoints = entries.reduce(
      (acc, entry) => acc + Number(entry.points ?? 0) * (entry.quantity ?? 1),
      0,
    )
    const confirmedFromPending: ScannedProduct[] = entries.map((entry, idx) => ({
      code: entry.code,
      codes: entry.codes,
      name: entry.name,
      price: entry.price,
      points: entry.points,
      quantity: entry.quantity,
      scannedAt: entry.createdAt || new Date(Date.now() + idx).toISOString(),
      productId: entry.productId,
      status: "confirmed",
    }))

    setScanHistory((prev) => {
      const incoming = new Set(confirmedFromPending.map((item) => normalizeCodeId(item.code)))
      const filteredPrev = prev.filter((item) => !incoming.has(normalizeCodeId(item.code)))
      return [...confirmedFromPending, ...filteredPrev].slice(0, HISTORY_LIMIT)
    })
    setMe((prev) => {
      if (!prev) return prev
      const nextTotal = (prev.totalPoints ?? 0) + appliedPoints
      return enrichStateWithLevel({ ...prev, totalPoints: nextTotal }, prev)
    })
    setPendingSales((prev) => {
      const next = { ...prev }
      delete next[normalizedEmail]
      return next
    })
    setDismissedPendingNotice((prev) => ({ ...prev, [normalizedEmail]: true }))
    if (appliedPoints > 0) {
      addToast(`Se acreditaron ${formatPoints(appliedPoints)} a tu cuenta`, "success")
    }
  }, [addToast, enrichStateWithLevel, formatPoints, me, pendingSales, user?.email])

  const isCodeInvalidated = useCallback(
    (rawCode: string | null | undefined) => {
      if (!rawCode) return false
      const normalized = normalizeCodeId(rawCode)
      return invalidatedCodes.some((code) => code === normalized)
    },
    [invalidatedCodes],
  )

  const extractClaimCode = useCallback((rawCode: string | null | undefined) => {
    const value = rawCode?.trim()
    if (!value) return null
    const withoutPrefix = value.toLowerCase().startsWith("claim:")
      ? value.split(":").slice(1).join(":").trim()
      : value
    try {
      const maybeUrl = new URL(withoutPrefix)
      const param = maybeUrl.searchParams.get("code") || maybeUrl.searchParams.get("claim") || maybeUrl.searchParams.get("id")
      if (param) return param
    } catch { /* not a URL */ }
    const fallbackMatch = withoutPrefix.match(/(?:code|claim|id)=([^&]+)/i)
    if (fallbackMatch?.[1]) return fallbackMatch[1]
    return withoutPrefix
  }, [])

  const extractCouponId = useCallback(
    (rawCode: string | null | undefined, opts: { allowFallback?: boolean } = {}) => {
      const { allowFallback = false } = opts
      const value = rawCode?.trim()
      if (!value) return null

      const lower = value.toLowerCase()
      if (lower.startsWith("coupon:") || lower.startsWith("cupon:")) {
        return value.split(":").slice(1).join(":").trim()
      }

      try {
        const maybeUrl = new URL(value)
        const param = maybeUrl.searchParams.get("couponId") || maybeUrl.searchParams.get("coupon")
        if (param) return param

        // If the path hints it's a coupon URL, allow an id param
        if (maybeUrl.pathname.toLowerCase().includes("coupon")) {
          const idParam = maybeUrl.searchParams.get("id")
          if (idParam) return idParam
        }
      } catch {
        /* not a URL */
      }

      // Only return a plain fallback when explicitly requested (e.g., admin typing a code)
      return allowFallback ? value : null
    },
    [],
  )

  const stageScannedProduct = useCallback(
    (rawCode: string, source: "scan" | "manual" = "scan") => {
      const couponDetected = extractCouponId(rawCode, { allowFallback: false })
      if (couponDetected) {
        const invalid: ScannedProduct = {
          code: couponDetected,
          name: "QR de cupón",
          price: 0,
          points: 0,
          scannedAt: new Date().toISOString(),
          origin: "scan",
          status: "invalid",
        }
        setClaimForm((prev) => ({ ...prev, status: "Este QR es un cupón, se valida en caja" }))
        setScannedProduct(invalid)
        setClaimScanner((prev) => ({ ...prev, active: true }))
        setPendingCode(null)
        if (typeof window !== "undefined") localStorage.removeItem("pending-claim")
        addToast("Detectamos un cupón, muéstralo en caja para canjearlo.", "info")
        return
      }

      const normalizedCode = extractClaimCode(rawCode)
      if (!normalizedCode) {
        const invalid: ScannedProduct = {
          code: rawCode?.trim() || "invalid",
          name: "QR inválido",
          price: 0,
          points: 0,
          scannedAt: new Date().toISOString(),
          origin: "scan",
          status: "invalid",
        }
        setClaimForm((prev) => ({ ...prev, status: "Codigo no valido" }))
        setScannedProduct(invalid)
        setClaimScanner((prev) => ({ ...prev, active: true }))
        setPendingCode(null)
        if (typeof window !== "undefined") localStorage.removeItem("pending-claim")
        addToast("Codigo no valido", "error")
        return
      }

      // Check if ALREADY SCANNED by this user
      const existingHistory = scanHistory.find((h) => normalizeCodeId(h.code) === normalizeCodeId(normalizedCode))
      const alreadyInvalid = isCodeInvalidated(normalizedCode) || Boolean(existingHistory)
      if (alreadyInvalid) {
        const invalidScan: ScannedProduct = existingHistory
          ? { ...existingHistory, status: "used", origin: existingHistory.origin ?? "scan" }
          : {
            code: normalizedCode,
            name: "QR usado",
            price: 0,
            points: 0,
            scannedAt: new Date().toISOString(),
            origin: "scan",
            status: "used",
          }
        const usedAt = invalidScan.scannedAt || new Date().toISOString()
        registerInvalidatedCode(normalizedCode, usedAt)
        setPendingCode(null)
        if (typeof window !== "undefined") localStorage.removeItem("pending-claim")
        setScannedProduct(invalidScan)
        setClaimForm((prev) => ({ ...prev, status: "Este QR ya no es válido" }))
        setClaimScanner((prev) => ({ ...prev, active: true }))
        addToast("Este QR ya no es válido, ya fue usado.", "error")
        return
      }

      const product = resolveProductFromScan(normalizedCode, rawCode, rules.pointsPerProduct, catalog, qrRegistry)

      setPendingCode(product.code)
      setClaimForm((prev) => ({
        ...prev,
        code: source === "manual" ? "" : prev.code,
        status: source === "manual" ? "Producto listo para confirmar" : "Codigo detectado, confirma para sumar",
      }))
      setScannedProduct(product)
      setClaimScanner(prev => ({ ...prev, active: true })) // Force open UI

      if (typeof window !== "undefined") {
        localStorage.setItem("pending-claim", product.code)
      }
    },
    [addToast, catalog, extractClaimCode, extractCouponId, isCodeInvalidated, qrRegistry, registerInvalidatedCode, rules.pointsPerProduct, scanHistory],
  )

  const addConfirmedToHistory = useCallback(
    (code: string) => {
      const base = scannedProduct && scannedProduct.code === code
        ? scannedProduct
        : resolveProductFromScan(code, code, rules.pointsPerProduct, catalog, qrRegistry)
      if (!base) return
      const usedAt = new Date().toISOString()
      const confirmed: ScannedProduct = { ...base, status: "confirmed", scannedAt: usedAt, origin: base.origin ?? "scan" }
      registerInvalidatedCode(code, usedAt)
      setScanHistory((prev) => {
        const normalized = normalizeCodeId(code)
        const filtered = prev.filter((item) => normalizeCodeId(item.code) !== normalized)
        return [confirmed, ...filtered].slice(0, HISTORY_LIMIT)
      })
      setQrSalesLedger((prev) => {
        const filtered = prev.filter((item) => normalizeCodeId(item.code) !== normalizeCodeId(code))
        return [confirmed, ...filtered].slice(0, 500)
      })
      mergeSalesEvents([
        normalizeSalesEventRecord({
          key: confirmed.code,
          code: confirmed.code,
          codes: confirmed.codes,
          name: confirmed.name,
          price: confirmed.price,
          points: confirmed.points,
          quantity: confirmed.quantity,
          scannedAt: confirmed.scannedAt,
          productId: confirmed.productId,
          source: "qr",
          currency: "USD",
        }),
      ])
      if (authToken && isBackoffice) {
        logSaleEvents(
          {
            items: [
              {
                code,
                codes: confirmed.codes,
                name: confirmed.name,
                price: confirmed.price,
                points: confirmed.points ?? 0,
                productId: confirmed.productId,
                quantity: confirmed.quantity ?? 1,
              },
            ],
            source: "qr",
            occurredAt: confirmed.scannedAt,
          },
          authToken,
        )
          .then((saved) => mergeSalesEvents(saved.map((evt, idx) => normalizeSalesEventRecord(evt, idx))))
          .catch((err) => console.error("No se pudo registrar la venta del QR", err))
      }
      setScannedProduct((prev) => (prev && prev.code === code ? { ...prev, status: "confirmed" } : prev))
      resolvePendingSaleForUser(user?.email ?? null, code)
    },
    [authToken, isBackoffice, mergeSalesEvents, registerInvalidatedCode, resolvePendingSaleForUser, rules.pointsPerProduct, scannedProduct, catalog, qrRegistry, user?.email],
  )

  // LOGIC HANDLERS
  const handleClaimScan = useCallback((raw: string) => stageScannedProduct(raw), [stageScannedProduct])

  const handleInspectCoupon = useCallback(
    async (raw?: string) => {
      if (!authToken) {
        setAdminCouponLookup((prev) => ({ ...prev, status: "Necesitas iniciar sesión como admin/seller" }))
        return
      }
      const target = extractCouponId(raw ?? adminCouponLookup.code, { allowFallback: true })
      if (!target) {
        setAdminCouponLookup((prev) => ({ ...prev, status: "Código de cupón vacío" }))
        return
      }
      setAdminCouponLookup((prev) => ({ ...prev, status: "Consultando cupón..." }))
      try {
        const data = await inspectCoupon(target, authToken)
        setInspectedCoupon(data)
        setAdminCouponLookup((prev) => ({ ...prev, status: "Cupón encontrado" }))
        // Force scanner open to show result if not already
        setCouponScanner(prev => ({ ...prev, active: true }))
      } catch (e: any) {
        const msg = e.message || "No se pudo revisar el cupón"
        setAdminCouponLookup((prev) => ({ ...prev, status: msg }))
        setInspectedCoupon(null)
        addToast(msg, "error")
      }
    },
    [addToast, adminCouponLookup.code, authToken, extractCouponId],
  )

  const handleCouponScan = useCallback(
    (raw: string) => {
      const couponId = extractCouponId(raw, { allowFallback: true })
      if (!couponId) {
        setCouponScanner((prev) => ({ ...prev, status: "QR de cupón no válido" }))
        addToast("QR de cupón no válido", "error")
        return
      }
      handleInspectCoupon(couponId)
    },
    [addToast, extractCouponId, handleInspectCoupon],
  )

  const handleRedeemCoupon = useCallback(async () => {
    if (!authToken || !inspectedCoupon) {
      addToast("Escanea un cupón válido primero", "error")
      return
    }
    if (!isAdmin && !isSeller) {
      addToast("Necesitas permisos para canjear", "error")
      return
    }
    setRedeemingCoupon(true)
    setAdminCouponLookup((prev) => ({ ...prev, status: "Canjeando cupón..." }))
    try {
      const result = await redeemCoupon(inspectedCoupon.coupon.id, authToken)
      if (result?.ok === false) {
        const statusText = result.message || "No se pudo canjear cupón"
        setAdminCouponLookup((prev) => ({ ...prev, status: statusText }))
        setInspectedCoupon((prev) =>
          prev
            ? {
              ...prev,
              coupon: {
                ...prev.coupon,
                status: (result.status as CouponDto["status"]) || prev.coupon.status,
              },
            }
            : prev,
        )
        addToast(statusText, "error")
        return
      }

      const now = new Date().toISOString()
      setInspectedCoupon((prev) =>
        prev
          ? {
            ...prev,
            coupon: {
              ...prev.coupon,
              status: "used",
              usedAt: now,
              verifiedBy: user ? { id: user.id, email: user.email } : prev.coupon.verifiedBy ?? null,
            },
          }
          : prev,
      )
      setAdminCouponLookup((prev) => ({ ...prev, status: "Cupón canjeado" }))
      addToast("Cupón canjeado", "success")
    } catch (e: any) {
      const msg = e?.message || "No se pudo canjear cupón"
      setAdminCouponLookup((prev) => ({ ...prev, status: msg }))
      addToast(msg, "error")
    } finally {
      setRedeemingCoupon(false)
    }
  }, [addToast, authToken, inspectedCoupon, isAdmin, isSeller, user])

  const inspectCouponForSale = useCallback(
    async (
      raw: string,
    ): Promise<{ coupon: CouponInspectResponse | null; isCoupon: boolean; error?: string }> => {
      // 1. Extract potential ID
      const couponId = extractCouponId(raw, { allowFallback: true })

      // If no ID structure found at all, it's definitely not a coupon
      if (!couponId) return { coupon: null, isCoupon: false as const }

      // 2. Check permissions
      if (!authToken || (!isAdmin && !isSeller)) {
        // If it LOOKS like a coupon but we have no perms, treat as error
        const message = "Necesitas permisos para validar cupones"
        addToast(message, "error")
        return { coupon: null, isCoupon: true as const, error: message }
      }

      try {
        // 3. Try to fetch
        const data = await inspectCoupon(couponId, authToken)
        return { coupon: data, isCoupon: true as const }
      } catch (e: any) {
        const msg = (e?.message || "").toLowerCase()
        // 4. Handle specific "Not Found" cases to allow fallback
        // If the backend says "Coupon not found" or "Invalid format", 
        // it might just be a product code that coincidentally looked like a coupon ID or was passed to this checker.
        // However, if we extracted a couponId, we are fairly confident it WAS intended as a coupon check.
        // But if `extractCouponId` is loose (allowFallback: true), it might pick up "p1-123".

        // If it was a deliberate "coupon:..." format, we should probably report error.
        // If it was just a raw string, might be product.

        const isExplicitCouponFormat = raw.toLowerCase().startsWith("coupon:") || raw.toLowerCase().startsWith("cupon:") || raw.includes("couponId=")

        if (!isExplicitCouponFormat) {
          // It was a loose match. If it failed, assume it wasn't a coupon.
          return { coupon: null, isCoupon: false as const }
        }

        // If it WAS explicit format, then it really is an invalid coupon
        addToast(msg || "Cupón no válido", "error")
        return { coupon: null, isCoupon: true as const, error: msg || "Cupón no válido" }
      }
    },
    [addToast, authToken, extractCouponId, isAdmin, isSeller],
  )

  const redeemCouponForSale = useCallback(
    async (couponId: string): Promise<{ ok: boolean; message?: string }> => {
      if (!authToken || (!isAdmin && !isSeller)) {
        const message = "Necesitas permisos para canjear"
        addToast(message, "error")
        return { ok: false, message }
      }
      try {
        const result = await redeemCoupon(couponId, authToken)
        if ((result as any)?.ok === false) {
          const msg = (result as any).message || "No se pudo canjear cupнn"
          addToast(msg, "error")
          return { ok: false, message: msg }
        }
        return { ok: true }
      } catch (e: any) {
        const msg = e?.message || "No se pudo canjear cupнn"
        addToast(msg, "error")
        return { ok: false, message: msg }
      }
    },
    [addToast, authToken, isAdmin, isSeller],
  )

  const handleClaimWithCode = async (code: string, token: string) => {
    const normalizedCode = extractClaimCode(code)
    if (!normalizedCode) return
    setLoadingAction(true)
    try {
      const previousLevelId = (me?.levelState ?? levelState)?.currentLevel?.id ?? null
      const claimResult = await claimCode(normalizedCode, token)
      setClaimForm({ code: "", status: "Codigo reclamado." })
      setPendingCode(null)
      localStorage.removeItem("pending-claim")
      addConfirmedToHistory(normalizedCode)
      const registryMatch = qrRegistry.find((qr) => qr.id.toLowerCase() === normalizedCode.toLowerCase())
      const scannedSnapshot =
        scannedProduct && normalizeCodeId(scannedProduct.code) === normalizedCode ? scannedProduct : null
      const prefixMatch = normalizedCode.match(/^p(\d+)-/)
      const prefixIndex = prefixMatch ? Number(prefixMatch[1]) : null
      setCatalog((prev) => {
        const idxFromRegistryId = registryMatch?.productId ? prev.findIndex((p) => p.id === registryMatch.productId) : -1
        const idxFromScannedId = scannedSnapshot?.productId ? prev.findIndex((p) => p.id === scannedSnapshot.productId) : -1
        const idxFromScannedIndex =
          typeof scannedSnapshot?.productIndex === "number" &&
            scannedSnapshot.productIndex >= 0 &&
            scannedSnapshot.productIndex < prev.length
            ? scannedSnapshot.productIndex
            : -1
        const idxFromRegistryName = registryMatch?.productName
          ? prev.findIndex((p) => p.name.toLowerCase() === registryMatch.productName.toLowerCase())
          : -1
        const idxFromScannedName = scannedSnapshot?.name
          ? prev.findIndex((p) => p.name.toLowerCase() === scannedSnapshot.name.toLowerCase())
          : -1
        const idxFromPrefix =
          typeof prefixIndex === "number" && prefixIndex >= 0 && prefixIndex < prev.length ? prefixIndex : -1
        const resolvedIndex =
          [idxFromRegistryId, idxFromScannedId, idxFromScannedIndex, idxFromRegistryName, idxFromScannedName, idxFromPrefix].find(
            (v) => v !== -1,
          ) ?? -1
        if (resolvedIndex < 0) return prev
        return prev.map((p, i) =>
          i === resolvedIndex ? { ...p, stock: Math.max(0, (p.stock ?? 0) - 1) } : p,
        )
      })
      const data = await fetchMe(token)
      setMe((prev) => {
        const nextState = enrichStateWithLevel(data, prev)
        const newLevelId = nextState.levelState?.currentLevel?.id ?? null
        const leveledUp = previousLevelId && newLevelId && newLevelId !== previousLevelId
        const issuedCoupons: CouponDto[] = Array.isArray((claimResult as any)?.levelCouponsIssued)
          ? (claimResult as any).levelCouponsIssued
          : []
        const unlockedRewards: CouponDto[] = Array.isArray((claimResult as any)?.rewardsUnlocked)
          ? (claimResult as any).rewardsUnlocked
          : (claimResult as any)?.rewardUnlocked
            ? [(claimResult as any).rewardUnlocked]
            : []
        const selfIssuedIds: string[] = []
        unlockedRewards.forEach((reward) => {
          if (reward?.id) selfIssuedIds.push(reward.id)
        })
        if (issuedCoupons.length) issuedCoupons.forEach((c) => selfIssuedIds.push(c.id))
        if (selfIssuedIds.length) {
          const next = new Set(selfIssuedCouponIdsRef.current)
          selfIssuedIds.forEach((id) => next.add(id))
          selfIssuedCouponIdsRef.current = next
        }
        if (leveledUp) {
          addToast(`Subiste a ${nextState.levelState.currentLevel.name} 🎉`, "success")
        }
        if (issuedCoupons.length) {
          addToast(`Cupón exclusivo emitido(${issuedCoupons.length})`, "success")
          setLevelGrant({ levelName: nextState.levelState?.currentLevel?.name ?? "Nuevo nivel", coupons: issuedCoupons })
        }
        return nextState
      })
      addToast("¡Puntos sumados con éxito!", "success")
      setTimeout(() => {
        setClaimScanner(prev => ({ ...prev, active: false }))
        setScannedProduct(null)
      }, 1500)
    } catch (e: any) {
      const msg = e.message || "Error al reclamar"
      const lower = msg.toLowerCase()
      const isUsed = /(usad|utiliza|redeem|already|ya fue|ya se)/.test(lower)
      const isInvalid = /(invalid|invalido|no existe|not found|expirad|vencid)/.test(lower)
      setClaimForm((prev) => ({ ...prev, status: isUsed ? "Este QR ya fue usado" : msg }))
      if (isUsed || isInvalid) {
        const errorUsedAt = isUsed ? scannedProduct?.scannedAt || new Date().toISOString() : undefined
        registerInvalidatedCode(normalizedCode, errorUsedAt)
        setPendingCode(null)
        localStorage.removeItem("pending-claim")
        setScannedProduct((prev) =>
          prev ? { ...prev, status: isUsed ? "used" : "invalid" } : prev,
        )
        setClaimScanner((prev) => ({ ...prev, active: true }))
      }
      addToast(isUsed ? "Este QR ya fue usado" : isInvalid ? "QR inválido" : msg, "error")
    } finally {
      setLoadingAction(false)
    }
  }

  const resolveDisplayName = useCallback(
    (resUser: AuthUser, mode: "login" | "register") => {
      const trimmedName = form.name.trim()
      const localProfileName = typeof window !== "undefined"
        ? localStorage.getItem(`profile_name:${resUser.id}`)
        : null
      const storedName = (localProfileName?.trim() || "") || profileNames[resUser.id]
      const fallbackName = (resUser as any)?.name || resUser.email?.split("@")[0] || "Cliente"
      const resolved = mode === "register"
        ? trimmedName || storedName || fallbackName
        : storedName || fallbackName

      setProfileNames((prev) => {
        if (prev[resUser.id] === resolved) return prev
        return { ...prev, [resUser.id]: resolved }
      })

      return resolved
    },
    [form.name, profileNames],
  )

  const prettifyAuthError = useCallback((error: unknown) => {
    const fallback = "No pudimos validar tus credenciales. Intenta de nuevo."
    const pickMessage = (value: any): string | null => {
      if (!value) return null
      if (typeof value === "string") return value
      if (typeof value === "object") {
        if (typeof value.message === "string") return value.message
        if (typeof (value as any).error === "string") return (value as any).error
      }
      return null
    }

    const sanitize = (text: string) => {
      let cleaned = text
      try {
        const parsed = JSON.parse(text)
        const nested = pickMessage(parsed)
        if (nested) cleaned = nested
      } catch {
        // ignore parse issues
      }
      cleaned = cleaned.replace(/^\[object Object\]$/, "").replace(/[{}"]/g, " ").replace(/\s+/g, " ").trim()
      if (!cleaned) return fallback
      const lower = cleaned.toLowerCase()
      if (lower.includes("existe")) return "El usuario ya existe. Inicia sesion o usa otro correo."
      if (lower.includes("invalid") || lower.includes("contras") || lower.includes("credenciales") || lower.includes("bad request")) {
        return "Credenciales invalidas. Revisa tu correo y contrasena."
      }
      return cleaned
    }

    const base = pickMessage(error)
    return sanitize(base ?? fallback)
  }, [])

  const handleAuth = async (modeOverride?: "login" | "register") => {
    setAuthError(null)
    setLoadingAction(true)
    setUserStateLoading(true)
    try {
      const effectiveMode = modeOverride ?? form.mode
      const normalizedEmail = form.email.trim().toLowerCase()
      setForm((prev) => ({ ...prev, mode: effectiveMode, email: normalizedEmail }))
      if (!normalizedEmail || !normalizedEmail.includes("@")) {
        setAuthError("Ingresa un email válido.")
        setLoadingAction(false)
        setUserStateLoading(false)
        return
      }
      const normalizedCedula = effectiveMode === "register" ? normalizeCedula(form.cedula) : null
      if (effectiveMode === "register" && !normalizedCedula) {
        setAuthError("Ingresa una cédula válida (solo números).")
        setLoadingAction(false)
        setUserStateLoading(false)
        return
      }
      if (effectiveMode === "register" && form.password !== form.confirmPassword) {
        setAuthError("Las contraseñas no coinciden.")
        setLoadingAction(false)
        setUserStateLoading(false)
        return
      }

      const passwordRules = [
        { test: (p: string) => p.length >= 6, label: "Mínimo 6 caracteres" },
        { test: (p: string) => /\d/.test(p), label: "Al menos 1 número" },
      ]

      if (effectiveMode === "register") {
        const unmet = passwordRules.filter(r => !r.test(form.password))
        if (unmet.length > 0) {
          setAuthError("La contraseña no cumple con los requisitos.")
          setShowPasswordRequirements(true)
          setLoadingAction(false)
          setUserStateLoading(false)
          return
        }
      }
      const nameToRegister = form.name.trim()
      const res = effectiveMode === "login"
        ? await login(normalizedEmail, form.password)
        : await register(
          normalizedEmail,
          form.password,
          normalizedCedula as string,
          nameToRegister ? nameToRegister : undefined,
        )
      const localProfileName = effectiveMode === "login" && typeof window !== "undefined"
        ? localStorage.getItem(`profile_name:${res.user.id}`)
        : null
      const syncProfileName = localProfileName?.trim() || ""
      if (effectiveMode === "login" && !res.user.name && syncProfileName) {
        updateProfile({ name: syncProfileName }, res.token).catch((err) => {
          console.error("Profile name sync failed", err)
        })
      }
      const resolvedName = resolveDisplayName(
        syncProfileName && !res.user.name ? { ...res.user, name: syncProfileName } : res.user,
        effectiveMode,
      )
      const userWithName = { ...res.user, name: resolvedName } as AuthUser

      setAuthToken(res.token)
      setUser(userWithName)

      localStorage.setItem("loyalty-auth", JSON.stringify({
        token: res.token,
        user: userWithName,
      }))

      // Clear pending sales if registering to avoid stale data from deleted accounts
      if (effectiveMode === "register") {
        setPendingSales((prev) => {
          const next = { ...prev }
          const key = normalizedEmail
          if (next[key]) delete next[key]
          localStorage.setItem(PENDING_SALES_KEY, JSON.stringify(next))
          return next
        })
      }

      setForm((prev) => ({
        ...prev,
        password: "",
        confirmPassword: "",
        ...(effectiveMode === "register" ? { name: "", cedula: "" } : {}),
      }))
      const data = await fetchMe(res.token)
      setMe((prev) => enrichStateWithLevel(data, prev))
      if (pendingCode) await handleClaimWithCode(pendingCode, res.token)
    } catch (e: any) {
      setAuthError(prettifyAuthError(e))
    } finally {
      setLoadingAction(false)
      setUserStateLoading(false)
    }
  }


  const handleLogout = (force = false) => {
    if (Object.keys(stockUpdates).length > 0) {
      if (!force && !window.confirm("Tienes cambios de stock sin guardar. ¿Deseas descartarlos y salir?")) {
        return
      }
      setStockUpdates({})
    }
    setAuthToken(null)
    setUser(null)
    setMe(null)
    setGiftingCouponId(null)
    setRegisteredUsers(0)
    setCouponStats({ total: 0, available: 0, used: 0, expired: 0 })
    setScanHistory([])
    setCouponActivity([])
    setClaimForm({ code: "", status: "" })
    localStorage.removeItem("loyalty-auth")
    setClaimScanner({ active: false, status: "", last: "" })
    setCouponScanner({ active: false, status: "", last: "" })
    localStorage.removeItem("pending-claim")
    setPendingCode(null)
    setScannedProduct(null)
    setPaymentTickets([])
    previousCouponsRef.current = []
    selfIssuedCouponIdsRef.current = new Set()
    clearCheckoutCustomer()
    // [NEW] Reset caja state on logout
    setCajaState({
      cartItems: [],
      appliedCoupon: null,
      isRegisteredUser: true,
    })
  }

  useEffect(() => {
    if (!authToken) {
      unauthorizedHandledRef.current = false
      setUnauthorizedHandler(null)
      return
    }

    setUnauthorizedHandler(() => {
      if (unauthorizedHandledRef.current) return
      unauthorizedHandledRef.current = true
      addToast("Tu sesion expiro. Inicia de nuevo.", "info")
      handleLogout(true)
    })

    return () => {
      setUnauthorizedHandler(null)
      unauthorizedHandledRef.current = false
    }
  }, [authToken, addToast, handleLogout])

  const handleGenerate = async () => {
    if (!authToken || user?.role !== "admin") return
    if (!catalog.length) {
      addToast("Registra al menos un producto antes de generar QR", "error")
      return
    }
    const product = catalog[selectedProductIdx] ?? catalog[0]
    const existingCodes = new Set(qrRegistry.map((qr) => qr.id.toLowerCase()))
    const prefix = `p${selectedProductIdx} -`
    setLoadingAction(true)
    try {
      const response = await generateClaims(
        adminGen.count,
        authToken,
        true,
        prefix,
        product.points || rules.pointsPerProduct,
        {
          productId: product.id,
          productName: product.name,
          price: product.price,
        },
      )
      // If backend returns sample codes, fallback to local generation to keep IDs consistent with product prefix
      const rawCodes = (response.codes ?? response.sample ?? []).filter(Boolean)
      const codes = rawCodes.length ? rawCodes : Array.from({ length: adminGen.count }, () => `${prefix}${Math.random().toString(36).substring(2, 10)} `)
      const uniqueCodes = Array.from(new Set(codes))

      const zip = new JSZip()
      const folder = zip.folder("claims")
      if (folder) {
        await Promise.all(
          uniqueCodes.map(async (code) => {
            const params = new URLSearchParams({
              code,
              name: product.name,
              points: String(product.points || rules.pointsPerProduct),
              price: String(product.price ?? 0),
            })
            if (product.id) params.set("productId", product.id)
            params.append("pIdx", String(selectedProductIdx))
            const url = `${SITE_URL}/?${params.toString()}`
            const dataUrl = await QRCodeLib.toDataURL(url, { margin: 1, scale: 8 })
            const base64 = dataUrl.split(",")[1]
            folder.file(`${code}.png`, base64, { base64: true })
          }),
        )
        const content = await zip.generateAsync({ type: "blob" })
        saveAs(content, `claims-${product.name.replace(/\s+/g, '_')}.zip`)
      }
      const now = new Date().toISOString()
      const freshCodes = uniqueCodes.filter((code) => !existingCodes.has(code.toLowerCase()))
      setQrRegistry((prev) => {
        const next = [
          ...uniqueCodes.map((code) => ({
            id: code,
            productId: product.id,
            productName: product.name,
            createdAt: now,
            points: product.points || rules.pointsPerProduct,
            price: product.price,
            persisted: true,
          })),
          ...prev,
        ]
        const seen = new Set<string>()
        return next.filter((entry) => {
          const key = entry.id.toLowerCase()
          if (seen.has(key)) return false
          seen.add(key)
          return true
        }).slice(0, 400)
      })
      if (freshCodes.length) {
        setCatalog((prev) => {
          const targetIndex = prev.findIndex((p) => p.id === product.id)
          if (targetIndex === -1) return prev
          return prev.map((p, i) =>
            i === targetIndex ? { ...p, stock: (p.stock ?? 0) + freshCodes.length } : p,
          )
        })
      }
      addToast(`Generados ${uniqueCodes.length} codigos para ${product.name}`, "success")
    } catch (e: any) {
      addToast(e.message || "Error al generar", "error")
    } finally {
      setLoadingAction(false)
    }
  }

  const handleRegisterProduct = async () => {
    if (!newProduct.name.trim() || newProduct.price === "" || newProduct.points === "") {
      addToast("Completa todos los campos", "error")
      return
    }
    const rawPrice = Number(newProduct.price)
    const points = Number(newProduct.points)
    const stock = newProduct.stock ? Number(newProduct.stock) : 0
    if (Number.isNaN(rawPrice) || Number.isNaN(points) || rawPrice < 0 || points < 0 || stock < 0) {
      addToast("Precio o puntos no son válidos", "error")
      return
    }
    const price = roundUsd(rawPrice)
    if (!authToken) {
      addToast("Debes iniciar sesión", "error")
      return
    }
    setLoadingAction(true)
    try {
      const product = await createProduct({
        name: newProduct.name.trim(),
        price,
        points,
        stock: Number.isNaN(stock) ? 0 : stock,
        cost: Number(newProduct.cost) || 0,
        imageUrl: newProduct.imageUrl.trim() || undefined,
        description: newProduct.description.trim() || undefined,
      }, authToken)
      setCatalog((prev) => [...prev, normalizeProductPrice(product)])
      setSelectedProductIdx((prev) => prev || 0)
      setNewProduct({ name: "", price: "", points: "", stock: "", cost: "", imageUrl: "", description: "" })
      addToast("Producto registrado", "success")
    } catch (e: any) {
      addToast(e.message || "Error al crear producto", "error")
    } finally {
      setLoadingAction(false)
    }
  }

  const handleSaveProductEdit = async () => {
    if (!editingProduct) return
    const { index, draft } = editingProduct
    const original = catalog[index]
    if (!original?.id) {
      addToast("Producto inválido (sin ID)", "error")
      return
    }
    const rawPrice = Number(draft.price)
    const points = Number(draft.points)
    const stock = draft.stock ? Number(draft.stock) : 0
    if (!draft.name.trim() || Number.isNaN(rawPrice) || Number.isNaN(points) || rawPrice < 0 || points < 0 || stock < 0) {
      addToast("Revisa nombre, precio y puntos", "error")
      return
    }
    const price = roundUsd(rawPrice)
    if (!authToken) return

    setLoadingAction(true)
    try {
      const updated = await updateProduct(original.id, {
        name: draft.name.trim(),
        price,
        points,
        stock: Number.isNaN(stock) ? 0 : stock,
        cost: Number(draft.cost) || 0,
        imageUrl: draft.imageUrl.trim() || undefined,
        description: draft.description.trim() || undefined,
      }, authToken)
      setCatalog((prev) =>
        prev.map((p) => p.id === original.id ? normalizeProductPrice(updated) : p)
      )
      const originalPrice = Number(original.price ?? NaN)
      const priceChanged = Number.isFinite(originalPrice) && originalPrice !== price
      if (priceChanged) {
        const originalName = original.name?.trim().toLowerCase()
        setQrRegistry((prev) => {
          let changed = false
          const next = prev.map((qr) => {
            if (qr.usedAt) return qr
            const matchesId = qr.productId && qr.productId === original.id
            const matchesName = !qr.productId && originalName && qr.productName.toLowerCase() === originalName
            if (!matchesId && !matchesName) return qr
            if (qr.price === price) return qr
            changed = true
            return { ...qr, price }
          })
          return changed ? next : prev
        })
      }
      setEditingProduct(null)
      addToast("Producto actualizado", "success")

      // --- RECETARIO SYNC ---
      if (priceChanged && original.id) {
        try {
          // Fetch linked recipes
          const recipesRes = await fetch(`${API_URL}/recetario/recipes`, {
            headers: { Authorization: `Bearer ${authToken}` }
          })
          if (recipesRes.ok) {
            const recipes: Recipe[] = await recipesRes.json()
            const linkedRecipes = recipes.filter(r => r.linkedProductId === original.id)

            for (const recipe of linkedRecipes) {
              const { totalCost } = calculateRecipeCosts(recipe)
              const newMargin = calculateMarginFromPrice(totalCost, price)

              // Update recipe margin on backend
              const updatePayload = {
                ...recipe,
                profitMargin: newMargin,
                // Ensure history is updated as well if possible, or let the backend handle it
                history: [
                  ...(recipe.history || []),
                  {
                    date: new Date().toISOString(),
                    cost: totalCost,
                    price: price,
                    margin: newMargin
                  }
                ]
              }

              await fetch(`${API_URL}/recetario/recipes/${recipe.id}`, {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${authToken}`
                },
                body: JSON.stringify(updatePayload)
              })
            }
          }
        } catch (syncErr) {
          console.error("Failed to sync recipes price", syncErr)
          // We don't toast error here to not confuse the user who just saved a product successfully
        }
      }
    } catch (e: any) {
      addToast(e.message || "Error al actualizar", "error")
    } finally {
      setLoadingAction(false)
    }
  }

  const handleToggleProductActive = useCallback(async (id: string, active: boolean) => {
    if (!authToken) return
    setLoadingAction(true)
    try {
      const updated = await updateProduct(id, { active }, authToken)
      setCatalog(prev => prev.map(p => p.id === id ? normalizeProductPrice(updated) : p))
      addToast(active ? "Producto visible en el menu" : "Producto oculto del menu", "success")
    } catch (e: any) {
      addToast(e.message || "Error al actualizar visibilidad", "error")
    } finally {
      setLoadingAction(false)
    }
  }, [authToken, addToast])

  const handleDeleteProduct = useCallback(async (id: string) => {
    if (!confirm("¿Ocultar este producto del menu? Se conservara su historial.")) return
    await handleToggleProductActive(id, false)
  }, [handleToggleProductActive])

  const handleRestoreProduct = useCallback(async (id: string) => {
    await handleToggleProductActive(id, true)
  }, [handleToggleProductActive])

  const handleAdjustStock = useCallback(async (id: string, delta: number) => {
    if (!authToken) return
    try {
      const updated = await adjustProductStock(id, delta, authToken)
      setCatalog(prev => prev.map(p => p.id === id ? normalizeProductPrice(updated) : p))
      addToast("Stock actualizado", "success")
    } catch (e: any) {
      addToast(e.message || "Error ajustando stock", "error")
    }
  }, [authToken, addToast])

  // --- STOCK SAVE FEATURE ---
  const [stockUpdates, setStockUpdates] = useState<Record<string, number>>({})

  const handleQueueStockUpdate = useCallback((id: string, delta: number) => {
    setStockUpdates(prev => {
      const current = prev[id] || 0
      const next = current + delta
      if (next === 0) {
        const { [id]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [id]: next }
    })
  }, [])

  const handleSaveStockUpdates = useCallback(async () => {
    if (!authToken) return
    const updates = Object.entries(stockUpdates)
    if (!updates.length) return

    setLoadingAction(true)
    try {
      await Promise.all(updates.map(([id, delta]) => adjustProductStock(id, delta, authToken)))

      // Update catalog locally based on applied deltas
      setCatalog(prev => prev.map(p => {
        if (!p.id) return p
        const delta = stockUpdates[p.id]
        if (delta) {
          // Note: The API returns the updated product, but since we do Promise.all and don't easily map results back to IDs without extra work, 
          // we optimistically update or rely on the polling. Optimistic is better for UX.
          // However, we don't have the *fresh* product object here, just the delta.
          return { ...p, stock: Math.max(0, (p.stock ?? 0) + delta) }
        }
        return p
      }))

      setStockUpdates({})
      addToast("Todo el stock guardado", "success")
    } catch (e: any) {
      addToast("Error guardando cambios. Revisa tu conexión.", "error")
      console.error(e)
    } finally {
      setLoadingAction(false)
    }
  }, [authToken, stockUpdates, addToast])

  const handleSetAdminTab = useCallback((tab: any) => {
    if (Object.keys(stockUpdates).length > 0) {
      if (!window.confirm("Tienes cambios de stock sin guardar. ¿Deseas descartarlos y cambiar de pestaña?")) {
        return
      }
      setStockUpdates({})
    }
    setAdminTab(tab)
  }, [stockUpdates])
  // -------------------------

  const handleDeleteQr = useCallback((codeId: string) => {
    setQrRegistry(prev => {
      const filtered = prev.filter(r => r.id !== codeId)
      localStorage.setItem(QR_REGISTRY_KEY, JSON.stringify(filtered))
      return filtered
    })
  }, [])

  const handleDeleteUsedQrs = useCallback(() => {
    setQrRegistry(prev => {
      const filtered = prev.filter(r => !r.usedAt)
      localStorage.setItem(QR_REGISTRY_KEY, JSON.stringify(filtered))
      if (filtered.length < prev.length) addToast("QRs usados eliminados", "success")
      return filtered
    })
  }, [addToast])

  const clearCheckoutCustomer = useCallback(() => {
    setCheckoutCustomer({
      email: "",
      cedula: "",
      userId: null,
      levelState: null,
      coupons: [],
      loading: false,
      error: null,
    })
  }, [])

  const handleLookupCustomer = useCallback(
    async (cedula: string) => {
      const normalizedCedula = normalizeCedula(cedula)
      if (!normalizedCedula) {
        clearCheckoutCustomer()
        return
      }
      if (!authToken) {
        setCheckoutCustomer({
          email: "",
          cedula: normalizedCedula,
          userId: null,
          levelState: null,
          coupons: [],
          loading: false,
          error: "Necesitas iniciar sesión para buscar clientes",
        })
        return
      }
      setCheckoutCustomer((prev) => ({ ...prev, cedula: normalizedCedula, loading: true, error: null }))
      try {
        const state = await lookupUserByCedula(normalizedCedula, authToken)
        const normalized = normalizeUserState(state, rules, null)
        const level = buildLevelState(normalized, levelRules.ladder, levelRules.window)
        setCheckoutCustomer({
          email: state.user?.email ?? "",
          cedula: normalizedCedula,
          userId: state.user?.id ?? null,
          levelState: level,
          coupons: normalized.coupons ?? [],
          loading: false,
          error: null,
        })
      } catch (err: any) {
        setCheckoutCustomer({
          email: "",
          cedula: normalizedCedula,
          userId: null,
          levelState: null,
          coupons: [],
          loading: false,
          error: err?.message || "No se pudo buscar al cliente",
        })
      }
    },
    [authToken, clearCheckoutCustomer, levelRules, rules],
  )

  const handleLookupAdminUser = useCallback(
    async (query: { cedula?: string; email?: string }) => {
      if (!authToken) {
        throw new Error("Necesitas iniciar sesion para buscar usuarios")
      }
      if (!query?.cedula && !query?.email) {
        throw new Error("Debes ingresar una cedula o correo")
      }
      const result = await lookupUser(query, authToken)
      const normalized = normalizeUserState(result, rules, null)
      return { ...normalized, user: result.user } as LookupUserResponse
    },
    [authToken, rules],
  )

  const handleDeleteUser = useCallback(
    async (userId: string) => {
      if (!authToken) {
        throw new Error("Necesitas iniciar sesion para borrar usuarios")
      }
      if (!isAdmin) {
        throw new Error("Solo admin puede borrar usuarios")
      }
      return deleteUser(userId, authToken)
    },
    [authToken, isAdmin],
  )

  type RegisterSaleItem = {
    code?: string
    codes?: string[]
    name: string
    price: number
    points: number
    productId?: string
    quantity?: number
  }

  type RegisterSaleMeta = {
    customerId?: string | null
    customerName?: string | null
    customerPhone?: string | null
    documentType?: string | null
    documentNumber?: string | null
    couponId?: string | null
    subtotal?: number
    total?: number
    discount?: number
    customerCedula?: string | null
    exchangeRate?: number
    paymentMethod?: string
    paymentDetails?: { method: string; amount: number; currency?: string; amountNative?: number; currencyNative?: string; amountUsd?: number; exchangeRate?: number | null }[]
    source?: string
  }

  const handleRegisterSale = useCallback(
    async (
      items: RegisterSaleItem[],
      customerEmail?: string,
      saleMeta?: RegisterSaleMeta,
    ) => {
      const now = Date.now()
      const preparedItems = items.map((item, idx) => {
        const rawCode = item.code?.trim()
        const normalizedCode = rawCode ? normalizeSaleCode(rawCode) ?? rawCode : ""
        const lowerCode = normalizedCode.toLowerCase()
        const isTicket = lowerCode.startsWith("ticket://") || lowerCode.startsWith("ticket-")
        const isManual = lowerCode.startsWith("manual-") || lowerCode.startsWith("sale-") || lowerCode.startsWith("sale://")
        const isQr =
          normalizedCode &&
          qrRegistry.some((qr) => (normalizeSaleCode(qr.id) ?? "").toLowerCase() === normalizedCode.toLowerCase())
        const keepCode = Boolean(rawCode) && (isTicket || isManual || isQr)
        const uniqueCode = keepCode
          ? rawCode!
          : `sale-${now}-${idx}-${Math.random().toString(16).slice(2, 6)}`
        const mergedCodes = [...(item.codes ?? [])]
        if (rawCode && !keepCode && !mergedCodes.includes(rawCode)) {
          mergedCodes.push(rawCode)
        }
        return {
          ...item,
          code: uniqueCode,
          codes: mergedCodes.length ? mergedCodes : item.codes,
          quantity: item.quantity ?? 1,
        }
      })
      const records: ScannedProduct[] = preparedItems.map((item, idx) => ({
        code: item.code ?? `manual-${now}-${idx}`,
        codes: item.codes,
        name: item.name,
        price: item.price,
        points: item.points,
        quantity: item.quantity ?? 1,
        scannedAt: new Date(now + idx).toISOString(),
        productId: item.productId,
        origin: "sale",
        status: "confirmed",
      }))
      const pendingEntries: PendingSale[] = records.map((record) => ({
        code: record.code,
        codes: record.codes,
        name: record.name,
        price: record.price,
        points: record.points,
        quantity: record.quantity,
        createdAt: record.scannedAt,
        productId: record.productId,
      }))
      const adjustedItems = (() => {
        const baseTotal = preparedItems.reduce((sum, item) => {
          const qty = Math.max(1, Number(item.quantity ?? 1) || 1)
          return sum + (Number(item.price ?? 0) * qty)
        }, 0)
        const totalValue = Number.isFinite(saleMeta?.total as number) ? (saleMeta?.total as number) : null
        const discountValue = Number.isFinite(saleMeta?.discount as number) ? (saleMeta?.discount as number) : null
        const targetTotal = totalValue ?? (discountValue !== null ? baseTotal - discountValue : null)
        if (targetTotal === null || baseTotal <= 0 || targetTotal < 0) return preparedItems
        if (Math.abs(targetTotal - baseTotal) < 0.01) return preparedItems
        const roundMoney = (value: number) => Math.round(value * 100) / 100
        let remaining = roundMoney(targetTotal)
        return preparedItems.map((item, idx) => {
          const qty = Math.max(1, Number(item.quantity ?? 1) || 1)
          const lineBase = Number(item.price ?? 0) * qty
          const share = baseTotal > 0 ? (targetTotal * lineBase) / baseTotal : 0
          const lineTotal = idx === preparedItems.length - 1 ? remaining : roundMoney(share)
          remaining = roundMoney(remaining - lineTotal)
          const adjustedPrice = qty ? lineTotal / qty : Number(item.price ?? 0)
          return { ...item, price: adjustedPrice }
        })
      })()
      const ledgerRecords = records.map((record, idx) => ({
        ...record,
        price: adjustedItems[idx]?.price ?? record.price,
      }))
      const normalizedEmail = normalizeEmail(customerEmail)
      const normalizedCedula = normalizeCedula(saleMeta?.customerCedula ?? null)
      const canSyncWithBackend = Boolean((normalizedEmail || normalizedCedula || saleMeta?.customerId) && authToken && (isAdmin || isSeller))
      let appliedState: LookupUserResponse | null = null
      const hasCoupon = (saleMeta?.discount ?? 0) > 0 || Boolean(saleMeta?.couponId)
      const rawSource = saleMeta?.source?.trim()
      const baseSource = rawSource || "register"
      const saleSource = hasCoupon && !baseSource.toLowerCase().includes("coupon")
        ? `${baseSource}-coupon`
        : baseSource
      const salePaymentMethod = saleMeta?.paymentMethod
      const salePaymentDetails = saleMeta?.paymentDetails
      const saleExchangeRate = saleMeta?.exchangeRate ?? dailyRate
      const salesLedger: SalesEvent[] = ledgerRecords.map((record, idx) =>
        normalizeSalesEventRecord(
          {
            key: record.code,
            code: record.code,
            codes: record.codes,
            name: record.name,
            price: record.price,
            points: record.points,
            quantity: record.quantity,
            scannedAt: record.scannedAt,
            productId: record.productId,
            source: saleSource,
            currency: "USD",
            exchangeRate: saleExchangeRate,
            paymentMethod: salePaymentMethod,
            paymentDetails: salePaymentDetails,

            // Pass customer details to event
            customerName: saleMeta?.customerName,
            customerPhone: saleMeta?.customerPhone,
            documentType: saleMeta?.documentType as any,
            documentNumber: saleMeta?.documentNumber,
            customerId: saleMeta?.customerId ?? null,
            customerEmail: normalizedEmail,
          },
          idx,
        ),
      )
      mergeSalesEvents(salesLedger)

      if (!canSyncWithBackend && authToken && isBackoffice) {
        logSaleEvents(
          {
            items: adjustedItems.map((item) => ({ ...item, quantity: item.quantity ?? 1 })),
            source: saleSource,
            occurredAt: records[0]?.scannedAt,
            customerEmail: normalizedEmail ?? undefined,
            customerCedula: normalizedCedula ?? undefined,
            customerId: saleMeta?.customerId ?? undefined,
            couponId: saleMeta?.couponId ?? undefined,
            subtotal: saleMeta?.subtotal,
            total: saleMeta?.total,
            discount: saleMeta?.discount,
            exchangeRate: saleMeta?.exchangeRate ?? dailyRate,
            paymentMethod: saleMeta?.paymentMethod,
            paymentDetails: saleMeta?.paymentDetails,
          },
          authToken,
        )
          .then((saved) => mergeSalesEvents(saved.map((evt, idx) => normalizeSalesEventRecord(evt, idx))))
          .catch((err) => console.error("No se pudo sincronizar la venta", err))
      }

      if (canSyncWithBackend) {
        try {
          const response = await registerSale(
            {
              items: adjustedItems,
              customerEmail: normalizedEmail ?? undefined,
              customerCedula: normalizedCedula ?? undefined,
              customerId: saleMeta?.customerId ?? undefined,
              customerName: saleMeta?.customerName ?? undefined,
              customerPhone: saleMeta?.customerPhone ?? undefined,
              documentType: saleMeta?.documentType ?? undefined,
              documentNumber: saleMeta?.documentNumber ?? undefined,
              couponId: saleMeta?.couponId ?? undefined,
              subtotal: saleMeta?.subtotal,
              total: saleMeta?.total,
              discount: saleMeta?.discount,
              exchangeRate: saleMeta?.exchangeRate ?? dailyRate,
              paymentMethod: saleMeta?.paymentMethod,
              paymentDetails: saleMeta?.paymentDetails,
            },
            authToken as string,
          )

          appliedState = (response.state as LookupUserResponse) ?? null
          if (response.saleEvents?.length) {
            mergeSalesEvents(response.saleEvents.map((evt, idx) => normalizeSalesEventRecord(evt, idx)))
          }

          const rewardTargetEmail = normalizeEmail(appliedState?.user?.email ?? normalizedEmail)
          const rewardBelongsToCurrentUser =
            Boolean(rewardTargetEmail) &&
            rewardTargetEmail === normalizeEmail(user?.email ?? null) &&
            !isAdmin &&
            !isSeller

          const unlockedRewards = response.rewardsUnlocked?.length
            ? response.rewardsUnlocked
            : response.rewardUnlocked
              ? [response.rewardUnlocked]
              : []

          if (unlockedRewards.length && rewardBelongsToCurrentUser) {
            const titles = unlockedRewards.map((r) => r.title).join(", ")
            const label = unlockedRewards.length > 1
              ? `${unlockedRewards.length} cupones: ${titles}`
              : unlockedRewards[0].title
            addToast(`Cupón desbloqueado: ${label}`, "success")
          }
          if (response.levelCouponsIssued?.length) {
            const targetEmail = normalizeEmail(appliedState?.user?.email ?? normalizedEmail)
            if (targetEmail && targetEmail === normalizeEmail(user?.email ?? null)) {
              setLevelGrant({
                levelName: response.levelState?.currentLevel?.name ?? "Nuevo nivel",
                coupons: response.levelCouponsIssued,
              })
            }
          }

          if (response.user?.isProvisional) {
            const cedulaLabel = response.user.cedula || normalizedCedula || "la cedula indicada"
            addToast(`Venta guardada para cliente provisional. Debe registrarse con ${cedulaLabel} antes de 7 dias para no perder los puntos.`, "info")
          } else {
            addToast("Venta aplicada al cliente", "success")
          }
        } catch (err: any) {
          const msg = err?.message || "No se pudo aplicar la venta al cliente"
          addToast(msg, "error")
        }
      }

      if (appliedState) {
        const targetEmail = normalizeEmail(appliedState.user?.email ?? normalizedEmail)
        const targetCedula = normalizeCedula(appliedState.user?.cedula ?? normalizedCedula)
        const isCurrentUser =
          (appliedState.user?.id && user?.id && appliedState.user.id === user.id) ||
          (targetEmail && normalizeEmail(user?.email ?? null) === targetEmail)
        if (isCurrentUser) {
          setMe((prev) => enrichStateWithLevel(appliedState as any, prev))
        }

        const checkoutCedula = normalizeCedula(checkoutCustomer.cedula)
        if (
          (targetEmail && targetEmail === normalizeEmail(checkoutCustomer.email ?? null)) ||
          (targetCedula && checkoutCedula && targetCedula === checkoutCedula)
        ) {
          setCheckoutCustomer((prev) => ({
            ...prev,
            email: appliedState.user?.email ?? prev.email,
            cedula: targetCedula ?? prev.cedula ?? "",
            userId: appliedState?.user?.id ?? saleMeta?.customerId ?? prev.userId,
            levelState: appliedState.levelState ?? prev.levelState,
            coupons: appliedState.coupons ?? prev.coupons ?? [],
            loading: false,
            error: null,
          }))
        }

        return
      }

      if (saleMeta?.customerId && normalizedEmail) {
        registerPendingSalesForCustomer(normalizedEmail, pendingEntries)
      } else if (normalizedEmail) {
        addToast("No encontramos al cliente, venta registrada sin puntos automáticos", "error")
      }

      addToast("Venta registrada", "success")
    },
    [
      addToast,
      authToken,
      dailyRate,
      checkoutCustomer.email,
      checkoutCustomer.cedula,
      enrichStateWithLevel,
      isAdmin,
      isBackoffice,
      isSeller,
      mergeSalesEvents,
      qrRegistry,
      registerPendingSalesForCustomer,
      registerSale,
      setCheckoutCustomer,
      setLevelGrant,
      user?.email,
      user?.id,
      user?.id,
    ],
  )

  const handleCancelTicket = useCallback(
    async (id: number) => {
      if (!authToken) return
      try {
        await cancelTicket(id, authToken)
        addToast("Ticket cancelado", "success")
        // Optimistic update
        setPaymentTickets((prev) => prev.filter((t) => t.id !== id))
        refreshTickets()
      } catch (e) {
        addToast("Error al cancelar ticket", "error")
      }
    },
    [addToast, authToken, refreshTickets],
  )

  const handleResetSales = useCallback(() => {
    setManualSales([])
    setQrSalesLedger([])
    setSalesEvents([])
    setExpenses([])
    if (typeof window !== "undefined") {
      localStorage.removeItem(MANUAL_SALES_KEY)
      localStorage.removeItem(QR_SALES_LOG_KEY)
    }
  }, [])

  const handleResetSalesRange = useCallback((range: { start: string; end: string }) => {
    const startTs = new Date(range.start).getTime()
    const endTs = new Date(range.end).getTime()
    if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) return
    const from = Math.min(startTs, endTs)
    const to = Math.max(startTs, endTs)
    const isOutsideRange = (value?: string | null) => {
      if (!value) return true
      const ts = new Date(value).getTime()
      if (!Number.isFinite(ts)) return true
      return ts < from || ts > to
    }

    setSalesEvents((prev) => prev.filter((sale) => isOutsideRange(sale.occurredAt || sale.scannedAt)))
    setExpenses((prev) => prev.filter((expense) => isOutsideRange(expense.occurredAt || expense.createdAt)))
  }, [])
  const handleShowCouponQr = useCallback(
    async (coupon: CouponDto) => {
      try {
        const url = `coupon:${coupon.id}` // Simple format for the scanner
        const dataUrl = await QRCodeLib.toDataURL(url, { margin: 1, scale: 8 })
        setRedeemModal({ active: true, coupon, qr: dataUrl })
      } catch (e) {
        addToast("Error generando QR", "error")
      }
    },
    [addToast],
  )

  const handleGiftCoupon = useCallback(
    async (coupon: CouponDto, friendEmail: string) => {
      const email = friendEmail.trim().toLowerCase()
      if (!authToken) {
        addToast("Inicia sesion para regalar tu cupon", "error")
        return { ok: false, message: "No autenticado" }
      }
      if (!email || !email.includes("@")) {
        addToast("Ingresa un correo valido", "error")
        return { ok: false, message: "Correo invalido" }
      }
      if (coupon.status !== "available") {
        addToast("Solo puedes regalar cupones disponibles", "error")
        return { ok: false, message: "Cupon no disponible" }
      }
      setGiftingCouponId(coupon.id)
      try {
        const transfer = await transferCoupon(coupon.id, email, authToken)
        const peerEmail =
          (transfer && typeof transfer === "object" && (transfer as any).to?.email) || friendEmail.trim()
        const sentAt = new Date().toISOString()
        const giftActivity: UserActivityDto = {
          id: `send-${coupon.id}-${Date.now()}`,
          type: "SEND",
          data: {
            couponId: coupon.id,
            couponTitle: coupon.title || "Cupon",
            peerName: peerEmail || null,
          },
          createdAt: sentAt,
        }
        const mergeGiftActivity = (items: UserActivityDto[] | undefined) => {
          const list = Array.isArray(items) ? items : []
          const exists = list.some(
            (entry) => entry.type === "SEND" && entry.data?.couponId === coupon.id,
          )
          return exists ? list : [giftActivity, ...list].slice(0, 60)
        }
        const removeGiftedCoupon = (items: CouponDto[] | undefined) => {
          const list = Array.isArray(items) ? items : []
          return list.filter((item) => item.id !== coupon.id)
        }

        setMe((prev) => {
          if (!prev) return prev
          const nextState = {
            ...prev,
            coupons: removeGiftedCoupon(prev.coupons),
            activity: mergeGiftActivity(prev.activity),
          }
          return enrichStateWithLevel(nextState, prev)
        })

        const data = await fetchMe(authToken)
        setMe((prev) => {
          const nextCoupons = removeGiftedCoupon(data.coupons ?? prev?.coupons)
          const nextActivity = mergeGiftActivity(data.activity ?? prev?.activity)
          return enrichStateWithLevel(
            { ...data, coupons: nextCoupons, activity: nextActivity },
            prev,
          )
        })
        return { ok: true }
      } catch (e: any) {
        const msg = e?.message || "No se pudo transferir el cupon"
        return { ok: false, message: msg }
      } finally {
        setGiftingCouponId((prev) => (prev === coupon.id ? null : prev))
      }
    },
    [addToast, authToken, enrichStateWithLevel],
  )

  // EFFECTS (Startup & Camera)
  useEffect(() => {
    const saved = localStorage.getItem("loyalty-auth")
    const urlParams = new URLSearchParams(window.location.search)
    const urlCode = urlParams.get("code")

    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        const storedName = parsed?.user?.id ? profileNames[parsed.user.id] : undefined
        const emailFallback = parsed?.user?.email?.split("@")[0] || ""
        const fallbackName = emailFallback || (parsed?.user as any)?.name || "Cliente"
        const resolvedName = storedName || fallbackName
        const userWithName = parsed.user ? { ...parsed.user, name: resolvedName } : parsed.user
        if (parsed?.user?.id && resolvedName && !storedName) {
          setProfileNames((prev) => ({ ...prev, [parsed.user.id]: resolvedName }))
        }
        setAuthToken(parsed.token)
        setUser(userWithName)
        setUserStateLoading(true)
        fetchMe(parsed.token)
          .then((data) => {
            setMe((prev) => enrichStateWithLevel(data, prev))
            if ((data as any).user) {
              setUser((prev) => prev ? ({ ...prev, ...(data as any).user }) : (data as any).user)
            }
          })
          .catch((e: any) => {
            const status = e?.status
            if (status === 401 || status === 404) {
              addToast("Tu sesi\xF3n expir\xF3 o el usuario ya no existe. Inicia de nuevo.", "info")
              handleLogout()
            }
            return null
          })
          .finally(() => setUserStateLoading(false))
      } catch {
        localStorage.removeItem("loyalty-auth")
        setUserStateLoading(false)
      }
    } else {
      setUserStateLoading(false)
    }

    if (urlCode) stageScannedProduct(urlCode)
    else {
      const pendingLocal = localStorage.getItem("pending-claim")
      if (pendingLocal) stageScannedProduct(pendingLocal)
    }
  }, [])

  // --- DASHBOARD STATS SYNC ---
  useEffect(() => {
    if (!authToken || !isAdmin) return

    const load = async () => {
      try {
        const stats = await fetchDashboardStats(authToken)

        setDashboardStats(stats)
        // Sync legacy stats for compatibility
        setRegisteredUsers(stats.registeredUsers)
        setCouponStats({
          total: stats.couponsGenerated,
          available: stats.couponsGenerated - stats.redeemedCoupons,
          used: stats.redeemedCoupons,
          expired: 0
        })
      } catch (e) {
        console.error("Failed to fetch dashboard stats", e)
      }
    }

    load() // Initial load
    const interval = setInterval(load, 30000) // Poll every 30s
    return () => clearInterval(interval)
  }, [authToken, isAdmin])

  // --- CATALOG SYNC ---
  useEffect(() => {
    if (!authToken) return
    if (isBackoffice) return
    fetchPublicProducts()
      .then((data) => setCatalog(normalizeCatalogPrices(data)))
      .catch(err => console.error("Failed to load catalog", err))
  }, [authToken, isBackoffice])

  // --- EXPENSES SYNC ---
  useEffect(() => {
    if (!authToken || !isAdmin) return
    let cancelled = false
    const loadExpenses = async () => {
      try {
        const data = await fetchExpenses(authToken, { limit: FINANCE_RECORD_LIMIT })
        if (!cancelled) setExpenses(data)
      } catch (err) {
        console.error("Failed to fetch expenses", err)
      }
    }

    loadExpenses()
    const interval = setInterval(loadExpenses, 45000)
    const handleRefresh = () => {
      if (document.visibilityState !== "visible") return
      void loadExpenses()
    }
    window.addEventListener("focus", handleRefresh)
    document.addEventListener("visibilitychange", handleRefresh)

    return () => {
      cancelled = true
      clearInterval(interval)
      window.removeEventListener("focus", handleRefresh)
      document.removeEventListener("visibilitychange", handleRefresh)
    }
  }, [authToken, isAdmin])

  // Camera Effects (Claim Scanner)
  useEffect(() => {
    // Stop scanner if not active OR if we have a scanned product (result view)
    if (!claimScanner.active || scannedProduct) {
      claimControlsRef.current?.stop?.()
      return
    }
    let canceled = false
    import("@zxing/browser").then((mod) => {
      if (canceled) return
      // Safety check for video element
      if (!claimVideoRef.current) return

      const reader = new mod.BrowserQRCodeReader()
      return reader.decodeFromConstraints(
        { video: { facingMode: "environment" } },
        claimVideoRef.current,
        (result) => {
          if (result) {
            const text = result.getText()
            if (text !== claimScanner.last) {
              setClaimScanner((prev) => ({ ...prev, last: text, status: "Código leído" }))
              handleClaimScan(text)
            }
          }
        }
      ).then((c) => { claimControlsRef.current = c })
    }).catch((err) => {
      // Ignore AbortError which happens on cleanup/switching
      if (err.name !== 'AbortError') {
        console.error("Scanner Error:", err)
        setClaimScanner((prev) => ({ ...prev, error: "No pudimos acceder a la cámara. Verifica los permisos." }))
      }
    })
    return () => { canceled = true; claimControlsRef.current?.stop?.() }
  }, [claimScanner.active, claimScanner.last, handleClaimScan, scannedProduct])

  // Camera Effects (Coupon Validator)
  useEffect(() => {
    // Stop scanner if not active OR if we have an inspected coupon (result view)
    if (!couponScanner.active || inspectedCoupon) {
      couponControlsRef.current?.stop?.()
      return
    }
    let canceled = false
    import("@zxing/browser").then((mod) => {
      if (canceled) return
      // Safety check for video element
      if (!couponVideoRef.current) return

      const reader = new mod.BrowserQRCodeReader()
      return reader.decodeFromConstraints(
        { video: { facingMode: "environment" } },
        couponVideoRef.current,
        (result) => {
          if (result) {
            const text = result.getText()
            if (text !== couponScanner.last) {
              setCouponScanner((prev) => ({ ...prev, last: text, status: "QR detectado" }))
              handleCouponScan(text)
            }
          }
        }
      ).then((c) => { couponControlsRef.current = c })
    }).catch((err) => {
      if (err.name !== 'AbortError') console.error(err)
    })
    return () => { canceled = true; couponControlsRef.current?.stop?.() }
  }, [couponScanner.active, couponScanner.last, handleCouponScan, inspectedCoupon])


  // -----------------------------------------------------------------------------
  // UI RENDER HELPERS (IMPROVED)
  // -----------------------------------------------------------------------------

  const handleForgot = async () => {
    if (!resetEmail || !resetEmail.includes("@")) {
      setAuthError("Ingresa un email válido")
      return
    }
    setLoadingAction(true)
    setAuthError(null)
    try {
      await forgotPassword(resetEmail)
      addToast(`Código enviado a ${resetEmail}`, "success")
      setAuthModeLanding("reset")
    } catch (e: any) {
      setAuthError(prettifyAuthError(e))
    } finally {
      setLoadingAction(false)
    }
  }

  const handleReset = async () => {
    if (!recoveryCode || recoveryCode.length < 6) {
      setAuthError("Ingresa el código de 6 dígitos")
      return
    }
    if (!newPassword || newPassword.length < 6) {
      setAuthError("La contraseña debe tener al menos 6 caracteres")
      return
    }
    setLoadingAction(true)
    setAuthError(null)
    try {
      await resetPassword(resetEmail, recoveryCode, newPassword)
      addToast("Contraseña restablecida correctamente", "success")
      setAuthModeLanding("login")
      setForm(prev => ({ ...prev, email: resetEmail, password: "" })) // Pre-fill email
    } catch (e: any) {
      setAuthError(prettifyAuthError(e))
    } finally {
      setLoadingAction(false)
    }
  }

  const renderLanding = () => {
    if (authModeLanding === "menu") {
      return (
        <GuestInterface
          products={catalog}
          productsLoading={catalogLoading}
          onLoginClick={() => setAuthModeLanding("login")}
          onRegisterClick={(prefillCedula?: string) => {
            if (prefillCedula) {
              setForm(prev => ({ ...prev, cedula: prefillCedula, mode: "register" }))
            }
            setAuthModeLanding("register")
          }}
          createGuestTicket={createGuestTicket}
          dailyRate={dailyRate || 0}
        />
      )
    }
    return (
      <div className="min-h-screen bg-[#AFC8BF] flex items-center justify-center font-sans selection:bg-[#6A3A30]/20 selection:text-[#6A3A30] relative overflow-hidden">

        {/* Back to Menu - Top Left */}
        <div className="absolute top-6 left-6 z-50">
          <button
            onClick={() => setAuthModeLanding("menu")}
            className="group flex items-center gap-2 pl-4 pr-5 py-2.5 bg-[#FFFBEA]/80 hover:bg-[#FFFBEA] backdrop-blur-md border border-[#6A3A30]/10 text-[#6A3A30] hover:text-[#6A3A30] font-bold text-sm rounded-full shadow-lg shadow-[#6A3A30]/10 hover:shadow-[#6A3A30]/20 hover:ring-1 hover:ring-[#6A3A30]/20 transition-all duration-300 ease-out active:scale-95"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform duration-300" />
            <span>Volver al menú</span>
          </button>
        </div>

        {/* Background Decor */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] rounded-full bg-[#FFFBEA]/20 blur-3xl opacity-60" />
          <div className="absolute top-[30%] -right-[10%] w-[60vw] h-[60vw] rounded-full bg-[#1A864D]/10 blur-3xl opacity-50" />
          <div className="absolute -bottom-[20%] left-[20%] w-[50vw] h-[50vw] rounded-full bg-[#6A3A30]/10 blur-3xl opacity-40" />
        </div>

        <div className="w-full max-w-md mx-auto p-6 relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">

          {/* Header Section */}
          <div className="flex flex-col items-center mb-10 text-center">
            <div className="relative mb-6 group cursor-default">
              <div className="absolute inset-0 bg-[#6A3A30] rounded-3xl rotate-6 opacity-20 blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <div className="relative h-24 w-24 rounded-3xl bg-[#FFFBEA] flex items-center justify-center shadow-2xl shadow-[#6A3A30]/20 ring-1 ring-[#FFFBEA]/50 group-hover:-translate-y-1 transition-transform duration-300">
                <Store size={44} className="text-[#6A3A30]" strokeWidth={1.5} />
              </div>
            </div>
            <h1 className="text-xl sm:text-4xl font-black text-[#6A3A30] tracking-tight">
              Krums<span className="text-[#1A864D]">.</span>
            </h1>
            <p className="text-[#6A3A30]/80 mt-3 text-lg font-medium leading-relaxed max-w-xs mx-auto">
              El sabor que te recompensa.<br />
              <span className="text-[#6A3A30]/60 text-sm">Puntos, canjes y premios sin fricción.</span>
            </p>
          </div>

          {/* Auth Card */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (authModeLanding === "login" || authModeLanding === "register") {
                handleAuth(authModeLanding)
              } else if (authModeLanding === "forgot") {
                handleForgot()
              } else if (authModeLanding === "reset") {
                handleReset()
              }
            }}
            className="bg-[#FFFBEA] backdrop-blur-xl rounded-[2rem] p-8 shadow-2xl shadow-[#6A3A30]/10 ring-1 ring-white/60 transition-all duration-300"
          >

            {(authModeLanding === "login" || authModeLanding === "register") && (
              <div className="flex p-1 bg-[#6A3A30]/10 rounded-2xl mb-8 relative">
                <div
                  className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-[#FFFBEA] rounded-xl shadow-sm transition-transform duration-300 ease-spring ${authModeLanding === "register" ? "translate-x-[100%] translate-x-2" : "translate-x-0"
                    }`}
                />
                <button
                  type="button"
                  className={`flex-1 relative z-10 py-2.5 text-sm font-bold rounded-xl transition-colors duration-300 ${authModeLanding === "login" ? "text-[#6A3A30]" : "text-[#6A3A30]/60 hover:text-[#6A3A30]"}`}
                  onClick={() => { setAuthModeLanding("login"); setAuthError(null) }}
                >
                  Iniciar Sesión
                </button>
                <button
                  type="button"
                  className={`flex-1 relative z-10 py-2.5 text-sm font-bold rounded-xl transition-colors duration-300 ${authModeLanding === "register" ? "text-[#6A3A30]" : "text-[#6A3A30]/60 hover:text-[#6A3A30]"}`}
                  onClick={() => { setAuthModeLanding("register"); setAuthError(null) }}
                >
                  Crear Cuenta
                </button>
              </div>
            )}

            {authModeLanding === "forgot" && (
              <div className="mb-6">
                <h2 className="text-xl font-bold text-[#6A3A30] mb-2">Recuperar Contraseña</h2>
                <p className="text-sm text-[#6A3A30]/70">Ingresa tu correo para recibir un código de recuperación.</p>
              </div>
            )}

            {authModeLanding === "reset" && (
              <div className="mb-6">
                <h2 className="text-xl font-bold text-[#6A3A30] mb-2">Restablecer Contraseña</h2>
                <p className="text-sm text-[#6A3A30]/70">Ingresa el código que recibiste y tu nueva contraseña.</p>
              </div>
            )}

            {/* Error Message */}
            {authError && (
              <div className="mb-6 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
                  <AlertCircle size={20} className="shrink-0 mt-0.5" />
                  <div className="text-sm font-medium leading-relaxed">
                    {authError}
                  </div>
                </div>
              </div>
            )}

            {/* Form Fields */}
            <div className="space-y-4">
              {authModeLanding === "register" && (
                <>
                  <div className="group space-y-1.5 animate-in fade-in slide-in-from-bottom-2">
                    <label className="text-[11px] font-bold text-[#6A3A30]/60 uppercase tracking-wider ml-1">Nombre</label>
                    <input
                      className="w-full h-14 rounded-2xl border border-[#6A3A30]/10 bg-[#6A3A30]/5 text-[#6A3A30] px-4 placeholder:text-[#6A3A30]/40 outline-none focus:border-[#1A864D] focus:ring-4 focus:ring-[#1A864D]/10 transition-all font-medium"
                      placeholder="Como te llamamos?"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>
                  <div className="group space-y-1.5 animate-in fade-in slide-in-from-bottom-2">
                    <label className="text-[11px] font-bold text-[#6A3A30]/60 uppercase tracking-wider ml-1">Cédula</label>
                    <input
                      className="w-full h-14 rounded-2xl border border-[#6A3A30]/10 bg-[#6A3A30]/5 text-[#6A3A30] px-4 placeholder:text-[#6A3A30]/40 outline-none focus:border-[#1A864D] focus:ring-4 focus:ring-[#1A864D]/10 transition-all font-medium"
                      placeholder="Solo números"
                      inputMode="numeric"
                      maxLength={30}
                      value={form.cedula}
                      onChange={(e) => setForm({ ...form, cedula: e.target.value.replace(/\D/g, "") })}
                    />
                  </div>
                </>
              )}

              {(authModeLanding === "login" || authModeLanding === "register") && (
                <>
                  <div className="group space-y-1.5">
                    <label className="text-[11px] font-bold text-[#6A3A30]/60 uppercase tracking-wider ml-1">Email</label>
                    <input
                      className="w-full h-14 rounded-2xl border border-[#6A3A30]/10 bg-[#6A3A30]/5 text-[#6A3A30] px-4 placeholder:text-[#6A3A30]/40 outline-none focus:border-[#1A864D] focus:ring-4 focus:ring-[#1A864D]/10 transition-all font-medium"
                      placeholder="nombre@ejemplo.com"
                      type="email"
                      autoComplete={authModeLanding === "login" ? "username" : "email"}
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                  <div className="group space-y-1.5">
                    <label className="text-[11px] font-bold text-[#6A3A30]/60 uppercase tracking-wider ml-1">Contraseña</label>
                    <div className="relative">
                      <input
                        className="w-full h-14 rounded-2xl border border-[#6A3A30]/10 bg-[#6A3A30]/5 text-[#6A3A30] px-4 pr-12 placeholder:text-[#6A3A30]/40 outline-none focus:border-[#1A864D] focus:ring-4 focus:ring-[#1A864D]/10 transition-all font-medium"
                        placeholder="••••••••"
                        type={showPassword ? "text" : "password"}
                        autoComplete={authModeLanding === "login" ? "current-password" : "new-password"}
                        required
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                      />
                      <button
                        type="button"
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6A3A30]/40 hover:text-[#6A3A30] transition-colors"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>

                    {/* Password Requirements Checklist */}
                    {showPasswordRequirements && (
                      <div className="pt-2 pl-1 animate-in fade-in slide-in-from-top-2 duration-300">
                        <p className="text-xs font-bold text-[#6A3A30]/70 mb-2">La contraseña debe tener:</p>
                        <div className="space-y-2">
                          {[
                            { test: (p: string) => p.length >= 6, label: "Mínimo 6 caracteres" },
                            { test: (p: string) => /\d/.test(p), label: "Al menos 1 número" },
                          ].map((rule, idx) => {
                            const met = rule.test(form.password)
                            return (
                              <div key={idx} className="flex items-center gap-2 text-xs font-medium transition-colors duration-300">
                                {met ? (
                                  <CheckCircle2 size={14} className="text-[#1A864D]" />
                                ) : (
                                  <Circle size={14} className="text-[#6A3A30]/20" />
                                )}
                                <span className={met ? "text-[#1A864D]" : "text-[#6A3A30]/40"}>
                                  {rule.label}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  {authModeLanding === "register" && (
                    <div className="group space-y-1.5 animate-in fade-in slide-in-from-bottom-2">
                      <label className="text-[11px] font-bold text-[#6A3A30]/60 uppercase tracking-wider ml-1">Confirmar Contraseña</label>
                      <div className="relative">
                        <input
                          className="w-full h-14 rounded-2xl border border-[#6A3A30]/10 bg-[#6A3A30]/5 text-[#6A3A30] px-4 pr-12 placeholder:text-[#6A3A30]/40 outline-none focus:border-[#1A864D] focus:ring-4 focus:ring-[#1A864D]/10 transition-all font-medium"
                          placeholder="••••••••"
                          type={showConfirmPassword ? "text" : "password"}
                          value={form.confirmPassword}
                          onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                        />
                        <button
                          type="button"
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6A3A30]/40 hover:text-[#6A3A30] transition-colors"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {authModeLanding === "forgot" && (
                <div className="group space-y-1.5 animate-in fade-in slide-in-from-bottom-2">
                  <label className="text-[11px] font-bold text-[#6A3A30]/60 uppercase tracking-wider ml-1">Email</label>
                  <input
                    className="w-full h-14 rounded-2xl border border-[#6A3A30]/10 bg-[#6A3A30]/5 text-[#6A3A30] px-4 placeholder:text-[#6A3A30]/40 outline-none focus:border-[#1A864D] focus:ring-4 focus:ring-[#1A864D]/10 transition-all font-medium"
                    placeholder="Tu correo registrado"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                  />
                </div>
              )}

              {authModeLanding === "reset" && (
                <>
                  <div className="group space-y-1.5 animate-in fade-in slide-in-from-bottom-2">
                    <label className="text-[11px] font-bold text-[#6A3A30]/60 uppercase tracking-wider ml-1">Código de verificación</label>
                    <input
                      className="w-full h-14 rounded-2xl border border-[#6A3A30]/10 bg-[#6A3A30]/5 text-[#6A3A30] px-4 placeholder:text-[#6A3A30]/40 outline-none focus:border-[#1A864D] focus:ring-4 focus:ring-[#1A864D]/10 transition-all font-medium font-mono tracking-widest text-center text-lg"
                      placeholder="000000"
                      maxLength={6}
                      value={recoveryCode}
                      onChange={(e) => setRecoveryCode(e.target.value)}
                    />
                  </div>
                  <div className="group space-y-1.5 animate-in fade-in slide-in-from-bottom-2">
                    <label className="text-[11px] font-bold text-[#6A3A30]/60 uppercase tracking-wider ml-1">Nueva Contraseña</label>
                    <div className="relative">
                      <input
                        className="w-full h-14 rounded-2xl border border-[#6A3A30]/10 bg-[#6A3A30]/5 text-[#6A3A30] px-4 pr-12 placeholder:text-[#6A3A30]/40 outline-none focus:border-[#1A864D] focus:ring-4 focus:ring-[#1A864D]/10 transition-all font-medium"
                        placeholder="••••••••"
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6A3A30]/40 hover:text-[#6A3A30] transition-colors"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="mt-8 space-y-3">
              {(authModeLanding === "login" || authModeLanding === "register") && (
                <>
                  <button
                    type="submit"
                    className="w-full h-14 rounded-2xl bg-[#6A3A30] hover:bg-[#5a3128] active:scale-[0.98] text-[#FFFBEA] font-bold text-lg shadow-xl shadow-[#6A3A30]/20 flex items-center justify-center gap-3 transition-all disabled:opacity-70 disabled:cursor-not-allowed group"
                    disabled={loadingAction}
                  >
                    {loadingAction ? (
                      <div className="h-5 w-5 border-2 border-[#FFFBEA]/30 border-t-[#FFFBEA] rounded-full animate-spin" />
                    ) : (
                      <>
                        {authModeLanding === "login" ? "Entrar ahora" : "Unirme al club"}
                        <ArrowRight size={20} className="group-hover:translate-x-0.5 transition-transform" strokeWidth={2.5} />
                      </>
                    )}
                  </button>
                  {authModeLanding === "login" && (
                    <button
                      type="button"
                      className="w-full py-2 text-sm text-[#6A3A30]/60 hover:text-[#1A864D] font-medium transition-colors"
                      onClick={() => { setAuthModeLanding("forgot"); setAuthError(null); setResetEmail(form.email) }}
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  )}
                </>
              )}

              {authModeLanding === "forgot" && (
                <>
                  <button
                    type="submit"
                    className="w-full h-14 rounded-2xl bg-[#6A3A30] hover:bg-[#5a3128] text-[#FFFBEA] font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70"
                    disabled={loadingAction}
                  >
                    {loadingAction ? <div className="animate-spin h-4 w-4 border-2 border-[#FFFBEA]/30 border-t-[#FFFBEA] rounded-full" /> : "Enviar código de verificación"}
                  </button>
                  <button
                    type="button"
                    className="w-full py-2 text-sm text-[#6A3A30]/60 hover:text-[#6A3A30] font-medium transition-colors mt-2"
                    onClick={() => { setAuthModeLanding("login"); setAuthError(null) }}
                  >
                    Volver al inicio
                  </button>
                </>
              )}

              {authModeLanding === "reset" && (
                <>
                  <button
                    type="submit"
                    className="w-full h-14 rounded-2xl bg-[#6A3A30] hover:bg-[#5a3128] active:scale-[0.98] text-[#FFFBEA] font-bold text-lg shadow-xl shadow-[#6A3A30]/20 flex items-center justify-center gap-3 transition-all disabled:opacity-70 disabled:cursor-not-allowed group"
                    disabled={loadingAction}
                  >
                    {loadingAction ? (
                      <div className="h-5 w-5 border-2 border-[#FFFBEA]/30 border-t-[#FFFBEA] rounded-full animate-spin" />
                    ) : (
                      "Guardar contraseña"
                    )}
                  </button>
                  <button
                    type="button"
                    className="w-full py-2 text-sm text-[#6A3A30]/60 hover:text-[#6A3A30] font-medium transition-colors"
                    onClick={() => { setAuthModeLanding("login"); setAuthError(null) }}
                  >
                    Cancelar
                  </button>
                </>
              )}

            </div>


          </form>

          {/* Footer */}
          <p className="text-center text-xs font-medium text-[#6A3A30]/50 mt-8">
            © {new Date().getFullYear()} Krums Loyalty. Todos los derechos reservados.
          </p>



        </div>
      </div>
    )
  }

  // -----------------------------------------------------------------------------
  // MAIN RETURN
  // -----------------------------------------------------------------------------

  if (!isAuthed) {
    return (
      <>
        {renderLanding()}
        {/* Toast Container (Landing) */}
        <div className="fixed top-4 left-4 right-4 z-50 flex flex-col items-center gap-2 pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`max-w-sm w-full px-5 py-3.5 rounded-2xl shadow-xl shadow-slate-900/5 flex items-center gap-3 text-sm font-semibold animate-in slide-in-from-top-5 fade-in pointer-events-auto backdrop-blur-md border border-white/20
                ${toast.tone === 'error' ? 'bg-rose-500/90 text-white' :
                  toast.tone === 'success' ? 'bg-emerald-500/90 text-white' :
                    'bg-slate-900/90 text-white'
                }`}
            >
              {toast.tone === 'success' && <CheckCircle2 size={18} className="text-white/80" />}
              {toast.tone === 'error' && <AlertCircle size={18} className="text-white/80" />}
              {toast.message}
            </div>
          ))}
        </div>
      </>
    )
  }

  // --- Loading Guard ---
  // Prevent rendering main interfaces (especially ClientInterface) until we have the user state (me)
  // This avoids the "Cannot read properties of undefined (reading 'currentLevel')" error.
  if (userStateLoading || !me) {
    return <LoadingScreen />
  }

  return (
    <div className={`min-h-screen ${isBackoffice ? "bg-slate-50" : "bg-[#afc8bf]"} text-[#6A3A30] font-sans selection:bg-[#1A864D]/10 selection:text-[#1A864D] pb-safe-offset-8 transition-colors duration-500`}>

      {/* --- Main Content Container (Centered for clients, full-width for admin/seller) --- */}
      <main
        className={`${isBackoffice
          ? "w-full"
          : "pt-8 sm:pt-12 px-4 sm:px-6 pb-32 max-w-5xl mx-auto space-y-6"
          } animate-in fade-in slide-in-from-bottom-4 duration-500`}
      >

        {/* Delegating to sub-components */}
        {isAdmin ? (
          <AdminInterface
            isAdmin
            isSeller={false}
            catalog={catalog}
            qrRegistry={qrRegistry}
            inventorySummary={inventorySummary}
            registeredUsers={registeredUsers}
            couponStats={couponStats}
            adminTab={adminTab}
            setCouponScanner={setCouponScanner}
            newProduct={newProduct}
            setNewProduct={setNewProduct}
            addProduct={handleRegisterProduct}
            loadingAction={loadingAction}
            selectedProductIdx={selectedProductIdx}
            setSelectedProductIdx={setSelectedProductIdx}
            adminGen={adminGen}
            setAdminGen={setAdminGen}
            handleGenerate={handleGenerate}
            adminCouponLookup={adminCouponLookup}
            setAdminCouponLookup={setAdminCouponLookup}
            handleInspectCoupon={handleInspectCoupon}
            inspectedCoupon={inspectedCoupon}
            redeemingCoupon={redeemingCoupon}
            handleRedeemCoupon={handleRedeemCoupon}
            inspectCouponForSale={inspectCouponForSale}
            redeemCouponForSale={redeemCouponForSale}
            expenses={expenses}
            couponScanner={couponScanner}
            setInspectedCoupon={setInspectedCoupon}
            formatCouponSubtitle={formatCouponSubtitle}
            getCouponStatusLabel={getCouponStatusLabel}
            formatPoints={formatPoints}
            formatMoney={formatMoney}
            handleDeleteProduct={handleDeleteProduct}
            handleRestoreProduct={handleRestoreProduct}
            editingProduct={editingProduct}
            setEditingProduct={setEditingProduct}
            handleSaveProductEdit={handleSaveProductEdit}
            inventoryFilter={inventoryFilter}
            setInventoryFilter={setInventoryFilter}
            filteredInventory={filteredInventory}
            lowStockThreshold={lowStockThreshold}
            handleAdjustStock={handleAdjustStock}
            handleDeleteQr={handleDeleteQr}
            handleDeleteUsedQrs={handleDeleteUsedQrs}
            isCodeInvalidated={isCodeInvalidated}
            couponVideoRef={couponVideoRef}
            confirmedHistory={confirmedHistory}
            manualSales={manualSales}
            qrSalesLedger={qrSalesLedger}
            salesEvents={salesEvents}
            onResetSales={handleResetSales}
            onResetSalesRange={handleResetSalesRange}
            onRegisterSale={handleRegisterSale}
            activeLevelState={activeLevelState}
            levelLadder={levelRules.ladder}
            checkoutCustomer={checkoutCustomer}
            onLookupCustomer={handleLookupCustomer}
            onClearCustomer={clearCheckoutCustomer}
            dashboardStats={dashboardStats}
            onLookupUser={handleLookupAdminUser}
            onDeleteUser={handleDeleteUser}
            loyaltyRules={rules}
            defaultLoyaltyRules={DEFAULT_RULES}
            onUpdateLoyaltyRules={handleUpdateLoyaltyRules}
            tickets={paymentTickets}
            onConfirmTicket={confirmPaymentTicket}
            onCancelTicket={handleCancelTicket}
            onAuditTicketPoints={handleAuditTicketPoints}
            onReconcileTicketPoints={handleReconcileTicketPoints}
            confirmingTickets={confirmingTickets}
            onLogout={handleLogout}
            dailyRate={dailyRate}
            cajaState={cajaState}
            setCajaState={setCajaState}
            // Stock Save Feature
            stockUpdates={stockUpdates}
            onQueueStockUpdate={handleQueueStockUpdate}
            onSaveStockUpdates={handleSaveStockUpdates}
            // Intercepted navigation
            setAdminTab={handleSetAdminTab}
            onSubscribe={handleSubscribeToNotifications}
            setCatalog={setCatalog}
          />
        ) : isSeller ? (
          <SellerInterface
            expenses={expenses}
            catalog={catalog}
            qrRegistry={qrRegistry}
            inventorySummary={inventorySummary}
            registeredUsers={registeredUsers}
            couponStats={couponStats}
            adminTab={adminTab}
            setAdminTab={setAdminTab}
            setCouponScanner={setCouponScanner}
            newProduct={newProduct}
            setNewProduct={setNewProduct}
            addProduct={handleRegisterProduct}
            loadingAction={loadingAction}
            selectedProductIdx={selectedProductIdx}
            setSelectedProductIdx={setSelectedProductIdx}
            adminGen={adminGen}
            setAdminGen={setAdminGen}
            handleGenerate={handleGenerate}
            adminCouponLookup={adminCouponLookup}
            setAdminCouponLookup={setAdminCouponLookup}
            handleInspectCoupon={handleInspectCoupon}
            inspectedCoupon={inspectedCoupon}
            redeemingCoupon={redeemingCoupon}
            handleRedeemCoupon={handleRedeemCoupon}
            inspectCouponForSale={inspectCouponForSale}
            redeemCouponForSale={redeemCouponForSale}
            couponScanner={couponScanner}
            setInspectedCoupon={setInspectedCoupon}
            formatCouponSubtitle={formatCouponSubtitle}
            getCouponStatusLabel={getCouponStatusLabel}
            formatPoints={formatPoints}
            formatMoney={formatMoney}
            handleDeleteProduct={handleDeleteProduct}
            handleRestoreProduct={handleRestoreProduct}
            editingProduct={editingProduct}
            setEditingProduct={setEditingProduct}
            handleSaveProductEdit={handleSaveProductEdit}
            // Stock Save Feature
            stockUpdates={stockUpdates}
            onQueueStockUpdate={handleQueueStockUpdate}
            onSaveStockUpdates={handleSaveStockUpdates}
            inventoryFilter={inventoryFilter}
            setInventoryFilter={setInventoryFilter}
            filteredInventory={filteredInventory}
            lowStockThreshold={lowStockThreshold}
            handleAdjustStock={handleAdjustStock}
            handleDeleteQr={handleDeleteQr}
            handleDeleteUsedQrs={handleDeleteUsedQrs}
            isCodeInvalidated={isCodeInvalidated}
            couponVideoRef={couponVideoRef}
            confirmedHistory={confirmedHistory}
            manualSales={manualSales}
            qrSalesLedger={qrSalesLedger}
            salesEvents={salesEvents}
            onResetSales={handleResetSales}
            onResetSalesRange={handleResetSalesRange}
            onRegisterSale={handleRegisterSale}
            activeLevelState={activeLevelState}
            levelLadder={levelRules.ladder}
            checkoutCustomer={checkoutCustomer}
            onLookupCustomer={handleLookupCustomer}
            onClearCustomer={clearCheckoutCustomer}
            dashboardStats={dashboardStats}
            onLookupUser={handleLookupAdminUser}
            onDeleteUser={handleDeleteUser}
            loyaltyRules={rules}
            defaultLoyaltyRules={DEFAULT_RULES}
            onUpdateLoyaltyRules={handleUpdateLoyaltyRules}
            tickets={paymentTickets}
            onConfirmTicket={confirmPaymentTicket}
            onAuditTicketPoints={handleAuditTicketPoints}
            onReconcileTicketPoints={handleReconcileTicketPoints}
            confirmingTickets={confirmingTickets}
            onLogout={handleLogout}
            dailyRate={dailyRate || 0}
            cajaState={cajaState}
            setCajaState={setCajaState}
            onSubscribe={handleSubscribeToNotifications}
            setCatalog={setCatalog}
          />
        ) : (
          <ClientInterface
            user={user}
            currentState={clientState}
            levelState={clientLevelState}
            nextReward={nextReward || null}
            punchSlots={punchSlots}
            punchesFilled={punchesFilled}
            showRewardAnimation={showRewardAnimation}
            punchPopVersion={punchPopVersion}
            claimScanner={claimScanner}
            setClaimScanner={setClaimScanner}
            claimForm={claimForm}
            setClaimForm={setClaimForm}
            scannedProduct={scannedProduct}
            setScannedProduct={setScannedProduct}
            loadingAction={loadingAction}
            onConfirmScannedProduct={async (code) => {
              if (!authToken) return
              await handleClaimWithCode(code, authToken)
            }}
            stageScannedProduct={stageScannedProduct}
            claimVideoRef={claimVideoRef}
            redeemModal={redeemModal}
            setRedeemModal={setRedeemModal}
            coupons={coupons}
            formatCouponSubtitle={formatCouponSubtitle}
            getCouponStatusLabel={getCouponStatusLabel}
            openRedeemModal={handleShowCouponQr}

            onGiftCoupon={handleGiftCoupon}
            giftingCouponId={giftingCouponId}
            confirmedHistory={confirmedHistory}
            couponEvents={couponActivity}
            pendingPurchases={pendingSalesForUser}
            showPendingNotice={shouldShowPendingNotice}
            onDismissPendingNotice={() => dismissPendingNoticeForUser(user?.email ?? null)}
            ladder={ladder}
            levelLadder={levelRules.ladder}
            catalog={catalog}
            onCreateTicket={createPaymentTicket}
            paymentTickets={ticketsForUser}
            onLoadMoreTickets={loadMoreTickets}
            ticketsHasMore={Boolean(ticketsNextCursor)}
            ticketsInitialLoading={ticketsInitialLoading}
            ticketsLoadError={ticketsLoadError}
            ticketsLoadingMore={ticketsLoadingMore}
            onLogout={handleLogout}
            onUpdateProfile={handleUpdateProfile}
            onCancelTicket={handleCancelTicket}
            dailyRate={dailyRate}
          />
        )}
      </main>

      {/* --- Global Toast Notifications (Bottom Stack) --- */}
      <div className="fixed bottom-6 inset-x-0 z-[70] flex flex-col items-center gap-2 pointer-events-none px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`max-w-sm w-full backdrop-blur-xl border px-5 py-4 rounded-2xl shadow-2xl shadow-slate-900/20 text-sm font-semibold flex items-center gap-3 animate-in slide-in-from-bottom-10 fade-in zoom-in-95 duration-300 pointer-events-auto transform transition-all
               ${toast.tone === 'success' ? 'bg-white/95 text-emerald-700 border-emerald-100 ring-1 ring-emerald-500/10' :
                toast.tone === 'error' ? 'bg-white/95 text-rose-700 border-rose-100 ring-1 ring-rose-500/10' :
                  'bg-slate-900/95 text-white border-white/10'
              }`}
          >
            <div className={`shrink-0 p-1 rounded-full ${toast.tone === 'success' ? 'bg-emerald-100' :
              toast.tone === 'error' ? 'bg-rose-100' : 'bg-slate-700'
              }`}>
              {toast.tone === 'success' && <CheckCircle2 size={16} className="text-emerald-600" />}
              {toast.tone === 'error' && <X size={16} className="text-rose-600" />}
              {toast.tone === 'info' && <Sparkles size={16} className="text-white" />}
            </div>
            <span className="leading-snug">{toast.message}</span>
          </div>
        ))}
      </div>

      {/* --- Level Up Celebration Modal --- */}
      {levelGrant && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center pointer-events-none p-4 sm:p-6">

          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-500 pointer-events-auto" onClick={() => setLevelGrant(null)} />

          {/* Card */}
          <div className="bg-white relative w-full max-w-sm rounded-[2rem] shadow-2xl shadow-indigo-500/20 overflow-hidden pointer-events-auto animate-in slide-in-from-bottom-20 duration-500">
            {/* Header Decoration */}
            <div className="h-32 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 relative flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-150 contrast-150 mix-blend-overlay"></div>
              <div className="h-24 w-24 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg ring-4 ring-white/30">
                <span className="text-4xl">🎖️</span>
              </div>
            </div>

            {/* Content */}
            <div className="p-8 text-center">
              <h3 className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-2">¡Felicitaciones!</h3>
              <h2 className="text-3xl font-black text-slate-900 mb-2 leading-tight">Nuevo Nivel Desbloqueado</h2>
              <p className="text-lg font-medium text-slate-600 mb-6">{levelGrant.levelName}</p>

              {levelGrant.coupons.length > 0 && (
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-6 text-left">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles size={16} className="text-amber-500" />
                    <p className="text-sm font-bold text-slate-700">Recompensas obtenidas:</p>
                  </div>
                  <ul className="space-y-2">
                    {levelGrant.coupons.map((c) => (
                      <li key={c.id} className="flex items-center gap-2 text-sm text-slate-600 bg-white p-2 rounded-xl shadow-sm border border-slate-100">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        <span className="truncate flex-1 font-medium">{c.title || `Cupón ${c.kind}`}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                onClick={() => setLevelGrant(null)}
                className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors active:scale-95"
              >
                ¡Genial, gracias!
              </button>
            </div>
          </div>
        </div>
      )}
      <SpeedInsights />
    </div>
  )
}
