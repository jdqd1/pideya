import { type Dispatch, type RefObject, type SetStateAction, useEffect, useMemo, useState } from "react"
import { normalizeSaleCode, startOfWeek } from "../utils/adminUtils"
import {
  getExpenseTimestamp,
  getSaleCurrencyTotals,
  getSaleTimestamp,
  getExpenseUsdAmount,
  getSaleUsdAmount,
  normalizeCurrency,
  safeNumber,
} from "../utils/financeLedger"
import {
  QrCode,
  Ticket,
  Store,
  Home,
  ShoppingBag,
  DollarSign,
  User,
  Package,
  Gift,
} from "lucide-react"
import TicketModal from "./admin/components/TicketModal"
import RewardsSection from "./admin/sections/RewardsSection"
import type { LoyaltyRulesResponse, LevelDefinition } from "../types/loyalty"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/Tooltip"
import HomeSection from "./admin/sections/HomeSection"
import SalesSection from "./admin/sections/SalesSection"
import TicketsSection from "./admin/sections/TicketsSection"
import MetricsSection from "./admin/sections/MetricsSection"
import CajaSection from "./admin/sections/CajaSection"
import ProductsSection from "./admin/sections/ProductsSection"
import QrSection from "./admin/sections/QrSection"
import RecetarioSection from "./admin/sections/RecetarioSection"
import {
  type DashboardStats,
  type LookupUserResponse,
  type TicketPointsIntegrityResponse,
  type TicketPointsReconcileResponse,
} from "../api/secure"
import { getNotificationSubscription, unsubscribeFromNotifications } from "../api/notifications"
import type {
  ScannerState,
  ProductDef,
  GeneratedQrRecord,
  ScannedProduct,
  SalesEvent,
  PaymentTicket,
  CajaState,
  Expense
} from "../types/app"
import type {
  CouponDto,
  CouponInspectResponse,
  CouponStats,
  UserLevelState
} from "../types/userState"



type CheckoutCustomerState = {
  email: string
  cedula: string
  userId?: string | null
  levelState: UserLevelState | null
  coupons: CouponDto[]
  loading: boolean
  error: string | null
}

// ... types remain the same
export type AdminInterfaceProps = {
  isAdmin: boolean
  isSeller: boolean
  catalog: ProductDef[]
  qrRegistry: GeneratedQrRecord[]
  inventorySummary: { totalStock: number; lowStock: number; items: number }
  registeredUsers: number
  couponStats: CouponStats
  dashboardStats: DashboardStats | null
  onLookupUser: (query: { cedula?: string; email?: string }) => Promise<LookupUserResponse>
  onDeleteUser: (userId: string) => void | Promise<{ deleted: number } | void>
  adminTab: "home" | "validator" | "generator" | "products" | "qr" | "sales" | "register" | "metrics" | "tickets" | "recetario" | "rewards"
  setAdminTab: Dispatch<SetStateAction<"home" | "validator" | "generator" | "products" | "qr" | "sales" | "register" | "metrics" | "tickets" | "recetario" | "rewards">>
  setCouponScanner: Dispatch<SetStateAction<ScannerState>>
  newProduct: { name: string; price: string; points: string; stock: string; cost: string; imageUrl: string; description: string }
  setNewProduct: Dispatch<SetStateAction<{ name: string; price: string; points: string; stock: string; cost: string; imageUrl: string; description: string }>>
  addProduct: () => void | Promise<void>
  loadingAction: boolean
  selectedProductIdx: number
  setSelectedProductIdx: Dispatch<SetStateAction<number>>
  adminGen: { count: number; status: string }
  setAdminGen: Dispatch<SetStateAction<{ count: number; status: string }>>
  handleGenerate: () => void | Promise<void>
  formatCouponSubtitle: (coupon: CouponDto) => string
  getCouponStatusLabel: (status: CouponDto["status"]) => string
  inspectCouponForSale: (raw: string) => Promise<{ coupon: CouponInspectResponse | null; isCoupon: boolean; error?: string }>
  redeemCouponForSale: (couponId: string) => Promise<{ ok: boolean; message?: string }>
  adminCouponLookup: { code: string; status: string }
  setAdminCouponLookup: Dispatch<SetStateAction<{ code: string; status: string }>>
  handleInspectCoupon: (raw?: string) => void | Promise<void>
  inspectedCoupon: CouponInspectResponse | null
  redeemingCoupon: boolean
  handleRedeemCoupon: () => void | Promise<void>
  couponScanner: ScannerState
  setInspectedCoupon: Dispatch<SetStateAction<CouponInspectResponse | null>>
  formatPoints: (value: number | string | undefined | null) => string
  formatMoney: (value: number | string | undefined | null) => string
  handleDeleteProduct: (id: string) => void
  handleRestoreProduct: (id: string) => void
  handleDeleteQr: (codeId: string) => void | Promise<void>
  handleDeleteUsedQrs: (codes: string[]) => void | Promise<void>
  isCodeInvalidated: (rawCode: string | null | undefined) => boolean
  editingProduct: {
    index: number
    draft: { name: string; price: string; points: string; stock: string; cost: string; imageUrl: string; description: string }
  } | null
  setEditingProduct: Dispatch<SetStateAction<{ index: number; draft: { name: string; price: string; points: string; stock: string; cost: string; imageUrl: string; description: string } } | null>>
  handleSaveProductEdit: () => void | Promise<void>
  inventoryFilter: "all" | "low"
  setInventoryFilter: Dispatch<SetStateAction<"all" | "low">>
  filteredInventory: ProductDef[]
  lowStockThreshold: number
  handleAdjustStock: (id: string, delta: number) => void
  couponVideoRef: RefObject<HTMLVideoElement>
  confirmedHistory: ScannedProduct[]
  manualSales: ScannedProduct[]
  qrSalesLedger: ScannedProduct[]
  salesEvents?: SalesEvent[]
  onResetSales: () => void
  onResetSalesRange?: (range: { start: string; end: string }) => void
  onRegisterSale: (
    items: { code?: string; codes?: string[]; name: string; price: number; points: number; productId?: string; quantity?: number }[],
    customerEmail?: string,
    saleMeta?: { customerId?: string | null; couponId?: string | null; subtotal?: number; total?: number; discount?: number; customerCedula?: string | null; exchangeRate?: number; paymentMethod?: string; paymentDetails?: { method: string; amount: number; currency?: string; amountNative?: number; currencyNative?: string; amountUsd?: number; exchangeRate?: number | null }[] },
  ) => void | Promise<void>
  activeLevelState?: UserLevelState | null
  levelLadder: LevelDefinition[]
  checkoutCustomer: CheckoutCustomerState
  onLookupCustomer: (cedula: string) => void | Promise<void>
  onClearCustomer: () => void
  tickets: PaymentTicket[]
  onConfirmTicket: (id: number) => void | Promise<void>
  onCancelTicket?: (id: number) => void | Promise<void>
  onAuditTicketPoints: (limit?: number) => Promise<TicketPointsIntegrityResponse>
  onReconcileTicketPoints: (payload: { limit?: number; dryRun?: boolean }) => Promise<TicketPointsReconcileResponse>
  onLogout: () => void
  dailyRate: number
  cajaState: CajaState
  setCajaState: Dispatch<SetStateAction<CajaState>>
  confirmingTickets: Set<number>
  // Stock Save Feature
  stockUpdates: Record<string, number>
  onQueueStockUpdate: (id: string, delta: number) => void
  onSaveStockUpdates: () => void
  loyaltyRules: LoyaltyRulesResponse
  defaultLoyaltyRules: LoyaltyRulesResponse
  onUpdateLoyaltyRules: (rules: LoyaltyRulesResponse) => Promise<LoyaltyRulesResponse | void> | void
  expenses: Expense[]
  onSubscribe: () => Promise<void>
  setCatalog: Dispatch<SetStateAction<ProductDef[]>>
}

import { LogOut, Bell, Menu, X } from "lucide-react"

export default function AdminInterface(props: AdminInterfaceProps) {
  const {
    isAdmin,

    catalog,
    qrRegistry,
    inventorySummary,
    registeredUsers,
    couponStats,
    dashboardStats,
    onLookupUser,
    onDeleteUser,
    adminTab,
    setAdminTab,

    newProduct,
    setNewProduct,
    addProduct,
    loadingAction,
    selectedProductIdx,
    setSelectedProductIdx,
    adminGen,
    setAdminGen,
    handleGenerate,
    formatCouponSubtitle,

    inspectCouponForSale,
    redeemCouponForSale,
    formatPoints,
    formatMoney,
    handleDeleteProduct,
    handleRestoreProduct,
    handleDeleteQr,
    handleDeleteUsedQrs,
    isCodeInvalidated,
    editingProduct,
    setEditingProduct,
    handleSaveProductEdit,
    inventoryFilter,
    setInventoryFilter,
    filteredInventory,
    lowStockThreshold,

    confirmedHistory,
    manualSales,
    qrSalesLedger,
    salesEvents,
    onResetSales,
    onResetSalesRange,
    // Stock Save
    stockUpdates,
    onQueueStockUpdate,
    onSaveStockUpdates,
    onRegisterSale,
    activeLevelState,
    levelLadder,
    checkoutCustomer,
    onLookupCustomer,
    onClearCustomer,
    tickets,
    onConfirmTicket,
    onCancelTicket,
    onLogout,
    dailyRate,
    cajaState,
    setCajaState,
    confirmingTickets,
    loyaltyRules,
    defaultLoyaltyRules,
    onUpdateLoyaltyRules,
    expenses,
    onSubscribe,
  } = props


  // Fix overscroll background color
  useEffect(() => {
    // Save original background
    const originalBg = document.body.style.backgroundColor
    const originalBackgroundImage = document.body.style.backgroundImage
    const originalHtmlBg = document.documentElement.style.backgroundColor
    const originalHtmlOverscroll = document.documentElement.style.overscrollBehaviorY
    const originalBodyOverscroll = document.body.style.overscrollBehaviorY

    // Set light background for admin interface
    document.body.style.backgroundColor = '#f1f5f9' // slate-100
    document.body.style.backgroundImage = 'none'
    document.documentElement.style.backgroundColor = '#f1f5f9'
    document.documentElement.style.overscrollBehaviorY = 'none'
    document.body.style.overscrollBehaviorY = 'none'

    return () => {
      // Restore on unmount
      document.body.style.backgroundColor = originalBg
      document.body.style.backgroundImage = originalBackgroundImage
      document.documentElement.style.backgroundColor = originalHtmlBg
      document.documentElement.style.overscrollBehaviorY = originalHtmlOverscroll
      document.body.style.overscrollBehaviorY = originalBodyOverscroll
    }
  }, [])

  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [checkingNotifications, setCheckingNotifications] = useState(true)

  useEffect(() => {
    getNotificationSubscription()
      .then((sub) => {
        setNotificationsEnabled(!!sub)
      })
      .finally(() => setCheckingNotifications(false))
  }, [])

  /* Logic for pending tickets count */
  const pendingTicketsCount = tickets.filter((t) => t.status === "pending").length

  const [viewingTicket, setViewingTicket] = useState<PaymentTicket | null>(null)
  const [isSidebarOpen, setSidebarOpen] = useState(false)
  const [isDesktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(true)


  const isDev = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV
  const allowResetReports = isDev || isAdmin === true

  const salesEventsList = useMemo<SalesEvent[]>(() => {
    const map = new Map<string, SalesEvent>()
    const seenCodes = new Set<string>()
    const pushEvent = (payload: Omit<SalesEvent, "key"> & { key?: string }) => {
      const qty = Number(payload.quantity ?? 1) || 1
      const ts = new Date(payload.scannedAt).getTime()
      if (Number.isNaN(ts)) return
      const normalized = normalizeSaleCode(payload.code) ?? payload.code?.toLowerCase().trim()
      if (normalized && seenCodes.has(normalized)) return
      const key = payload.key || normalized || `${payload.name}-${payload.scannedAt}-${map.size}`
      if (normalized) seenCodes.add(normalized)
      map.set(key, { key, ...payload, quantity: qty, code: normalized ?? payload.code })
    }
    if (salesEvents?.length) {
      salesEvents.forEach((item) => {
        const tsRaw = item.scannedAt || item.occurredAt || item.key || item.code
        const parsed = tsRaw ? new Date(tsRaw) : new Date()
        const safeTs = !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString()
        pushEvent({
          key: item.key,
          productId: item.productId,
          name: item.name,
          price: Number(item.price ?? 0),
          points: item.points,
          scannedAt: safeTs,
          code: item.code,
          quantity: item.quantity,
          currency: item.currency,
          exchangeRate: item.exchangeRate,
          exchangeRateDate: item.exchangeRateDate,
          paymentMethod: item.paymentMethod ?? (item as any).paymentMethod,
          paymentDetails: item.paymentDetails,
          source: item.source,
          customerName: item.customerName,
          customerPhone: item.customerPhone,
          documentType: item.documentType,
          documentNumber: item.documentNumber,
          customerEmail: item.customerEmail,
          occurredAt: item.occurredAt,
        })
      })
    }
    return Array.from(map.values())
  }, [salesEvents])

  const totalsByWindow = useMemo(() => {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const startOfWeekTs = startOfWeek(now).getTime()
    const startOfMonthTs = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    const startOfYearTs = new Date(now.getFullYear(), 0, 1).getTime()

    const computeTotal = (since: number) => {
      const salesTotal = salesEventsList.reduce(
        (acc, item) => {
          const qty = Math.max(1, Number(item.quantity ?? 1) || 1)
          const tsDate = getSaleTimestamp(item)
          if (!tsDate) return acc
          const ts = tsDate.getTime()

        if (ts >= since) {
            acc.units += qty
            const totals = getSaleCurrencyTotals(item, dailyRate)
            acc.revenueUsd += totals.usd
            acc.revenueVes += totals.ves
            acc.equivalentUsd += getSaleUsdAmount(item, dailyRate)
          }
          return acc
        },
        { units: 0, revenueUsd: 0, revenueVes: 0, equivalentUsd: 0 },
      )

      expenses.forEach(expense => {
        const tsDate = getExpenseTimestamp(expense)
        if (!tsDate) return
        const ts = tsDate.getTime()

        if (ts >= since) {
          const amount = safeNumber(expense.amount)
          const currency = normalizeCurrency(expense.currency)
          salesTotal.equivalentUsd -= getExpenseUsdAmount(expense, dailyRate)

          if (currency === "VES") {
            salesTotal.revenueVes -= amount
          } else {
            salesTotal.revenueUsd -= amount
          }
        }
      })

      return salesTotal
    }

    return {
      day: computeTotal(startOfDay),
      week: computeTotal(startOfWeekTs),
      month: computeTotal(startOfMonthTs),
      year: computeTotal(startOfYearTs),
    }
  }, [dailyRate, salesEventsList, expenses])


  const monthlyRevenueEquivalentUsd = totalsByWindow.month?.equivalentUsd ?? 0
  const monthlyRevenueUsd = totalsByWindow.month?.revenueUsd ?? 0
  const monthlyRevenueVes = totalsByWindow.month?.revenueVes ?? 0
  const availableCoupons = couponStats?.available ?? 0
  const usedCoupons = couponStats?.used ?? 0


  const handleHardReset = () => {
    onResetSales()
  }

  const handleRangeReset = (range: { start: string; end: string }) => {
    onResetSalesRange?.(range)
  }



  const handleSubscribe = async () => {
    try {
      if (notificationsEnabled) {
        if (!confirm("¿Deseas desactivar las notificaciones en este dispositivo?")) return
        await unsubscribeFromNotifications()
        setNotificationsEnabled(false)
        alert('Notificaciones desactivadas')
      } else {
        if (!confirm("¿Deseas activar las notificaciones de nuevos pedidos en este dispositivo?")) return
        await onSubscribe()
        setNotificationsEnabled(true)
        alert('Notificaciones activadas correctamente')
      }
    } catch (e: any) {
      console.error(e)
      alert('Error cambiando notificaciones: ' + (e.message || e))
    }
  }

  const navItems = useMemo(() => [
    ...(isAdmin ? [{ id: "home", label: "Inicio", icon: <Home size={20} /> }] : []),
    {
      id: "tickets",
      label: "Tickets",
      icon: <Ticket size={20} />,
      badge: pendingTicketsCount > 0 ? pendingTicketsCount : undefined
    },
    { id: "register", label: "Caja", icon: <ShoppingBag size={20} /> },
    ...(isAdmin
      ? [
        { id: "sales", label: "Finanzas", icon: <DollarSign size={20} /> },
        { id: "metrics", label: "Usuarios", icon: <User size={20} /> },
        { id: "rewards", label: "Premios", icon: <Gift size={20} /> },
        { id: "products", label: "Productos", icon: <Package size={20} /> },
        { id: "qr", label: "Códigos QR", icon: <QrCode size={20} /> },
        // { id: "generator", label: "Generador", icon: <Zap size={18} /> }, // Removed
        { id: "recetario", label: "Recetario", icon: <Store size={20} /> },
      ]
      : [{ id: "sales", label: "Mis Ventas", icon: <DollarSign size={20} /> }]),
  ] as const, [isAdmin, pendingTicketsCount])

  useEffect(() => {
    if (!isSidebarOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSidebarOpen(false)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isSidebarOpen])

  const handleSidebarButton = () => {
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
      setDesktopSidebarCollapsed((prev) => !prev)
      return
    }
    setSidebarOpen((prev) => !prev)
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="min-h-screen bg-slate-100 text-slate-900 font-sans selection:bg-primary-100 selection:text-primary-900 pb-12 pt-[60px]">
        <header className="fixed top-0 left-0 right-0 z-50 px-4 py-3 bg-white/80 backdrop-blur-md border-b border-white/60 shadow-sm shadow-slate-200/50 h-[60px]">
          <div className="w-full mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={handleSidebarButton}
                className="h-9 w-9 rounded-full bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-700 border border-slate-200 flex items-center justify-center transition-colors"
                title="Secciones"
                aria-label="Secciones"
              >
                <Menu size={18} />
              </button>
              <div className="flex flex-col">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-0.5">
                  Krums
                </p>
                <p className="font-bold text-slate-900 text-sm leading-none">
                  {isAdmin ? "Administrador" : "Vendedor"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-3">
                {!notificationsEnabled && !checkingNotifications && (
                  <span className="hidden sm:block text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full animate-pulse cursor-pointer whitespace-nowrap border border-amber-100" onClick={handleSubscribe}>
                    Activar alertas
                  </span>
                )}
                <button
                  onClick={handleSubscribe}
                  className={`h-9 w-9 rounded-full flex items-center justify-center transition-all duration-300 relative ${notificationsEnabled
                    ? "bg-indigo-50 text-indigo-600 ring-2 ring-indigo-100 shadow-sm shadow-indigo-100"
                    : "bg-white text-slate-400 hover:bg-slate-50 hover:text-indigo-600 border border-slate-100"
                    }`}
                  title={notificationsEnabled ? "Notificaciones activas" : "Activar notificaciones"}
                >
                  <Bell size={16} className={notificationsEnabled ? "fill-current" : ""} />
                  {!notificationsEnabled && !checkingNotifications && (
                    <span className="sm:hidden absolute top-0 right-0 -mt-1 -mr-1 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500 ring-1 ring-white"></span>
                    </span>
                  )}
                </button>
              </div>
              <button
                onClick={onLogout}
                className="h-9 w-9 rounded-full bg-slate-100 text-slate-500 hover:bg-primary-50 hover:text-primary-600 flex items-center justify-center transition-colors"
                title="Cerrar sesión"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>

        {isSidebarOpen && (
          <button
            type="button"
            aria-label="Cerrar menu de secciones"
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-slate-900/35 backdrop-blur-[1px] lg:hidden"
          />
        )}

        {isSidebarOpen && (
        <aside
          className="fixed top-0 left-0 bottom-0 z-50 w-[280px] bg-slate-50 border-r border-slate-200 shadow-xl transition-transform duration-300 translate-x-0 lg:hidden"
        >
          <div className="h-[60px] px-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex flex-col">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-0.5">
                Secciones
              </p>
              <p className="font-bold text-slate-900 text-sm leading-none">
                Panel
              </p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="h-8 w-8 rounded-full bg-white text-slate-500 border border-slate-200 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center transition-colors"
              title="Cerrar menu"
              aria-label="Cerrar menu"
            >
              <X size={16} />
            </button>
          </div>

          <nav className="flex flex-col gap-2 w-full p-3 h-[calc(100%-60px)] overflow-y-auto">
            {navItems.map((tab) => {
              const isActive = adminTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setAdminTab(tab.id as any)
                    setSidebarOpen(false)
                  }}
                  className={`w-full rounded-xl text-sm font-medium transition-all flex items-center justify-start px-4 py-3 gap-3 relative ${isActive
                    ? "bg-primary-50 text-primary-700 shadow-sm ring-1 ring-primary-100"
                    : "text-slate-600 hover:bg-white hover:shadow-sm"
                    }`}
                >
                  <div className={`${isActive ? "text-primary-600" : "text-slate-400 group-hover:text-slate-600"} shrink-0`}>
                    {tab.icon}
                  </div>

                  <span className="truncate">{tab.label}</span>

                  {(tab as any).badge !== undefined && (
                    <span className="ml-auto flex items-center justify-center h-5 px-1.5 min-w-[20px] rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                      {(tab as any).badge}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </aside>
        )}

        <aside
          className={`hidden lg:flex flex-col fixed top-[60px] bottom-0 left-0 z-40 bg-slate-50 border-r border-slate-200 shadow-sm transition-all duration-300 ${isDesktopSidebarCollapsed ? "w-[72px]" : "w-[280px]"
            }`}
        >
          <nav className="flex flex-col gap-2 w-full p-3 overflow-y-auto">
            {navItems.map((tab) => {
              const isActive = adminTab === tab.id
              return (
                <Tooltip key={tab.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setAdminTab(tab.id as any)}
                      className={`w-full rounded-xl text-sm font-medium transition-all flex items-center relative ${isDesktopSidebarCollapsed ? "justify-center p-3" : "justify-start px-4 py-3 gap-3"
                        } ${isActive
                          ? "bg-primary-50 text-primary-700 shadow-sm ring-1 ring-primary-100"
                          : "text-slate-600 hover:bg-white hover:shadow-sm"
                        }`}
                      title={isDesktopSidebarCollapsed ? "" : tab.label}
                    >
                      <div className={`${isActive ? "text-primary-600" : "text-slate-400"} shrink-0`}>
                        {tab.icon}
                      </div>

                      {!isDesktopSidebarCollapsed && <span className="truncate">{tab.label}</span>}

                      {(tab as any).badge !== undefined && (
                        isDesktopSidebarCollapsed ? (
                          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold leading-none ring-2 ring-white">
                            {(tab as any).badge}
                          </span>
                        ) : (
                          <span className="ml-auto flex items-center justify-center h-5 px-1.5 min-w-[20px] rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                            {(tab as any).badge}
                          </span>
                        )
                      )}
                    </button>
                  </TooltipTrigger>
                  {isDesktopSidebarCollapsed && (
                    <TooltipContent side="right" sideOffset={10}>
                      {tab.label}
                    </TooltipContent>
                  )}
                </Tooltip>
              )
            })}
          </nav>
        </aside>

        <div className={`h-full transition-all duration-300 ${isDesktopSidebarCollapsed ? "lg:pl-[72px]" : "lg:pl-[280px]"}`}>
          <div className="w-full px-4 lg:px-8 py-4 sm:py-6">
            <main className="min-h-[500px]">
              {adminTab === "home" && (
                <HomeSection
                  monthlyRevenueEquivalentUsd={monthlyRevenueEquivalentUsd}
                  monthlyRevenueUsd={monthlyRevenueUsd}
                  monthlyRevenueVes={monthlyRevenueVes}
                  registeredUsers={registeredUsers}
                  availableCoupons={availableCoupons}
                  usedCoupons={usedCoupons}
                  formatMoney={formatMoney}
                  setAdminTab={setAdminTab}
                  pendingTickets={tickets.filter(t => t.status === "pending")}
                  exchangeRate={dailyRate}
                  confirmingTickets={confirmingTickets}
                  onViewTicket={(t) => setViewingTicket(t)}
                  apiStatus={dashboardStats?.apiStatus}
                />
              )}

              {adminTab === "sales" && (
                <SalesSection
                  salesEvents={salesEventsList}
                  tickets={tickets}
                  formatMoney={formatMoney}
                  allowResetReports={allowResetReports}
                  onHardReset={handleHardReset}
                  onResetRangeApplied={handleRangeReset}

                  onRegisterSale={onRegisterSale}
                  dailyRate={dailyRate}
                />
              )}

              {adminTab === "tickets" && (
                <TicketsSection
                  tickets={tickets}
                  onConfirmTicket={onConfirmTicket}
                  onCancelTicket={onCancelTicket}
                  confirmingTickets={confirmingTickets}
                  formatMoney={formatMoney}
                  exchangeRate={dailyRate}
                />
              )}

              {adminTab === "metrics" && (
                <MetricsSection
                  salesEvents={salesEventsList}
                  qrRegistry={qrRegistry}
                  couponStats={couponStats}
                  registeredUsers={registeredUsers}
                  dashboardStats={dashboardStats}
                  tickets={tickets}
                  dailyRate={dailyRate}
                  onLookupUser={onLookupUser}
                  onDeleteUser={onDeleteUser}
                  isAdmin={isAdmin}
                  activeLevelState={activeLevelState}
                  levelLadder={levelLadder}
                  checkoutCustomer={checkoutCustomer}
                />
              )}

              {adminTab === "rewards" && isAdmin && (
                <RewardsSection
                  rules={loyaltyRules}
                  defaultRules={defaultLoyaltyRules}
                  onSaveRules={onUpdateLoyaltyRules}
                />
              )}

              {adminTab === "register" && (
                <CajaSection
                  catalog={catalog}
                  qrRegistry={qrRegistry}
                  manualSales={manualSales}
                  confirmedHistory={confirmedHistory}
                  qrSalesLedger={qrSalesLedger}
                  onRegisterSale={onRegisterSale}
                  dailyRate={dailyRate}
                  checkoutCustomer={checkoutCustomer}
                  onLookupCustomer={onLookupCustomer}
                  onClearCustomer={onClearCustomer}
                  formatCouponSubtitle={formatCouponSubtitle}
                  inspectCouponForSale={inspectCouponForSale}
                  redeemCouponForSale={redeemCouponForSale}
                  activeLevelState={activeLevelState}
                  formatMoney={formatMoney}
                  cajaState={cajaState}
                  setCajaState={setCajaState}
                />
              )}

              {/* Validar Section Removed - Scanner is in Caja */}

              {adminTab === "products" && isAdmin && (
                <ProductsSection
                  isAdmin={isAdmin}
                  catalog={catalog}
                  newProduct={newProduct}
                  setNewProduct={setNewProduct}
                  addProduct={addProduct}
                  loadingAction={loadingAction}
                  handleDeleteProduct={handleDeleteProduct}
                  handleRestoreProduct={handleRestoreProduct}
                  editingProduct={editingProduct}
                  setEditingProduct={setEditingProduct}
                  handleSaveProductEdit={handleSaveProductEdit}
                  inventoryFilter={inventoryFilter}
                  setInventoryFilter={setInventoryFilter}
                  filteredInventory={filteredInventory}
                  lowStockThreshold={lowStockThreshold}

                  formatMoney={formatMoney}
                  inventorySummary={inventorySummary}
                  stockUpdates={stockUpdates}
                  onQueueStockUpdate={onQueueStockUpdate}
                  onSaveStockUpdates={onSaveStockUpdates}
                />
              )}
              {adminTab === "qr" && isAdmin && (
                <QrSection
                  isAdmin={isAdmin}
                  qrRegistry={qrRegistry}
                  catalog={catalog}
                  isCodeInvalidated={isCodeInvalidated}
                  handleDeleteQr={handleDeleteQr}
                  handleDeleteUsedQrs={handleDeleteUsedQrs}
                  formatPoints={formatPoints}
                  // Generator Props
                  selectedProductIdx={selectedProductIdx}
                  setSelectedProductIdx={setSelectedProductIdx}
                  adminGen={adminGen}
                  setAdminGen={setAdminGen}
                  handleGenerate={handleGenerate}
                  loadingAction={loadingAction}
                />
              )}

              {/* Generator Section Removed */}

              {adminTab === "recetario" && (
                <RecetarioSection
                  setAdminTab={setAdminTab}
                  setCatalog={props.setCatalog}
                />
              )}
            </main>
          </div>
        </div>
        {viewingTicket && (
          <TicketModal
            ticket={viewingTicket}
            actionLabel={viewingTicket.status === "pending" ? "Confirmar" : undefined}
            onAction={onConfirmTicket}
            onCancel={onCancelTicket}
            formatMoney={formatMoney}
            onClose={() => setViewingTicket(null)}
            isConfirming={confirmingTickets?.has(Number(viewingTicket.id))}
            exchangeRate={dailyRate}
          />
        )}
      </div>
    </TooltipProvider>
  )
}
