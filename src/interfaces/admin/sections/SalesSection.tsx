import { useMemo, useState, useEffect, useCallback, useRef } from "react"
import {
    Activity,
    TrendingUp,
    TrendingDown,
    DollarSign,
    Calendar,
    Banknote,
    CreditCard,
    Smartphone,
    Plus,
    Receipt,
    ShoppingBag,
    Ticket,
    ArrowRightLeft,
    Wallet,
    Trash2,
    Landmark,
    ChevronLeft,
    ChevronRight,
    Search,
    X,
    Eye,
    ArrowUpRight,
    ArrowDownRight,
    AlertCircle,
    Check,
    Loader,
    Minus,
    Target,
    Zap,
    Calculator
} from "lucide-react"
import { startOfWeek, normalizeSaleCode } from "../../../utils/adminUtils"
import type { SalesEvent, Expense, PaymentTicket } from "../../../types/app"
import { fetchExpenses, registerExpense, resetData, fetchFinancialSettings, type FinancialSettings, type ResetDataPayload } from "../../../api/secure"
import { API_URL } from "../../../api/config"
import TicketModal from "../components/TicketModal"

import FinancialSettingsModal from "../components/FinancialSettingsModal"
import { fetchRecipes } from "../../../api/recetario"
import type { Recipe } from "../../../types/recetario"
import { calculateRecipeVariableCost, calculateRecipeCosts } from "../../../utils/financeUtils"
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts'
import { convertVesToUsd as convertVesToUsdValue, formatVesLabel, formatVesLabelFromUsd } from "../../../utils/currency"
import {
    VES_METHODS,
    USD_METHODS,
    normalizePaymentMethod,
    collectSaleMethods,
    getSaleTimestamp,
    normalizeCurrency,
    safeNumber,
    isSameLocalDay as isSameDay,
    resolveRate,
    getExpenseTimestamp,
    getSaleUsdAmount,
    getExpenseUsdAmount,
    collectSaleMethodAmounts,
    collectSalePaymentMovements,
    getSaleCurrencyTotals,
    buildCashReconciliation,
    UNCLASSIFIED_USD_METHOD,
    UNCLASSIFIED_VES_METHOD,
} from "../../../utils/financeLedger"

export type SalesSectionProps = {
    salesEvents?: SalesEvent[]
    tickets?: PaymentTicket[]
    formatMoney: (value: number | string | undefined | null) => string

    onRegisterSale?: (items: any[], email?: string, meta?: any) => Promise<void> | void
    dailyRate: number
    allowResetReports?: boolean
    onHardReset?: () => void
    onResetRangeApplied?: (range: { start: string; end: string }) => void
}

type TimeRange = "today" | "week" | "month" | "year"
type ResetPeriodUnit = "days" | "week" | "month" | "year"


type SaleTicketItem = {
    name: string
    quantity: number
    price: number
    productId?: string
    points?: number
}

type SaleTicketDetail = {
    id: string
    ticketId?: string | null
    createdAt: string
    items: SaleTicketItem[]
    total: number
    totalUsd: number
    rate: number | null
    hasCoupon: boolean
    methods: string[]
    customerName?: string | null
    customerPhone?: string | null
    documentType?: string | null
    documentNumber?: string | null
    customerEmail?: string | null
}

type DayTransaction = {
    kind: "sale" | "expense"
    timestamp: number
    description?: string
    items?: SaleTicketItem[]
    total?: number
    amount?: number
    ticketId?: string | null
    fullDetail?: SaleTicketDetail
    expenseDetail?: Expense
}

type DailyStat = {
    date: Date
    revenueUsd: number
    revenueVes: number
    expensesUsd: number
    expensesVes: number
    transactions: DayTransaction[]
}

type SummaryChartPoint = {
    date: Date
    label: string
    incomeUsd: number
    expenseUsd: number
    netUsd: number
}

const PAYMENT_METHODS = [
    {
        id: "efectivo_usd",
        label: "Efectivo $",
        icon: DollarSign,
        text: "text-emerald-600",
        bg: "bg-emerald-50",
        border: "border-emerald-100",
    },
    {
        id: "efectivo_bs",
        label: "Efectivo Bs",
        icon: Banknote,
        text: "text-emerald-600",
        bg: "bg-emerald-50",
        border: "border-emerald-100",
    },
    {
        id: "pago_movil",
        label: "Pago Movil",
        icon: Smartphone,
        text: "text-cyan-600",
        bg: "bg-cyan-50",
        border: "border-cyan-100",
    },
    {
        id: "punto",
        label: "Punto",
        icon: CreditCard,
        text: "text-blue-600",
        bg: "bg-blue-50",
        border: "border-blue-100",
    },
    {
        id: "zelle",
        label: "Zelle",
        icon: Wallet,
        text: "text-purple-600",
        bg: "bg-purple-50",
        border: "border-purple-100",
    },
    {
        id: "transferencia",
        label: "Transferencia",
        icon: ArrowRightLeft,
        text: "text-indigo-600",
        bg: "bg-indigo-50",
        border: "border-indigo-100",
    },
] as const

const SUMMARY_CHART_HEIGHT = 256
const CALENDAR_WEEK_LABELS = ["L", "M", "X", "J", "V", "S", "D"] as const
const FINANCE_RECORD_LIMIT = 5000

const parseTicketIdFromCode = (raw?: string | null) => {
    if (!raw) return null
    const value = raw.trim()
    if (!value) return null
    if (value.startsWith("ticket://")) return value.replace("ticket://", "") || null
    if (value.startsWith("ticket-")) {
        const rawId = value.slice("ticket-".length)
        if (!rawId) return null
        const parts = rawId.split("-")
        if (parts.length <= 1) return rawId
        const lastPart = parts[parts.length - 1]
        if (/^\d+$/.test(lastPart)) {
            const joined = parts.slice(0, -1).join("-")
            return joined || null
        }
        return rawId
    }
    return null
}

const normalizeSearchValue = (value?: string | number | null) => {
    if (value === null || value === undefined) return ""
    return String(value).replace(/^#/, "").trim().toUpperCase()
}

const hashString = (value: string) => {
    let hash = 0
    for (let i = 0; i < value.length; i += 1) {
        hash = (hash << 5) - hash + value.charCodeAt(i)
        hash |= 0
    }
    return Math.abs(hash)
}

const formatTicketDisplayId = (rawId?: string | number | null) => {
    if (rawId === null || rawId === undefined) return null
    const value = String(rawId).trim()
    if (!value) return null
    if (/^v-/i.test(value)) return `V-${value.slice(2)}`
    if (/^\d+$/.test(value)) return value.padStart(6, "0")
    return value
}

const buildShortSaleId = (value?: string | number | Date | null) => {
    if (value === null || value === undefined) return null
    const raw = value instanceof Date ? value.toISOString() : String(value)
    const ts = value instanceof Date
        ? value.getTime()
        : typeof value === "number"
            ? value
            : new Date(value).getTime()
    if (Number.isFinite(ts)) return `V-${ts.toString().slice(-8)}`
    if (!raw) return null
    return `V-${hashString(raw).toString().slice(-8)}`
}

const normalizeTicketId = (rawId?: string | number | null) => {
    if (rawId === null || rawId === undefined) return null
    const value = String(rawId).trim()
    if (!value) return null
    if (/^v-/i.test(value)) return `V-${value.slice(2)}`.toUpperCase()
    const digits = value.replace(/\D/g, "")
    if (!digits) return value.toLowerCase()
    const parsed = Number.parseInt(digits, 10)
    if (Number.isNaN(parsed)) return value.toLowerCase()
    return String(parsed)
}

const toDayStart = (date: Date) => {
    const next = new Date(date)
    next.setHours(0, 0, 0, 0)
    return next
}

const toDayEnd = (date: Date) => {
    const next = new Date(date)
    next.setHours(23, 59, 59, 999)
    return next
}

const parseDateInput = (value: string) => {
    if (!value) return null
    const parts = value.split("-").map((part) => Number(part))
    if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null
    const [year, month, day] = parts
    if (!year || !month || !day) return null
    const parsed = new Date(year, month - 1, day)
    return Number.isNaN(parsed.getTime()) ? null : parsed
}

const toInputDate = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
}

const getMethodMeta = (methodId: string) => {
    if (methodId === UNCLASSIFIED_USD_METHOD) {
        return {
            id: methodId,
            label: "Sin método $",
            icon: AlertCircle,
            text: "text-amber-600",
            bg: "bg-amber-50",
            border: "border-amber-100",
        }
    }
    if (methodId === UNCLASSIFIED_VES_METHOD) {
        return {
            id: methodId,
            label: "Sin método Bs",
            icon: AlertCircle,
            text: "text-amber-600",
            bg: "bg-amber-50",
            border: "border-amber-100",
        }
    }
    const entry = PAYMENT_METHODS.find((item) => item.id === methodId)
    if (entry) return entry
    return {
        id: methodId,
        label: methodId ? methodId.replace(/_/g, " ") : "Otro",
        icon: Receipt,
        text: "text-slate-500",
        bg: "bg-slate-50",
        border: "border-slate-100",
    }
}

const readAuthToken = () => {
    if (typeof window === "undefined") return null
    const stored = window.localStorage.getItem("loyalty-auth")
    if (!stored) return null
    try {
        const parsed = JSON.parse(stored)
        return typeof parsed?.token === "string" ? parsed.token : null
    } catch {
        return null
    }
}

const buildSaleTicketGroups = (sales: SalesEvent[], rate: number) => {
    const groups = new Map<string, SaleTicketDetail>()
    sales.forEach((sale, index) => {
        const normalizedCode = normalizeSaleCode(sale.code) ?? sale.code ?? ""
        const lowerCode = normalizedCode.toLowerCase()
        const ticketId = parseTicketIdFromCode(lowerCode)
        const groupId = (() => {
            if (ticketId) return `ticket-${ticketId}`
            if (lowerCode.startsWith("manual-")) {
                const parts = lowerCode.split("-")
                if (parts.length >= 2) return `manual-${parts[1]}`
            }
            if (sale.occurredAt) {
                const parsed = new Date(sale.occurredAt)
                if (!Number.isNaN(parsed.getTime())) return `occ:${parsed.toISOString()}`
            }
            if (sale.scannedAt) {
                const parsed = new Date(sale.scannedAt)
                if (!Number.isNaN(parsed.getTime())) return `scan:${parsed.toISOString().slice(0, 19)}`
            }
            if (lowerCode) return lowerCode
            return sale.key || `sale-${index}`
        })()

        const quantity = Math.max(1, Number(sale.quantity ?? 1) || 1)
        const price = Number(sale.price ?? 0)
        const totalUsd = getSaleUsdAmount(sale, rate)
        const item: SaleTicketItem = {
            name: sale.name,
            quantity,
            price,
            productId: sale.productId,
            points: sale.points,
        }
        const timestamp = getSaleTimestamp(sale) ?? new Date()
        const saleRate = resolveRate(sale.exchangeRate ?? null, rate, timestamp)
        const hasCoupon = (sale.source || "").toLowerCase().includes("coupon")
        const saleMethods = collectSaleMethods(sale)

        const existing = groups.get(groupId)
        if (!existing) {
            groups.set(groupId, {
                id: groupId,
                ticketId,
                createdAt: timestamp.toISOString(),
                items: [item],
                total: price * quantity,
                totalUsd,
                rate: saleRate,
                hasCoupon,
                methods: saleMethods,
                customerName: sale.customerName,
                customerPhone: sale.customerPhone,
                documentType: sale.documentType,
                documentNumber: sale.documentNumber,
                customerEmail: sale.customerEmail,
            })
            return
        }

        existing.items.push(item)
        existing.total += price * quantity
        existing.totalUsd += totalUsd
        existing.rate = existing.rate ?? saleRate
        existing.hasCoupon = existing.hasCoupon || hasCoupon
        // If existing group lacks customer info, but this sale has it, use it
        if (!existing.customerName && sale.customerName) {
            existing.customerName = sale.customerName
            existing.customerPhone = sale.customerPhone
            existing.documentType = sale.documentType
            existing.documentNumber = sale.documentNumber
            existing.customerEmail = sale.customerEmail
        }
        saleMethods.forEach((method) => {
            if (!existing.methods.includes(method)) existing.methods.push(method)
        })
        const existingTime = new Date(existing.createdAt).getTime()
        if (timestamp.getTime() > existingTime) {
            existing.createdAt = timestamp.toISOString()
        }
    })

    return Array.from(groups.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
}

export default function SalesSection({
    salesEvents = [],
    tickets = [],
    formatMoney,
    dailyRate,
    allowResetReports = true,
    onRegisterSale,
    onHardReset,
    onResetRangeApplied,
}: SalesSectionProps) {
    // --- STATE ---
    const [sales, setSales] = useState<SalesEvent[]>(salesEvents)
    const [expenses, setExpenses] = useState<Expense[]>([])
    const [expensesError, setExpensesError] = useState<string | null>(null)
    const [expenseStatus, setExpenseStatus] = useState<string | null>(null)
    const [expenseError, setExpenseError] = useState<string | null>(null)
    const [expenseSaving, setExpenseSaving] = useState(false)
    const [convertVesToUsd, setConvertVesToUsd] = useState(false)
    const [expenseForm, setExpenseForm] = useState({
        description: "",
        amount: "",
        currency: "USD",
        category: "operativo",
        paymentMethod: "efectivo_bs",
        occurredAt: "",
    })
    const [incomeStatus, setIncomeStatus] = useState<string | null>(null)
    const [incomeError, setIncomeError] = useState<string | null>(null)
    const [incomeSaving, setIncomeSaving] = useState(false)
    const [incomeForm, setIncomeForm] = useState({
        description: "",
        amount: "",
        currency: "USD",
        paymentMethod: "efectivo_usd",
    })
    const currency: "USD" | "VES" = "USD"
    const [topProductsSort, setTopProductsSort] = useState<"money" | "units">("money")
    const [showExpenseModal, setShowExpenseModal] = useState(false)
    const [showIncomeModal, setShowIncomeModal] = useState(false)
    const [showResetReportsModal, setShowResetReportsModal] = useState(false)
    const [resetMode, setResetMode] = useState<"all" | "period">("all")
    const [resetPeriodUnit, setResetPeriodUnit] = useState<ResetPeriodUnit>("days")
    const [resetPeriodDays, setResetPeriodDays] = useState("1")
    const [resetAnchorDate, setResetAnchorDate] = useState(() => {
        const now = new Date()
        const year = now.getFullYear()
        const month = String(now.getMonth() + 1).padStart(2, "0")
        const day = String(now.getDate()).padStart(2, "0")
        return `${year}-${month}-${day}`
    })
    const [resetCalendarMonth, setResetCalendarMonth] = useState(() => {
        const now = new Date()
        return new Date(now.getFullYear(), now.getMonth(), 1)
    })
    const [resetSubmitting, setResetSubmitting] = useState(false)
    const [resetError, setResetError] = useState<string | null>(null)
    const [incomeHistoryRange, setIncomeHistoryRange] = useState<TimeRange>("today")
    const [incomeHistoryOffset, setIncomeHistoryOffset] = useState(0)
    const [expenseHistoryRange, setExpenseHistoryRange] = useState<TimeRange>("today")
    const [expenseHistoryOffset, setExpenseHistoryOffset] = useState(0)
    const [showDayDetails, setShowDayDetails] = useState(false)
    const [selectedDay, setSelectedDay] = useState<DailyStat | null>(null)
    const [dayRange, setDayRange] = useState<"month" | "year">("month")
    const [dayRangeOffset, setDayRangeOffset] = useState(0)
    const [expandedMonthKey, setExpandedMonthKey] = useState<string | null>(null)

    const [range, setRange] = useState<TimeRange>("week")
    const [chartOffset, setChartOffset] = useState(0)
    const [chartMode, setChartMode] = useState<"gross" | "net">("gross")

    const [ticketSearchTerm, setTicketSearchTerm] = useState("")
    const [selectedTicket, setSelectedTicket] = useState<PaymentTicket | null>(null)
    const [selectedExpenseDetail, setSelectedExpenseDetail] = useState<Expense | null>(null)
    const dayDetailsCardRef = useRef<HTMLDivElement | null>(null)

    // Financial Analysis State
    const [financialSettings, setFinancialSettings] = useState<FinancialSettings>({ fixedExpenses: 0 })
    const [showFinancialSettings, setShowFinancialSettings] = useState(false)
    // Break-even State
    // Break-even State
    const [breakEvenRange, setBreakEvenRange] = useState<TimeRange>("year")
    const [breakEvenOffset, setBreakEvenOffset] = useState(0)
    const [recipes, setRecipes] = useState<Recipe[]>([])
    const [products, setProducts] = useState<any[]>([])

    useEffect(() => {
        const loadData = async () => {
            const token = readAuthToken()
            if (!token) return
            try {
                const [recipeData, productData] = await Promise.all([
                    fetchRecipes(token),
                    fetch(`${API_URL}/loyalty/products`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : [])
                ])
                setRecipes(Array.isArray(recipeData) ? recipeData : [])
                setProducts(Array.isArray(productData) ? productData : [])
            } catch (e) {
                console.error("Failed to load financial data", e)
            }
        }
        loadData()
    }, [])

    useEffect(() => {
        const loadSettings = async () => {
            const token = readAuthToken()
            try {
                const settings = await fetchFinancialSettings(token || "")
                setFinancialSettings(settings)
            } catch (e) {
                console.error("Failed to load financial settings", e)
            }
        }
        loadSettings()
    }, [])

    useEffect(() => {
        setBreakEvenOffset(0)
    }, [breakEvenRange])

    useEffect(() => {
        setChartOffset(0)
    }, [range])

    useEffect(() => {
        setDayRangeOffset(0)
        setExpandedMonthKey(null)
    }, [dayRange])

    useEffect(() => {
        setExpandedMonthKey(null)
    }, [dayRangeOffset])



    const periodLabel = useMemo(() => {
        const anchor = new Date()
        let start = new Date()
        let end = new Date()

        if (range === "today") {
            anchor.setDate(anchor.getDate() + chartOffset)
            return anchor.toLocaleDateString("es-VE", { weekday: 'short', day: 'numeric', month: 'short' })
        } else if (range === "week") {
            anchor.setDate(anchor.getDate() + (chartOffset * 7))
            start = startOfWeek(anchor)
            end = new Date(start)
            end.setDate(end.getDate() + 6)
            return `${start.getDate()} ${start.toLocaleDateString("es-VE", { month: 'short' })} - ${end.getDate()} ${end.toLocaleDateString("es-VE", { month: 'short' })}`
        } else if (range === "month") {
            anchor.setDate(1)
            anchor.setMonth(anchor.getMonth() + chartOffset)
            return anchor.toLocaleDateString("es-VE", { month: 'long', year: 'numeric' })
        } else if (range === "year") {
            anchor.setFullYear(anchor.getFullYear() + chartOffset)
            return anchor.getFullYear().toString()
        }
        return ""
    }, [range, chartOffset])

    const dayRangeMeta = useMemo(() => {
        const anchor = new Date()
        let start = new Date()
        let end = new Date()
        let label = ""

        if (dayRange === "month") {
            anchor.setDate(1)
            anchor.setMonth(anchor.getMonth() + dayRangeOffset)
            start = new Date(anchor)
            start.setHours(0, 0, 0, 0)
            end = new Date(start)
            end.setMonth(end.getMonth() + 1)
            end.setDate(0)
            end.setHours(23, 59, 59, 999)
            label = start.toLocaleDateString("es-VE", { month: "long", year: "numeric" })
        } else {
            anchor.setFullYear(anchor.getFullYear() + dayRangeOffset)
            start = new Date(anchor.getFullYear(), 0, 1)
            start.setHours(0, 0, 0, 0)
            end = new Date(anchor.getFullYear(), 11, 31, 23, 59, 59, 999)
            label = anchor.getFullYear().toString()
        }

        return {
            start,
            end,
            label,
            year: start.getFullYear(),
        }
    }, [dayRange, dayRangeOffset])

    useEffect(() => {
        if (salesEvents) setSales(salesEvents)
    }, [salesEvents])

    const ticketsById = useMemo(() => {
        const map = new Map<string, PaymentTicket>()
        tickets.forEach((ticket) => {
            const key = normalizeTicketId(ticket.id)
            if (key) map.set(key, ticket)
        })
        return map
    }, [tickets])

    const loadExpenses = useCallback(async () => {
        const token = readAuthToken()
        if (!token) return
        setExpensesError(null)
        try {
            const data = await fetchExpenses(token, { limit: FINANCE_RECORD_LIMIT })
            setExpenses(Array.isArray(data) ? data : [])
        } catch (err) {
            console.error("Error al cargar gastos", err)
            setExpensesError("No se pudieron cargar los gastos")
        }
    }, [])

    useEffect(() => {
        let active = true

        const run = async () => {
            if (!active) return
            await loadExpenses()
        }

        void run()

        const handleRefresh = () => {
            if (document.visibilityState !== "visible") return
            void run()
        }

        window.addEventListener("focus", handleRefresh)
        document.addEventListener("visibilitychange", handleRefresh)

        return () => {
            active = false
            window.removeEventListener("focus", handleRefresh)
            document.removeEventListener("visibilitychange", handleRefresh)
        }
    }, [loadExpenses])

    const [topProductsRange, setTopProductsRange] = useState<TimeRange>("week")
    const [topProductsOffset, setTopProductsOffset] = useState(0)

    // Activity Chart State

    const [activityRange, setActivityRange] = useState<TimeRange>("week")
    const [activityOffset, setActivityOffset] = useState(0)
    const [activityVisibleSeries, setActivityVisibleSeries] = useState<{
        transactions: boolean
        units: boolean
    }>({
        transactions: true,
        units: true
    })

    // Reset activity offset when range changes
    useEffect(() => {
        setActivityOffset(0)
    }, [activityRange])

    // Reset offset when range changes
    useEffect(() => {
        setTopProductsOffset(0)
    }, [topProductsRange])

    const topProductsData = useMemo(() => {
        const anchor = new Date()
        let start = new Date()
        let end = new Date()
        let label = ""

        if (topProductsRange === "today") {
            anchor.setDate(anchor.getDate() + topProductsOffset)
            start = new Date(anchor)
            start.setHours(0, 0, 0, 0)
            end = new Date(anchor)
            end.setHours(23, 59, 59, 999)
            label = start.toLocaleDateString("es-VE", { weekday: 'short', day: 'numeric', month: 'short' })
        } else if (topProductsRange === "week") {
            anchor.setDate(anchor.getDate() + (topProductsOffset * 7))
            start = startOfWeek(anchor)
            end = new Date(start)
            end.setDate(end.getDate() + 6)
            end.setHours(23, 59, 59, 999)
            // e.g "12 Ene - 18 Ene"
            label = `${start.getDate()} ${start.toLocaleDateString("es-VE", { month: 'short' })} - ${end.getDate()} ${end.toLocaleDateString("es-VE", { month: 'short' })}`
        } else if (topProductsRange === "month") {
            anchor.setDate(1)
            anchor.setMonth(anchor.getMonth() + topProductsOffset)
            start = new Date(anchor)
            start.setHours(0, 0, 0, 0)
            end = new Date(start)
            end.setMonth(end.getMonth() + 1)
            end.setDate(0)
            end.setHours(23, 59, 59, 999)
            label = start.toLocaleDateString("es-VE", { month: 'long', year: 'numeric' })
        } else if (topProductsRange === "year") {
            anchor.setFullYear(anchor.getFullYear() + topProductsOffset)
            start = new Date(anchor.getFullYear(), 0, 1)
            end = new Date(anchor.getFullYear(), 11, 31, 23, 59, 59)
            label = anchor.getFullYear().toString()
        }

        const filtered = sales.filter(s => {
            const t = new Date(s.scannedAt || s.occurredAt || "").getTime()
            return t >= start.getTime() && t <= end.getTime()
        })

        const tally = new Map<string, { name: string, qty: number, rev: number }>()
        filtered.forEach(s => {
            const k = s.productId || s.name
            const curr = tally.get(k) ?? { name: s.name, qty: 0, rev: 0 }
            const q = Number(s.quantity ?? 1)
            curr.qty += q
            curr.rev += Number(s.price ?? 0) * q
            tally.set(k, curr)
        })

        const sorted = Array.from(tally.values())
            .sort((a, b) => topProductsSort === 'money' ? b.rev - a.rev : b.qty - a.qty)
            .slice(0, 10)

        const maxVal = sorted.length > 0
            ? (topProductsSort === 'money' ? sorted[0].rev : sorted[0].qty)
            : 1

        return { list: sorted, maxVal, label }

    }, [sales, topProductsRange, topProductsOffset, topProductsSort])

    const activityData = useMemo(() => {
        const anchor = new Date()
        let start = new Date()
        let end = new Date()
        let label = ""

        if (activityRange === "today") {
            anchor.setDate(anchor.getDate() + activityOffset)
            start = new Date(anchor)
            start.setHours(0, 0, 0, 0)
            end = new Date(anchor)
            end.setHours(23, 59, 59, 999)
            label = start.toLocaleDateString("es-VE", { weekday: 'long', day: 'numeric', month: 'long' })
        } else if (activityRange === "week") {
            anchor.setDate(anchor.getDate() + (activityOffset * 7))
            start = startOfWeek(anchor)
            end = new Date(start)
            end.setDate(end.getDate() + 6)
            end.setHours(23, 59, 59, 999)
            label = `${start.getDate()} ${start.toLocaleDateString("es-VE", { month: 'short' })} - ${end.getDate()} ${end.toLocaleDateString("es-VE", { month: 'short' })}`
        } else if (activityRange === "month") {
            anchor.setDate(1)
            anchor.setMonth(anchor.getMonth() + activityOffset)
            start = new Date(anchor)
            start.setHours(0, 0, 0, 0)
            end = new Date(start)
            end.setMonth(end.getMonth() + 1)
            end.setDate(0)
            end.setHours(23, 59, 59, 999)
            label = start.toLocaleDateString("es-VE", { month: 'long', year: 'numeric' })
        } else if (activityRange === "year") {
            anchor.setFullYear(anchor.getFullYear() + activityOffset)
            start = new Date(anchor.getFullYear(), 0, 1)
            end = new Date(anchor.getFullYear(), 11, 31, 23, 59, 59)
            label = anchor.getFullYear().toString()
        }

        const filteredSales = sales.filter(s => {
            const date = getSaleTimestamp(s)
            if (!date) return false
            return date >= start && date <= end
        })

        const transactionTimes = buildSaleTicketGroups(filteredSales, dailyRate)
            .map((group) => ({
                ts: new Date(group.createdAt).getTime(),
                totalUsd: group.totalUsd
            }))
            .filter((t) => Number.isFinite(t.ts))

        // Grouping
        const points: { date: Date, label: string, transactions: number, units: number, revenueUsd: number }[] = []

        if (activityRange === "today") {
            // Group by Hour (0-23)
            for (let i = 8; i <= 22; i++) { // Operational hours approx
                const pointStart = new Date(start)
                pointStart.setHours(i, 0, 0, 0)
                const pointEnd = new Date(start)
                pointEnd.setHours(i, 59, 59, 999)

                const inBucket = filteredSales.filter(s => {
                    const d = getSaleTimestamp(s)
                    return d && d >= pointStart && d <= pointEnd
                })

                const units = inBucket.reduce((acc, s) => acc + (Number(s.quantity ?? 1) || 1), 0)
                const revenueUsd = inBucket.reduce((acc, s) => acc + getSaleUsdAmount(s, dailyRate), 0)

                const bucketStart = pointStart.getTime()
                const bucketEnd = pointEnd.getTime()
                let transactions = 0
                transactionTimes.forEach((t) => {
                    if (t.ts >= bucketStart && t.ts <= bucketEnd) transactions += 1
                })

                points.push({
                    date: pointStart,
                    label: `${i}:00`,
                    transactions,
                    units,
                    revenueUsd
                })
            }
        } else if (activityRange === "week" || activityRange === "month") {
            // Group by Day
            const days = activityRange === "week" ? 7 : new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()

            for (let i = 0; i < days; i++) {
                const day = new Date(start)
                day.setDate(day.getDate() + i)
                const dStart = new Date(day); dStart.setHours(0, 0, 0, 0)
                const dEnd = new Date(day); dEnd.setHours(23, 59, 59, 999)

                const inBucket = filteredSales.filter(s => {
                    const d = getSaleTimestamp(s)
                    return d && d >= dStart && d <= dEnd
                })

                const units = inBucket.reduce((acc, s) => acc + (Number(s.quantity ?? 1) || 1), 0)
                const revenueUsd = inBucket.reduce((acc, s) => acc + getSaleUsdAmount(s, dailyRate), 0)

                const bucketStart = dStart.getTime()
                const bucketEnd = dEnd.getTime()
                let transactions = 0
                transactionTimes.forEach((t) => {
                    if (t.ts >= bucketStart && t.ts <= bucketEnd) transactions += 1
                })

                points.push({
                    date: dStart,
                    label: `${day.getDate()}`,
                    transactions,
                    units,
                    revenueUsd
                })
            }
        } else {
            // Group by Month (Year view)
            for (let i = 0; i < 12; i++) {
                const mStart = new Date(start.getFullYear(), i, 1)
                const mEnd = new Date(start.getFullYear(), i + 1, 0, 23, 59, 59)

                const inBucket = filteredSales.filter(s => {
                    const d = getSaleTimestamp(s)
                    return d && d >= mStart && d <= mEnd
                })

                const units = inBucket.reduce((acc, s) => acc + (Number(s.quantity ?? 1) || 1), 0)
                const revenueUsd = inBucket.reduce((acc, s) => acc + getSaleUsdAmount(s, dailyRate), 0)

                const bucketStart = mStart.getTime()
                const bucketEnd = mEnd.getTime()
                let transactions = 0
                transactionTimes.forEach((t) => {
                    if (t.ts >= bucketStart && t.ts <= bucketEnd) transactions += 1
                })

                points.push({
                    date: mStart,
                    label: mStart.toLocaleDateString("es-VE", { month: 'short' }),
                    transactions,
                    units,
                    revenueUsd
                })
            }
        }

        const totalRevenueUsd = points.reduce((acc, p) => acc + p.revenueUsd, 0)

        // Calculate Break-Even Data
        // Calculate Break-Even Data
        const monthlyFixed = financialSettings.fixedExpenses || 0

        // Calculate Real Gross Profit based on Recipe Costs
        let totalRealGrossProfit = 0
        const recipeCostMap = new Map<string, number>()
        recipes.forEach(r => {
            const cost = calculateRecipeVariableCost(r)
            const yieldVal = Math.max(1, r.yield || 1)
            const unitCost = cost / yieldVal
            if (r.linkedProductId) recipeCostMap.set(r.linkedProductId, unitCost)
            recipeCostMap.set(r.name.toLowerCase(), unitCost)
        })

        // We use ALL filtered sales for this period to calculate the weighted average margin
        // This is more accurate than just using the displayed points
        filteredSales.forEach(s => {
            const revenue = getSaleUsdAmount(s, dailyRate)
            const qty = Number(s.quantity ?? 1) || 1

            // Find Cost
            let unitCost = 0
            if (s.productId && recipeCostMap.has(s.productId)) {
                unitCost = recipeCostMap.get(s.productId)!
            } else if (recipeCostMap.has((s.name || "").toLowerCase())) {
                unitCost = recipeCostMap.get(s.name.toLowerCase())!
            } else {
                // FALLBACK: Use Direct Product Cost if available
                const matchedProduct = products.find(p => p.id === s.productId)
                if (matchedProduct && matchedProduct.cost) {
                    unitCost = matchedProduct.cost
                }
            }

            const totalCost = unitCost * qty
            totalRealGrossProfit += (revenue - totalCost)
        })

        // Global Margin Ratio for this period
        const globalMargin = totalRevenueUsd > 0 ? totalRealGrossProfit / totalRevenueUsd : 1

        let periodFixedTarget = 0
        if (activityRange === 'today') periodFixedTarget = monthlyFixed / 30
        else if (activityRange === 'week') periodFixedTarget = (monthlyFixed * 12) / 52
        else if (activityRange === 'month') periodFixedTarget = monthlyFixed
        else if (activityRange === 'year') periodFixedTarget = monthlyFixed * 12

        const totalGrossProfit = totalRealGrossProfit
        const progress = periodFixedTarget > 0 ? Math.min(100, (totalGrossProfit / periodFixedTarget) * 100) : 100
        const remaining = Math.max(0, periodFixedTarget - totalGrossProfit)
        const profit = Math.max(0, totalGrossProfit - periodFixedTarget)

        return {
            points,
            label,
            totalTransactions: transactionTimes.length,
            totalUnits: filteredSales.reduce((acc, s) => acc + (Number(s.quantity ?? 1) || 1), 0),
            totalRevenueUsd,
            breakEven: {
                periodFixedTarget,
                totalGrossProfit,
                progress,
                remaining,
                profit,
                daysMet: points.filter(p => (p.revenueUsd * globalMargin) >= (activityRange === 'today' ? periodFixedTarget / 15 : periodFixedTarget / points.length)).length
            }
        }
    }, [sales, activityRange, activityOffset, dailyRate, financialSettings, recipes, products])

    const maxActivityValue = useMemo(() => {
        let max = 0
        activityData.points.forEach(p => {
            if (activityVisibleSeries.transactions) max = Math.max(max, p.transactions)
            if (activityVisibleSeries.units) max = Math.max(max, p.units)
        })
        return max > 0 ? max * 1.1 : 10 // Add 10% padding
    }, [activityData, activityVisibleSeries])

    const breakEvenData = useMemo(() => {
        const anchor = new Date()
        let start = new Date()
        let end = new Date()
        let label = ""

        if (breakEvenRange === "today") {
            anchor.setDate(anchor.getDate() + breakEvenOffset)
            start = new Date(anchor)
            start.setHours(0, 0, 0, 0)
            end = new Date(anchor)
            end.setHours(23, 59, 59, 999)
            label = start.toLocaleDateString("es-VE", { weekday: 'long', day: 'numeric', month: 'long' })
        } else if (breakEvenRange === "week") {
            anchor.setDate(anchor.getDate() + (breakEvenOffset * 7))
            start = startOfWeek(anchor)
            end = new Date(start)
            end.setDate(end.getDate() + 6)
            end.setHours(23, 59, 59, 999)
            label = `${start.getDate()} ${start.toLocaleDateString("es-VE", { month: 'short' })} - ${end.getDate()} ${end.toLocaleDateString("es-VE", { month: 'short' })}`
        } else if (breakEvenRange === "month") {
            anchor.setDate(1)
            anchor.setMonth(anchor.getMonth() + breakEvenOffset)
            start = new Date(anchor)
            start.setHours(0, 0, 0, 0)
            end = new Date(start)
            end.setMonth(end.getMonth() + 1)
            end.setDate(0)
            end.setHours(23, 59, 59, 999)
            label = start.toLocaleDateString("es-VE", { month: 'long', year: 'numeric' })
        } else if (breakEvenRange === "year") {
            anchor.setFullYear(anchor.getFullYear() + breakEvenOffset)
            start = new Date(anchor.getFullYear(), 0, 1)
            end = new Date(anchor.getFullYear(), 11, 31, 23, 59, 59)
            label = anchor.getFullYear().toString()
        }

        const filteredSales = sales.filter(s => {
            const date = getSaleTimestamp(s)
            if (!date) return false
            return date >= start && date <= end
        })

        // Prepare Cost Map once
        // Prepare Cost Map with breakdown
        const recipeCostMap = new Map<string, { material: number, operational: number }>()
        recipes.forEach(r => {
            const { totalCost, materialCost } = calculateRecipeCosts(r)
            const yieldVal = Math.max(1, r.yield || 1)

            const unitMaterial = materialCost / yieldVal
            const unitOperational = (totalCost - materialCost) / yieldVal

            const costs = { material: unitMaterial, operational: unitOperational }

            if (r.linkedProductId) recipeCostMap.set(r.linkedProductId, costs)
            recipeCostMap.set(r.name.toLowerCase(), costs)
        })

        const calculateGrossProfit = (salesItems: SalesEvent[], expensesItems: Expense[]) => {
            let gp = 0
            let totalMaterialCost = 0
            let totalRecipeOpCost = 0

            salesItems.forEach(s => {
                const revenue = getSaleUsdAmount(s, dailyRate)
                const qty = Number(s.quantity ?? 1) || 1

                let costs = { material: 0, operational: 0 }

                if (s.productId && recipeCostMap.has(s.productId)) {
                    costs = recipeCostMap.get(s.productId)!
                } else if (recipeCostMap.has((s.name || "").toLowerCase())) {
                    costs = recipeCostMap.get(s.name.toLowerCase())!
                } else {
                    // FALLBACK: Use Direct Product Cost
                    const matchedProduct = products.find(p => p.id === s.productId)
                    if (matchedProduct && matchedProduct.cost) {
                        costs = { material: matchedProduct.cost, operational: 0 }
                    }
                }

                const matCost = costs.material * qty
                const opCost = costs.operational * qty

                totalMaterialCost += matCost
                totalRecipeOpCost += opCost

                gp += (revenue - matCost)
            })

            const manualExpenses = expensesItems.reduce((acc, e) => acc + getExpenseUsdAmount(e, dailyRate), 0)

            return {
                grossProfit: gp,
                materialCost: totalMaterialCost,
                recipeOperationalCost: totalRecipeOpCost,
                manualExpenses
            }
        }

        const points: { date: Date; label: string; revenueUsd: number; grossProfit: number; manualExpenses: number; recipeMaterialCost: number; recipeOperationalCost: number }[] = []

        if (breakEvenRange === "today") {
            for (let i = 8; i <= 22; i++) {
                const pointStart = new Date(start)
                pointStart.setHours(i, 0, 0, 0)
                const pointEnd = new Date(start)
                pointEnd.setHours(i, 59, 59, 999)

                const inBucketSales = filteredSales.filter(s => {
                    const d = getSaleTimestamp(s)
                    return d && d >= pointStart && d <= pointEnd
                })

                const inBucketExpenses = expenses.filter(e => {
                    const d = getExpenseTimestamp(e)
                    return d && d >= pointStart && d <= pointEnd
                })

                const revenueUsd = inBucketSales.reduce((acc, s) => acc + getSaleUsdAmount(s, dailyRate), 0)
                const { grossProfit, materialCost, recipeOperationalCost, manualExpenses } = calculateGrossProfit(inBucketSales, inBucketExpenses)

                points.push({
                    date: pointStart,
                    label: `${i}:00`,
                    revenueUsd,
                    grossProfit,
                    manualExpenses,
                    recipeMaterialCost: materialCost,
                    recipeOperationalCost: recipeOperationalCost
                })
            }
        } else if (breakEvenRange === "week" || breakEvenRange === "month") {
            const days = breakEvenRange === "week" ? 7 : new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
            for (let i = 0; i < days; i++) {
                const day = new Date(start)
                day.setDate(day.getDate() + i)
                const dStart = new Date(day); dStart.setHours(0, 0, 0, 0)
                const dEnd = new Date(day); dEnd.setHours(23, 59, 59, 999)

                const inBucketSales = filteredSales.filter(s => {
                    const d = getSaleTimestamp(s)
                    return d && d >= dStart && d <= dEnd
                })

                const inBucketExpenses = expenses.filter(e => {
                    const d = getExpenseTimestamp(e)
                    return d && d >= dStart && d <= dEnd
                })

                const revenueUsd = inBucketSales.reduce((acc, s) => acc + getSaleUsdAmount(s, dailyRate), 0)
                const { grossProfit, materialCost, recipeOperationalCost, manualExpenses } = calculateGrossProfit(inBucketSales, inBucketExpenses)

                points.push({
                    date: dStart,
                    label: `${day.getDate()}`,
                    revenueUsd,
                    grossProfit,
                    manualExpenses,
                    recipeMaterialCost: materialCost,
                    recipeOperationalCost: recipeOperationalCost
                })
            }
        } else {
            for (let i = 0; i < 12; i++) {
                const mStart = new Date(start.getFullYear(), i, 1)
                const mEnd = new Date(start.getFullYear(), i + 1, 0, 23, 59, 59)

                const inBucketSales = filteredSales.filter(s => {
                    const d = getSaleTimestamp(s)
                    return d && d >= mStart && d <= mEnd
                })

                const inBucketExpenses = expenses.filter(e => {
                    const d = getExpenseTimestamp(e)
                    return d && d >= mStart && d <= mEnd
                })

                const revenueUsd = inBucketSales.reduce((acc, s) => acc + getSaleUsdAmount(s, dailyRate), 0)
                const { grossProfit, materialCost, recipeOperationalCost, manualExpenses } = calculateGrossProfit(inBucketSales, inBucketExpenses)

                points.push({
                    date: mStart,
                    label: mStart.toLocaleDateString("es-VE", { month: 'short' }),
                    revenueUsd,
                    grossProfit,
                    manualExpenses,
                    recipeMaterialCost: materialCost,
                    recipeOperationalCost: recipeOperationalCost
                })
            }
        }

        const totalRealGrossProfit = points.reduce((acc, p) => acc + p.grossProfit, 0)

        const monthlyFixed = financialSettings.fixedExpenses || 0

        let periodFixedTarget = 0
        if (breakEvenRange === 'today') periodFixedTarget = monthlyFixed / 30
        else if (breakEvenRange === 'week') periodFixedTarget = (monthlyFixed * 12) / 52
        else if (breakEvenRange === 'month') periodFixedTarget = monthlyFixed
        else if (breakEvenRange === 'year') periodFixedTarget = monthlyFixed * 12

        const totalGrossProfit = totalRealGrossProfit
        // Fix: If profit is negative, progress should be 0.
        const progress = periodFixedTarget > 0 ? Math.max(0, Math.min(100, (totalGrossProfit / periodFixedTarget) * 100)) : (totalGrossProfit >= 0 ? 100 : 0)
        const remaining = Math.max(0, periodFixedTarget - totalGrossProfit)
        const profit = Math.max(0, totalGrossProfit - periodFixedTarget)

        return {
            points,
            label,
            periodFixedTarget,
            totalGrossProfit,
            progress,
            remaining,
            profit
        }
    }, [sales, expenses, breakEvenRange, breakEvenOffset, dailyRate, financialSettings, recipes, products])



    const formatActivityTick = (value: number) => {
        if (value >= 10) return String(Math.round(value))
        return String(Math.round(value * 10) / 10)
    }



    const summaryChartData = useMemo(() => {
        const anchor = new Date()
        let start = new Date()
        let end = new Date()
        let bucketCount = 0
        const bucketStarts: Date[] = []
        const labels: string[] = []

        if (range === "today") {
            anchor.setDate(anchor.getDate() + chartOffset)
            start = new Date(anchor)
            start.setHours(0, 0, 0, 0)
            end = new Date(anchor)
            end.setHours(23, 59, 59, 999)
            bucketCount = 24
            for (let hour = 0; hour < 24; hour++) {
                const bucket = new Date(start)
                bucket.setHours(hour, 0, 0, 0)
                bucketStarts.push(bucket)
                const ampm = hour >= 12 ? "pm" : "am"
                const hour12 = hour % 12 || 12
                labels.push(`${hour12} ${ampm}`)
            }
        } else if (range === "week") {
            anchor.setDate(anchor.getDate() + (chartOffset * 7))
            start = startOfWeek(anchor)
            start.setHours(0, 0, 0, 0)
            end = new Date(start)
            end.setDate(end.getDate() + 6)
            end.setHours(23, 59, 59, 999)
            bucketCount = 7
            for (let i = 0; i < 7; i++) {
                const day = new Date(start)
                day.setDate(day.getDate() + i)
                bucketStarts.push(day)
                labels.push(`${day.getDate()}`)
            }
        } else if (range === "month") {
            anchor.setDate(1)
            anchor.setMonth(anchor.getMonth() + chartOffset)
            start = new Date(anchor)
            start.setHours(0, 0, 0, 0)
            end = new Date(start)
            end.setMonth(end.getMonth() + 1)
            end.setDate(0)
            end.setHours(23, 59, 59, 999)
            bucketCount = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
            for (let i = 0; i < bucketCount; i++) {
                const day = new Date(start)
                day.setDate(day.getDate() + i)
                bucketStarts.push(day)
                labels.push(`${day.getDate()}`)
            }
        } else {
            anchor.setFullYear(anchor.getFullYear() + chartOffset)
            start = new Date(anchor.getFullYear(), 0, 1)
            end = new Date(anchor.getFullYear(), 11, 31, 23, 59, 59, 999)
            bucketCount = 12
            for (let i = 0; i < 12; i++) {
                const monthStart = new Date(anchor.getFullYear(), i, 1)
                bucketStarts.push(monthStart)
                labels.push(monthStart.toLocaleDateString("es-VE", { month: "short" }))
            }
        }

        const incomeBuckets = Array.from({ length: bucketCount }, () => 0)
        const expenseBuckets = Array.from({ length: bucketCount }, () => 0)

        const normalizeDay = (date: Date) =>
            new Date(date.getFullYear(), date.getMonth(), date.getDate())

        const resolveBucketIndex = (date: Date) => {
            if (range === "today") return date.getHours()
            if (range === "year") return date.getMonth()
            return Math.floor((normalizeDay(date).getTime() - start.getTime()) / 86400000)
        }

        sales.forEach((sale) => {
            const date = getSaleTimestamp(sale)
            if (!date || date < start || date > end) return
            const idx = resolveBucketIndex(date)
            if (idx < 0 || idx >= bucketCount) return
            incomeBuckets[idx] += getSaleUsdAmount(sale, dailyRate)
        })

        expenses.forEach((expense) => {
            const date = getExpenseTimestamp(expense)
            if (!date || date < start || date > end) return
            const idx = resolveBucketIndex(date)
            if (idx < 0 || idx >= bucketCount) return
            expenseBuckets[idx] += getExpenseUsdAmount(expense, dailyRate)
        })

        const points: SummaryChartPoint[] = bucketStarts.map((date, index) => {
            const incomeUsd = incomeBuckets[index] ?? 0
            const expenseUsd = expenseBuckets[index] ?? 0
            return {
                date,
                label: labels[index] ?? "",
                incomeUsd,
                expenseUsd,
                netUsd: incomeUsd - expenseUsd,
            }
        })

        return { points, rangeStart: start, rangeEnd: end }
    }, [sales, expenses, dailyRate, range, chartOffset])

    const summaryChartStats = useMemo(() => {
        const points = summaryChartData.points
        const rangeStart = summaryChartData.rangeStart
        const rangeEnd = summaryChartData.rangeEnd
        let grossMax = 0
        let grossTotal = 0
        let netMin = 0
        let netMax = 0
        let totalIncomeVes = 0
        let totalExpenseVes = 0
        let totalIncomeUsd = 0
        let totalExpenseUsd = 0

        points.forEach((point) => {
            grossMax = Math.max(grossMax, point.incomeUsd, point.expenseUsd)
            netMin = Math.min(netMin, point.netUsd)
            netMax = Math.max(netMax, point.netUsd)
            grossTotal += point.incomeUsd + point.expenseUsd
        })

        if (rangeStart && rangeEnd) {
            sales.forEach((sale) => {
                const date = getSaleTimestamp(sale)
                if (!date || date < rangeStart || date > rangeEnd) return
                const totals = getSaleCurrencyTotals(sale, dailyRate)
                totalIncomeUsd += totals.usd
                totalIncomeVes += totals.ves
            })

            expenses.forEach((expense) => {
                const date = getExpenseTimestamp(expense)
                if (!date || date < rangeStart || date > rangeEnd) return
                const currencyCode = normalizeCurrency(expense.currency)
                const amount = safeNumber(expense.amount)
                if (currencyCode === "VES") {
                    totalExpenseVes += amount
                    return
                }
                totalExpenseUsd += amount
            })
        }

        const grossScale = grossMax > 0 ? grossMax * 1.1 : 1
        if (netMin === netMax) {
            netMin -= 1
            netMax += 1
        }
        const netRange = netMax - netMin
        const padding = netRange * 0.1
        netMin -= padding
        netMax += padding
        const netSpan = netMax - netMin || 1
        const zeroLine = SUMMARY_CHART_HEIGHT - ((0 - netMin) / netSpan) * SUMMARY_CHART_HEIGHT

        return {
            grossMax: grossScale,
            netMin,
            netMax,
            netSpan,
            zeroLine,
            hasData: grossTotal > 0,
            totalIncomeConverted: points.reduce((acc, p) => acc + p.incomeUsd, 0),
            totalExpenseConverted: points.reduce((acc, p) => acc + p.expenseUsd, 0),
            totalNetConverted: points.reduce((acc, p) => acc + p.netUsd, 0),
            totalIncomeUsd,
            totalIncomeVes,
            totalExpenseUsd,
            totalExpenseVes,
            totalNetUsd: totalIncomeUsd - totalExpenseUsd,
            totalNetVes: totalIncomeVes - totalExpenseVes,
        }
    }, [summaryChartData.points, summaryChartData.rangeEnd, summaryChartData.rangeStart, sales, expenses, dailyRate])



    const formatSummaryTick = (value: number) => {
        const abs = Math.abs(value)
        const sign = value < 0 ? "-" : ""
        if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
        if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1).replace(/\.0$/, "")}k`
        return `${sign}${Math.round(abs)}`
    }





    const summaryTotals = useMemo(() => {
        const revenueUsd = sales.reduce((sum, sale) => sum + getSaleUsdAmount(sale, dailyRate), 0)
        const expensesUsd = expenses.reduce((sum, expense) => sum + getExpenseUsdAmount(expense, dailyRate), 0)
        return {
            revenueUsd,
            expensesUsd,
            netUsd: revenueUsd - expensesUsd,
        }
    }, [sales, expenses, dailyRate])

    const dailyStats = useMemo(() => {
        const byDay = new Map<string, DailyStat>()
        const salesByDay = new Map<string, SalesEvent[]>()
        const expensesByDay = new Map<string, Expense[]>()

        const getDayKey = (date: Date) => {
            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, "0")
            const day = String(date.getDate()).padStart(2, "0")
            return `${year}-${month}-${day}`
        }

        const normalizeDay = (date: Date) =>
            new Date(date.getFullYear(), date.getMonth(), date.getDate())

        const ensureDay = (date: Date) => {
            const normalized = normalizeDay(date)
            const key = getDayKey(normalized)
            const existing = byDay.get(key)
            if (existing) return existing
            const entry: DailyStat = {
                date: normalized,
                revenueUsd: 0,
                revenueVes: 0,
                expensesUsd: 0,
                expensesVes: 0,
                transactions: [],
            }
            byDay.set(key, entry)
            return entry
        }

        sales.forEach((sale) => {
            const date = getSaleTimestamp(sale)
            if (!date) return
            const entry = ensureDay(date)
            const totals = getSaleCurrencyTotals(sale, dailyRate)
            entry.revenueUsd += totals.usd
            entry.revenueVes += totals.ves
            const key = getDayKey(date)
            const list = salesByDay.get(key) ?? []
            list.push(sale)
            salesByDay.set(key, list)
        })

        expenses.forEach((expense) => {
            const date = getExpenseTimestamp(expense)
            if (!date) return
            const entry = ensureDay(date)
            const currencyCode = normalizeCurrency(expense.currency)
            const amount = safeNumber(expense.amount)
            if (currencyCode === "VES") {
                entry.expensesVes += amount
            } else {
                entry.expensesUsd += amount
            }
            const key = getDayKey(date)
            const list = expensesByDay.get(key) ?? []
            list.push(expense)
            expensesByDay.set(key, list)
        })

        const results = Array.from(byDay.entries()).map(([key, entry]) => {
            const salesForDay = salesByDay.get(key) ?? []
            const expensesForDay = expensesByDay.get(key) ?? []
            const saleGroups = buildSaleTicketGroups(salesForDay, dailyRate)

            const saleTransactions: DayTransaction[] = saleGroups.map((group) => ({
                kind: "sale",
                timestamp: new Date(group.createdAt).getTime(),
                items: group.items,
                total: group.totalUsd,
                ticketId: group.ticketId,
                fullDetail: group,
            }))

            const expenseTransactions: DayTransaction[] = expensesForDay.map((expense) => ({
                kind: "expense",
                timestamp: getExpenseTimestamp(expense)?.getTime() ?? 0,
                description: expense.description || "Gasto",
                amount: getExpenseUsdAmount(expense, dailyRate),
                expenseDetail: expense,
            }))

            const transactions = [...saleTransactions, ...expenseTransactions].sort(
                (a, b) => b.timestamp - a.timestamp,
            )

            return { ...entry, transactions }
        })

        return results.sort((a, b) => b.date.getTime() - a.date.getTime())
    }, [sales, expenses, dailyRate])

    const scopedDailyStats = useMemo(() => {
        const startTime = dayRangeMeta.start.getTime()
        const endTime = dayRangeMeta.end.getTime()
        return dailyStats.filter((day) => {
            const ts = day.date.getTime()
            return ts >= startTime && ts <= endTime
        })
    }, [dailyStats, dayRangeMeta])

    const findTicketForTransaction = useCallback((transaction: DayTransaction) => {
        if (!ticketsById.size) return null
        const candidates = [
            transaction.ticketId,
            transaction.fullDetail?.ticketId,
            parseTicketIdFromCode(transaction.fullDetail?.id ?? null),
        ]
        for (const candidate of candidates) {
            const key = normalizeTicketId(candidate)
            if (!key) continue
            const ticket = ticketsById.get(key)
            if (ticket) return ticket
        }
        return null
    }, [ticketsById])

    const resolveTransactionDisplayId = useCallback((transaction: DayTransaction) => {
        const direct = formatTicketDisplayId(transaction.ticketId)
        if (direct) return direct
        const fromDetail = formatTicketDisplayId(transaction.fullDetail?.ticketId)
        if (fromDetail) return fromDetail
        const parsed = formatTicketDisplayId(parseTicketIdFromCode(transaction.fullDetail?.id ?? null))
        if (parsed) return parsed
        const matched = findTicketForTransaction(transaction)
        const fromTicket = formatTicketDisplayId(matched?.id ?? null)
        if (fromTicket) return fromTicket
        const fallback = buildShortSaleId(transaction.fullDetail?.createdAt ?? transaction.timestamp)
        if (fallback) return fallback
        return null
    }, [findTicketForTransaction])

    const openSaleTicket = useCallback((transaction: DayTransaction) => {
        if (!transaction.fullDetail) return
        const transactionId = resolveTransactionDisplayId(transaction)
        const matchedTicket = findTicketForTransaction(transaction)
        if (matchedTicket) {
            const mergedTicket: PaymentTicket = {
                ...matchedTicket,
                exchangeRate: matchedTicket.exchangeRate ?? transaction.fullDetail.rate ?? null,
                customerName: matchedTicket.customerName || transaction.fullDetail.customerName || null,
                phone: matchedTicket.phone || transaction.fullDetail.customerPhone || "-",
                documentType: matchedTicket.documentType || (transaction.fullDetail.documentType as any) || "V",
                documentNumber: matchedTicket.documentNumber || transaction.fullDetail.documentNumber || "",
                customerEmail: matchedTicket.customerEmail ?? transaction.fullDetail.customerEmail ?? null,
            }
            setSelectedTicket(mergedTicket)
            return
        }
        const mappedTicket: PaymentTicket = {
            id: transactionId || transaction.ticketId || transaction.fullDetail.ticketId || transaction.fullDetail.id,
            status: "confirmed",
            createdAt: transaction.fullDetail.createdAt,
            amount: transaction.fullDetail.totalUsd,
            currency: "USD",
            exchangeRate: transaction.fullDetail.rate,
            points: transaction.fullDetail.items.reduce((acc, it) => {
                const quantity = Number(it.quantity ?? 1) || 1
                const rawPoints = Number(it.points ?? 0)
                if (!Number.isFinite(rawPoints)) return acc
                const pointsPerUnit = Math.max(0, rawPoints)
                return acc + pointsPerUnit * Math.max(1, quantity)
            }, 0),
            items: transaction.fullDetail.items.map(it => ({
                name: it.name,
                quantity: it.quantity,
                price: it.price,
                productId: it.productId,
                points: it.points,
            })),
            bank: "-",
            phone: transaction.fullDetail.customerPhone || "-",
            documentType: (transaction.fullDetail.documentType as any) || "V",
            documentNumber: transaction.fullDetail.documentNumber || "",
            reference: "-",
            customerName: transaction.fullDetail.customerName || "Invitado",
            customerEmail: transaction.fullDetail.customerEmail,
        }
        setSelectedTicket(mappedTicket)
    }, [findTicketForTransaction, resolveTransactionDisplayId])

    const getTransactionSearchIds = useCallback((transaction: DayTransaction) => {
        const ids = new Set<string>()
        const displayId = resolveTransactionDisplayId(transaction)
        if (displayId) ids.add(displayId)
        const rawId = transaction.ticketId
            || transaction.fullDetail?.ticketId
            || parseTicketIdFromCode(transaction.fullDetail?.id ?? null)
        const formatted = formatTicketDisplayId(rawId)
        if (formatted) ids.add(formatted)
        return Array.from(ids)
    }, [resolveTransactionDisplayId])

    const matchesTicketSearch = useCallback((transaction: DayTransaction, query: string) => {
        if (transaction.kind !== "sale") return false
        if (!query) return true
        return getTransactionSearchIds(transaction).some((id) =>
            normalizeSearchValue(id).startsWith(query),
        )
    }, [getTransactionSearchIds])

    const ticketSearchQuery = useMemo(() => normalizeSearchValue(ticketSearchTerm), [ticketSearchTerm])

    const handleTransactionClick = useCallback((transaction: DayTransaction) => {
        if (transaction.kind === "sale") {
            openSaleTicket(transaction)
            return
        }
        if (transaction.expenseDetail) {
            setSelectedExpenseDetail(transaction.expenseDetail)
        }
    }, [openSaleTicket])

    const filteredTransactions = useMemo(() => {
        if (!selectedDay) return [] as DayTransaction[]
        if (!ticketSearchQuery) return selectedDay.transactions
        return selectedDay.transactions.filter((t) => matchesTicketSearch(t, ticketSearchQuery))
    }, [selectedDay, ticketSearchQuery, matchesTicketSearch])

    const selectedDayNet = useMemo(() => {
        if (!selectedDay) return { netVes: 0, netUsd: 0 }
        return {
            netVes: selectedDay.revenueVes - selectedDay.expensesVes,
            netUsd: selectedDay.revenueUsd - selectedDay.expensesUsd,
        }
    }, [selectedDay])

    const filteredDailyStats = useMemo(() => {
        if (!ticketSearchQuery) return scopedDailyStats
        return scopedDailyStats.filter((day) =>
            day.transactions.some((t) => matchesTicketSearch(t, ticketSearchQuery)),
        )
    }, [scopedDailyStats, ticketSearchQuery, matchesTicketSearch])

    const getDayMatchIds = useCallback((day: DailyStat, query: string) => {
        if (!query) return [] as string[]
        const matches = day.transactions
            .filter((t) => matchesTicketSearch(t, query))
            .map((t) => resolveTransactionDisplayId(t) || getTransactionSearchIds(t)[0])
            .filter((id): id is string => Boolean(id))
        const unique = Array.from(new Set(matches))
        unique.sort((a, b) =>
            normalizeSearchValue(a).localeCompare(normalizeSearchValue(b), "es", { numeric: true }),
        )
        return unique
    }, [matchesTicketSearch, resolveTransactionDisplayId, getTransactionSearchIds])

    const formatVesAmount = (amountVes: number) => formatVesLabel(amountVes)

    const formatMethodAmount = (method: string, amountUsd: number, amountVes: number) => {
        if (VES_METHODS.has(method)) return formatVesAmount(amountVes)
        return formatMoney(amountUsd)
    }

    const canConvertVes = Number.isFinite(dailyRate) && dailyRate > 0

    const formatDailyVes = useCallback((amountVes: number) => {
        const safeAmount = safeNumber(amountVes)
        if (convertVesToUsd && canConvertVes) {
            return formatMoney(convertVesToUsdValue(safeAmount, dailyRate))
        }
        return formatVesLabel(safeAmount)
    }, [convertVesToUsd, dailyRate, canConvertVes, formatMoney])

    const resolveDayFromSummaryPoint = useCallback((pointDate: Date) => {
        const normalized = new Date(pointDate.getFullYear(), pointDate.getMonth(), pointDate.getDate())
        const exact = dailyStats.find((day) => isSameDay(day.date, normalized))
        if (exact) return exact
        if (range === "year") {
            const sameMonth = dailyStats.filter(
                (day) =>
                    day.date.getFullYear() === pointDate.getFullYear()
                    && day.date.getMonth() === pointDate.getMonth(),
            )
            if (sameMonth.length) {
                return sameMonth.reduce((latest, day) =>
                    day.date.getTime() > latest.date.getTime() ? day : latest,
                )
            }
        }
        return {
            date: normalized,
            revenueUsd: 0,
            revenueVes: 0,
            expensesUsd: 0,
            expensesVes: 0,
            transactions: [],
        }
    }, [dailyStats, range])

    const monthGroups = useMemo(() => {
        const map = new Map<string, { key: string; date: Date; days: DailyStat[]; revenueUsd: number; revenueVes: number; expensesUsd: number; expensesVes: number }>()
        filteredDailyStats.forEach((day) => {
            const monthKey = `${day.date.getFullYear()}-${String(day.date.getMonth() + 1).padStart(2, "0")}`
            const existing = map.get(monthKey)
            if (existing) {
                existing.days.push(day)
                existing.revenueUsd += day.revenueUsd
                existing.revenueVes += day.revenueVes
                existing.expensesUsd += day.expensesUsd
                existing.expensesVes += day.expensesVes
                return
            }
            map.set(monthKey, {
                key: monthKey,
                date: new Date(day.date.getFullYear(), day.date.getMonth(), 1),
                days: [day],
                revenueUsd: day.revenueUsd,
                revenueVes: day.revenueVes,
                expensesUsd: day.expensesUsd,
                expensesVes: day.expensesVes,
            })
        })

        return Array.from(map.values())
            .map((group) => ({
                ...group,
                days: group.days.sort((a, b) => b.date.getTime() - a.date.getTime()),
            }))
            .sort((a, b) => b.date.getTime() - a.date.getTime())
    }, [filteredDailyStats])

    const renderDayCard = useCallback((day: DailyStat) => {
        const netUsd = day.revenueUsd - day.expensesUsd
        const netVes = day.revenueVes - day.expensesVes
        const dayMatches = ticketSearchQuery ? getDayMatchIds(day, ticketSearchQuery) : []
        const shownMatches = dayMatches.slice(0, 3)
        const extraMatches = dayMatches.length - shownMatches.length

        return (
            <div
                key={day.date.toISOString()}
                onClick={() => {
                    setSelectedDay(day)
                    setShowDayDetails(true)
                }}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-indigo-100 hover:shadow-sm transition-all flex justify-between items-center group cursor-pointer"
            >
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white flex flex-col items-center justify-center text-slate-500 border border-slate-200 shadow-sm group-hover:scale-105 transition-transform">
                        <span className="text-[9px] uppercase font-bold text-indigo-400">{day.date.toLocaleDateString('es-VE', { weekday: 'short' })}</span>
                        <span className="text-lg font-black text-slate-800 leading-none">{day.date.getDate()}</span>
                    </div>
                    <div>
                        <p className="font-bold text-slate-700 text-sm capitalize">{day.date.toLocaleDateString('es-VE', { month: 'long' })}</p>
                        <div className="flex flex-col gap-1 text-[10px] uppercase font-bold text-slate-400">
                            <div className="flex gap-2">
                                <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                    <ArrowUpRight size={10} />
                                    <span className="whitespace-nowrap">{formatDailyVes(day.revenueVes)}</span>
                                </div>
                                <div className="flex items-center gap-1 text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                                    <ArrowDownRight size={10} />
                                    <span className="whitespace-nowrap">{formatDailyVes(day.expensesVes)}</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                    <ArrowUpRight size={10} />
                                    <span className="whitespace-nowrap">{formatMoney(day.revenueUsd)}</span>
                                </div>
                                <div className="flex items-center gap-1 text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                                    <ArrowDownRight size={10} />
                                    <span className="whitespace-nowrap">{formatMoney(day.expensesUsd)}</span>
                                </div>
                            </div>
                        </div>
                        {ticketSearchQuery && dayMatches.length > 0 && (
                            <div className="mt-1 flex flex-wrap items-center gap-1 text-[9px] font-bold text-slate-500">
                                <span className="uppercase text-slate-400">Coincidencias:</span>
                                {shownMatches.map((match) => (
                                    <span key={match} className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                                        #{match}
                                    </span>
                                ))}
                                {extraMatches > 0 && (
                                    <span className="text-slate-400">+{extraMatches}</span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Total Neto</p>
                    <div className="flex flex-col items-end gap-0.5">
                        <span className={`font-black text-lg ${netVes >= 0 ? "text-slate-900" : "text-rose-500"}`}>
                            {formatDailyVes(netVes)}
                        </span>
                        <span className={`text-[11px] font-bold ${netUsd >= 0 ? "text-slate-600" : "text-rose-500"}`}>
                            {formatMoney(netUsd)}
                        </span>
                    </div>
                </div>
            </div>
        )
    }, [formatDailyVes, formatMoney, getDayMatchIds, ticketSearchQuery, setSelectedDay, setShowDayDetails])

    const dayListIsEmpty = dayRange === "year" ? monthGroups.length === 0 : filteredDailyStats.length === 0

    const paymentSummary = useMemo(() => {
        const byMethod = new Map<string, { method: string; incomeUsd: number; incomeVes: number; expenseUsd: number; expenseVes: number }>()
        PAYMENT_METHODS.forEach((method) => {
            byMethod.set(method.id, { method: method.id, incomeUsd: 0, incomeVes: 0, expenseUsd: 0, expenseVes: 0 })
        })

        const ensure = (method: string) => {
            const existing = byMethod.get(method)
            if (existing) return existing
            const created = { method, incomeUsd: 0, incomeVes: 0, expenseUsd: 0, expenseVes: 0 }
            byMethod.set(method, created)
            return created
        }

        sales.forEach((sale) => {
            const movements = collectSalePaymentMovements(sale, dailyRate)
            if (movements.length) {
                movements.forEach((entry) => {
                    const target = ensure(entry.method)
                    if (entry.kind === "expense") {
                        target.expenseUsd += entry.amountUsd
                        if (VES_METHODS.has(entry.method)) {
                            target.expenseVes += entry.amountVes
                        }
                    } else {
                        target.incomeUsd += entry.amountUsd
                        if (VES_METHODS.has(entry.method)) {
                            target.incomeVes += entry.amountVes
                        }
                    }
                })
                return
            }

            const allocations = collectSaleMethodAmounts(sale, dailyRate)
            if (!allocations.length) return
            allocations.forEach((entry) => {
                const target = ensure(entry.method)
                target.incomeUsd += entry.amountUsd
                if (VES_METHODS.has(entry.method)) {
                    target.incomeVes += entry.amountVes
                }
            })
        })

        expenses.forEach((expense) => {
            const totalRaw = safeNumber(expense.amount)
            if (totalRaw <= 0) return
            const currencyCode = normalizeCurrency(expense.currency)
            const method = expense.paymentMethod
                ? normalizePaymentMethod(expense.paymentMethod)
                : ""
            if (!method) return

            let totalUsd = totalRaw
            let totalVes = 0
            if (currencyCode === "VES") {
                const rate = resolveRate(expense.exchangeRate ?? null, dailyRate, getExpenseTimestamp(expense))
                totalVes = totalRaw
                totalUsd = rate ? totalRaw / rate : 0
            }

            const target = ensure(method)
            target.expenseUsd += totalUsd
            if (currencyCode === "VES" && VES_METHODS.has(method)) {
                target.expenseVes += totalVes
            }
        })

        const entries = Array.from(byMethod.values()).map((entry) => ({
            ...entry,
            netUsd: entry.incomeUsd - entry.expenseUsd,
            netVes: entry.incomeVes - entry.expenseVes,
        }))

        const methodOrder = PAYMENT_METHODS.map((method) => method.id)
        const sorted = [
            ...methodOrder
                .map((id) => entries.find((entry) => entry.method === id))
                .filter((entry): entry is (typeof entries)[number] => Boolean(entry)),
            ...entries.filter((entry) => !methodOrder.includes(entry.method as any)),
        ]

        return {
            entries: sorted,
            totalIncomeUsd: summaryTotals.revenueUsd,
            totalExpenseUsd: summaryTotals.expensesUsd,
            totalNetUsd: summaryTotals.netUsd,
        }
    }, [sales, expenses, dailyRate, summaryTotals.expensesUsd, summaryTotals.netUsd, summaryTotals.revenueUsd])

    const currencyTotals = useMemo(() => {
        const totals = {
            incomeUsd: 0,
            expenseUsd: 0,
            incomeVes: 0,
            expenseVes: 0,
            incomeVesUsd: 0,
            expenseVesUsd: 0,
            bankVes: 0,
            bankVesUsd: 0,
            bankUsd: 0,
            cashVes: 0,
            cashVesUsd: 0,
            cashUsd: 0,
            unclassifiedUsd: 0,
            unclassifiedVes: 0,
            unclassifiedVesUsd: 0,
        }

        const BANK_METHODS_VES = new Set(["punto", "transferencia", "pago_movil"])
        const BANK_METHODS_USD = new Set(["zelle"])
        const CASH_METHODS_VES = new Set(["efectivo_bs"])
        const CASH_METHODS_USD = new Set(["efectivo_usd"])

        paymentSummary.entries.forEach((entry) => {
            if (USD_METHODS.has(entry.method)) {
                totals.incomeUsd += entry.incomeUsd
                totals.expenseUsd += entry.expenseUsd
            } else if (VES_METHODS.has(entry.method)) {
                totals.incomeVes += entry.incomeVes
                totals.expenseVes += entry.expenseVes
                totals.incomeVesUsd += entry.incomeUsd
                totals.expenseVesUsd += entry.expenseUsd
            } else {
                totals.incomeUsd += entry.incomeUsd
                totals.expenseUsd += entry.expenseUsd
            }

            if (BANK_METHODS_VES.has(entry.method)) {
                totals.bankVes += entry.netVes
                totals.bankVesUsd += entry.netUsd
            }
            if (BANK_METHODS_USD.has(entry.method)) {
                totals.bankUsd += entry.netUsd
            }
            if (CASH_METHODS_VES.has(entry.method)) {
                totals.cashVes += entry.netVes
                totals.cashVesUsd += entry.netUsd
            }
            if (CASH_METHODS_USD.has(entry.method)) {
                totals.cashUsd += entry.netUsd
            }
            if (entry.method === UNCLASSIFIED_USD_METHOD) {
                totals.unclassifiedUsd += entry.netUsd
            }
            if (entry.method === UNCLASSIFIED_VES_METHOD) {
                totals.unclassifiedVes += entry.netVes
                totals.unclassifiedVesUsd += entry.netUsd
            }
        })

        return {
            ...totals,
            netUsd: totals.incomeUsd - totals.expenseUsd,
            netVes: totals.incomeVes - totals.expenseVes,
            netVesUsd: totals.incomeVesUsd - totals.expenseVesUsd,
        }
    }, [paymentSummary.entries])

    const hasUnclassifiedCash =
        Math.abs(currencyTotals.unclassifiedUsd) > 0.009 ||
        Math.abs(currencyTotals.unclassifiedVes) > 0.009

    const todayCashVsFinance = useMemo(() => {
        const today = new Date()
        const salesToday = sales.filter((sale) => {
            const date = getSaleTimestamp(sale)
            return Boolean(date && isSameDay(date, today))
        })
        const expensesToday = expenses.filter((expense) => {
            const date = getExpenseTimestamp(expense)
            return Boolean(date && isSameDay(date, today))
        })
        const confirmedTicketsToday = tickets.filter((ticket) => {
            if (ticket.status !== "confirmed") return false
            const rawDate = ticket.confirmedAt ?? ticket.createdAt
            const date = rawDate ? new Date(rawDate) : null
            return Boolean(date && !Number.isNaN(date.getTime()) && isSameDay(date, today))
        })

        const saleTicketIds = new Set<string>()
        salesToday.forEach((sale) => {
            const candidates = [sale.code, ...(sale.codes ?? [])]
            candidates.forEach((code) => {
                const parsed = parseTicketIdFromCode(code)
                if (parsed) saleTicketIds.add(parsed)
            })
        })

        const confirmedTicketIds = confirmedTicketsToday
            .map((ticket) => normalizeTicketId(ticket.id))
            .filter((id): id is string => Boolean(id))
        const missingTicketIds = confirmedTicketIds.filter((id) => !saleTicketIds.has(id))

        const ticketEquivalentUsd = confirmedTicketsToday.reduce((sum, ticket) => {
            const amount = safeNumber(ticket.amount)
            const currency = normalizeCurrency(ticket.currency)
            if (currency !== "VES") return sum + amount
            const rawDate = ticket.confirmedAt ?? ticket.createdAt
            const parsedDate = rawDate ? new Date(rawDate) : null
            const rate = resolveRate(ticket.exchangeRate ?? null, dailyRate, parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null)
            return sum + (rate ? amount / rate : 0)
        }, 0)
        const salesEquivalentUsd = salesToday.reduce((sum, sale) => sum + getSaleUsdAmount(sale, dailyRate), 0)
        const reconciliation = buildCashReconciliation(salesToday, expensesToday, dailyRate)

        return {
            salesCount: salesToday.length,
            confirmedTicketCount: confirmedTicketsToday.length,
            missingTicketIds,
            ticketEquivalentUsd,
            salesEquivalentUsd,
            expectedUsd: reconciliation.totals.expectedUsd,
            expectedVes: reconciliation.totals.expectedVes,
            differenceCount: reconciliation.totals.differenceCount,
        }
    }, [dailyRate, expenses, sales, tickets])

    const manualIncomeSales = useMemo(() => {
        const manualSales = sales.filter((sale) => {
            const source = (sale.source || "").toLowerCase()
            return source.startsWith("manual-income")
        })
        return buildSaleTicketGroups(manualSales, dailyRate)
    }, [sales, dailyRate])

    const filteredIncomeSales = useMemo(() => {
        const anchor = new Date()
        let start = new Date()
        let end = new Date()
        let label = ""

        if (incomeHistoryRange === "today") {
            anchor.setDate(anchor.getDate() + incomeHistoryOffset)
            start = new Date(anchor)
            start.setHours(0, 0, 0, 0)
            end = new Date(anchor)
            end.setHours(23, 59, 59, 999)
            label = start.toLocaleDateString("es-VE", { weekday: 'short', day: 'numeric', month: 'short' })
        } else if (incomeHistoryRange === "week") {
            anchor.setDate(anchor.getDate() + (incomeHistoryOffset * 7))
            start = startOfWeek(anchor)
            end = new Date(start)
            end.setDate(end.getDate() + 6)
            end.setHours(23, 59, 59, 999)
            label = `${start.getDate()} ${start.toLocaleDateString("es-VE", { month: 'short' })} - ${end.getDate()} ${end.toLocaleDateString("es-VE", { month: 'short' })}`
        } else if (incomeHistoryRange === "month") {
            anchor.setDate(1)
            anchor.setMonth(anchor.getMonth() + incomeHistoryOffset)
            start = new Date(anchor)
            start.setHours(0, 0, 0, 0)
            end = new Date(start)
            end.setMonth(end.getMonth() + 1)
            end.setDate(0)
            end.setHours(23, 59, 59, 999)
            label = start.toLocaleDateString("es-VE", { month: 'long', year: 'numeric' })
        } else if (incomeHistoryRange === "year") {
            anchor.setFullYear(anchor.getFullYear() + incomeHistoryOffset)
            start = new Date(anchor.getFullYear(), 0, 1)
            end = new Date(anchor.getFullYear(), 11, 31, 23, 59, 59)
            label = anchor.getFullYear().toString()
        }

        const list = manualIncomeSales.filter((sale) => {
            const createdAt = new Date(sale.createdAt)
            return createdAt >= start && createdAt <= end
        })

        return { list, label }
    }, [incomeHistoryRange, incomeHistoryOffset, manualIncomeSales])

    const filteredRecentExpenses = useMemo(() => {
        const anchor = new Date()
        let start = new Date()
        let end = new Date()
        let label = ""

        if (expenseHistoryRange === "today") {
            anchor.setDate(anchor.getDate() + expenseHistoryOffset)
            start = new Date(anchor)
            start.setHours(0, 0, 0, 0)
            end = new Date(anchor)
            end.setHours(23, 59, 59, 999)
            label = start.toLocaleDateString("es-VE", { weekday: 'short', day: 'numeric', month: 'short' })
        } else if (expenseHistoryRange === "week") {
            anchor.setDate(anchor.getDate() + (expenseHistoryOffset * 7))
            start = startOfWeek(anchor)
            end = new Date(start)
            end.setDate(end.getDate() + 6)
            end.setHours(23, 59, 59, 999)
            label = `${start.getDate()} ${start.toLocaleDateString("es-VE", { month: 'short' })} - ${end.getDate()} ${end.toLocaleDateString("es-VE", { month: 'short' })}`
        } else if (expenseHistoryRange === "month") {
            anchor.setDate(1)
            anchor.setMonth(anchor.getMonth() + expenseHistoryOffset)
            start = new Date(anchor)
            start.setHours(0, 0, 0, 0)
            end = new Date(start)
            end.setMonth(end.getMonth() + 1)
            end.setDate(0)
            end.setHours(23, 59, 59, 999)
            label = start.toLocaleDateString("es-VE", { month: 'long', year: 'numeric' })
        } else if (expenseHistoryRange === "year") {
            anchor.setFullYear(anchor.getFullYear() + expenseHistoryOffset)
            start = new Date(anchor.getFullYear(), 0, 1)
            end = new Date(anchor.getFullYear(), 11, 31, 23, 59, 59)
            label = anchor.getFullYear().toString()
        }

        const list = expenses
            .map((expense) => {
                const timestamp = getExpenseTimestamp(expense)
                return { expense, timestamp }
            })
            .filter((entry): entry is { expense: Expense; timestamp: Date } =>
                entry.timestamp !== null && entry.timestamp !== undefined && entry.timestamp >= start && entry.timestamp <= end
            )
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .map((entry) => entry.expense)

        return { list, label }
    }, [expenseHistoryRange, expenseHistoryOffset, expenses])

    const openExpenseForm = () => {
        setShowExpenseModal(true)
        setExpenseStatus(null)
        setExpenseError(null)
        setExpenseForm((prev) => ({
            ...prev,
            occurredAt: prev.occurredAt || (() => {
                const now = new Date()
                // Force Maracaibo Time (UTC-4)
                // We shift the time by -4 hours so .toISOString() (which prints UTC) 
                // outputs the wall-clock time of Maracaibo.
                const maracaiboOffsetMs = -4 * 60 * 60 * 1000
                const maracaiboDate = new Date(now.getTime() + maracaiboOffsetMs)
                return maracaiboDate.toISOString().slice(0, 16)
            })(),
        }))
    }

    const closeExpenseModal = () => {
        setShowExpenseModal(false)
    }

    const openIncomeModal = () => {
        setIncomeStatus(null)
        setIncomeError(null)
        setShowIncomeModal(true)
    }

    const closeIncomeModal = () => {
        setShowIncomeModal(false)
    }

    const resetAnchorDateValue = useMemo(
        () => parseDateInput(resetAnchorDate) ?? new Date(),
        [resetAnchorDate],
    )

    useEffect(() => {
        const next = new Date(resetAnchorDateValue.getFullYear(), resetAnchorDateValue.getMonth(), 1)
        setResetCalendarMonth((prev) => (
            prev.getFullYear() === next.getFullYear() && prev.getMonth() === next.getMonth()
                ? prev
                : next
        ))
    }, [resetAnchorDateValue])

    const resetRangePreview = useMemo(() => {
        const anchor = toDayStart(resetAnchorDateValue)
        const requestedDays = Number.parseInt(resetPeriodDays, 10)
        const days = Number.isFinite(requestedDays) ? Math.min(3650, Math.max(1, requestedDays)) : 1
        let start = toDayStart(anchor)
        let end = toDayEnd(anchor)
        let periodLabel = ""

        if (resetPeriodUnit === "days") {
            start.setDate(start.getDate() - (days - 1))
            start = toDayStart(start)
            end = toDayEnd(anchor)
            periodLabel = days === 1 ? "Dia seleccionado" : `${days} dias hasta la fecha seleccionada`
        } else if (resetPeriodUnit === "week") {
            start = toDayStart(startOfWeek(anchor))
            const weekEnd = new Date(start)
            weekEnd.setDate(weekEnd.getDate() + 6)
            end = toDayEnd(weekEnd)
            periodLabel = "Semana de la fecha seleccionada"
        } else if (resetPeriodUnit === "month") {
            start = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 0, 0, 0, 0)
            end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59, 999)
            periodLabel = "Mes de la fecha seleccionada"
        } else {
            start = new Date(anchor.getFullYear(), 0, 1, 0, 0, 0, 0)
            end = new Date(anchor.getFullYear(), 11, 31, 23, 59, 59, 999)
            periodLabel = "Ano de la fecha seleccionada"
        }

        return { start, end, periodLabel, days }
    }, [resetAnchorDateValue, resetPeriodDays, resetPeriodUnit])

    const resetCalendarDays = useMemo(() => {
        const monthStart = new Date(resetCalendarMonth.getFullYear(), resetCalendarMonth.getMonth(), 1)
        const gridStart = startOfWeek(monthStart)
        const rangeStart = toDayStart(resetRangePreview.start).getTime()
        const rangeEnd = toDayStart(resetRangePreview.end).getTime()

        return Array.from({ length: 42 }, (_, index) => {
            const date = new Date(gridStart)
            date.setDate(gridStart.getDate() + index)
            const dateTs = toDayStart(date).getTime()
            return {
                date,
                dateTs,
                inCurrentMonth: date.getMonth() === resetCalendarMonth.getMonth(),
                isAnchor: isSameDay(date, resetAnchorDateValue),
                inSelectedRange: dateTs >= rangeStart && dateTs <= rangeEnd,
                isRangeStart: isSameDay(date, resetRangePreview.start),
                isRangeEnd: isSameDay(date, resetRangePreview.end),
                isToday: isSameDay(date, new Date()),
            }
        })
    }, [resetCalendarMonth, resetRangePreview.end, resetRangePreview.start, resetAnchorDateValue])

    const resetCalendarLabel = useMemo(
        () => resetCalendarMonth.toLocaleDateString("es-VE", { month: "long", year: "numeric" }),
        [resetCalendarMonth],
    )

    const openResetReportsModal = () => {
        const anchor = parseDateInput(resetAnchorDate) ?? new Date()
        setResetCalendarMonth(new Date(anchor.getFullYear(), anchor.getMonth(), 1))
        setResetError(null)
        setShowResetReportsModal(true)
    }

    const closeResetReportsModal = () => {
        if (resetSubmitting) return
        setShowResetReportsModal(false)
        setResetError(null)
    }

    const handleResetReports = async () => {
        const token = readAuthToken()
        if (!token) {
            setResetError("No se encontro sesion activa")
            return
        }

        const payload: ResetDataPayload =
            resetMode === "all"
                ? { mode: "all" }
                : {
                    mode: "range",
                    start: resetRangePreview.start.toISOString(),
                    end: resetRangePreview.end.toISOString(),
                }

        const confirmMessage =
            resetMode === "all"
                ? "ADVERTENCIA: Esto reinicia ventas y gastos del panel admin. El historial de tickets y pedidos de clientes no se borra. Deseas continuar?"
                : `Se borraran ventas y gastos entre ${resetRangePreview.start.toLocaleDateString("es-VE")} y ${resetRangePreview.end.toLocaleDateString("es-VE")}. Deseas continuar?`
        if (!window.confirm(confirmMessage)) return

        setResetSubmitting(true)
        setResetError(null)

        try {
            const result = await resetData(token, payload)

            if (result.mode === "all") {
                if (onHardReset) onHardReset()
                setSales([])
                setExpenses([])
            } else {
                const startIso = result.start ?? payload.start
                const endIso = result.end ?? payload.end
                const startTs = startIso ? new Date(startIso).getTime() : Number.NaN
                const endTs = endIso ? new Date(endIso).getTime() : Number.NaN
                if (Number.isFinite(startTs) && Number.isFinite(endTs)) {
                    setSales((prev) =>
                        prev.filter((sale) => {
                            const timestamp = getSaleTimestamp(sale)?.getTime()
                            if (typeof timestamp !== "number" || Number.isNaN(timestamp)) return true
                            return timestamp < startTs || timestamp > endTs
                        }),
                    )
                    setExpenses((prev) =>
                        prev.filter((expense) => {
                            const timestamp = getExpenseTimestamp(expense)?.getTime()
                            if (typeof timestamp !== "number" || Number.isNaN(timestamp)) return true
                            return timestamp < startTs || timestamp > endTs
                        }),
                    )
                }
                if (startIso && endIso && onResetRangeApplied) {
                    onResetRangeApplied({ start: startIso, end: endIso })
                }
            }

            setShowResetReportsModal(false)
            alert(result?.message || "Reportes reiniciados correctamente")
        } catch (error: any) {
            const message = error?.message || "Error al reiniciar reportes"
            setResetError(message)
            console.error(error)
        } finally {
            setResetSubmitting(false)
        }
    }

    const handleExpenseSubmit = useCallback(async (event?: React.FormEvent<HTMLFormElement>) => {
        event?.preventDefault()
        setExpenseStatus(null)
        setExpenseError(null)

        const token = readAuthToken()
        if (!token) {
            setExpenseError("Necesitas iniciar sesion para registrar gastos")
            return
        }

        const description = expenseForm.description.trim()
        if (!description) {
            setExpenseError("Describe el gasto")
            return
        }

        const amount = safeNumber(expenseForm.amount)
        if (amount <= 0) {
            setExpenseError("Monto invalido")
            return
        }

        const currencyCode = normalizeCurrency(expenseForm.currency)
        if (currencyCode === "VES" && (!dailyRate || dailyRate <= 0)) {
            setExpenseError("Falta la tasa del dia para gastos en Bs")
            return
        }

        setExpenseSaving(true)
        try {
            const occurredAt = expenseForm.occurredAt
                ? new Date(expenseForm.occurredAt).toISOString()
                : undefined

            const saved = await registerExpense({
                description,
                amount,
                currency: currencyCode,
                category: expenseForm.category,
                occurredAt,
                exchangeRate: currencyCode === "VES" ? dailyRate : undefined,
                paymentMethod: expenseForm.paymentMethod || undefined,
            }, token)

            setExpenses((prev) => [saved, ...prev])
            setExpenseStatus("Gasto registrado")
            setExpenseForm({
                description: "",
                amount: "",
                currency: "USD",
                category: "operativo",
                paymentMethod: "efectivo_bs",
                occurredAt: "",
            })
        } catch (err) {
            console.error("Error al registrar gasto", err)
            setExpenseError("No se pudo registrar el gasto")
        } finally {
            setExpenseSaving(false)
        }
    }, [dailyRate, expenseForm])

    const handleIncomeSubmit = useCallback(async (event?: React.FormEvent<HTMLFormElement>) => {
        event?.preventDefault()
        setIncomeStatus(null)
        setIncomeError(null)

        const description = incomeForm.description.trim()
        if (!description) {
            setIncomeError("Describe el ingreso")
            return
        }

        const amount = safeNumber(incomeForm.amount)
        if (amount <= 0) {
            setIncomeError("Monto invalido")
            return
        }

        const currencyCode = normalizeCurrency(incomeForm.currency)
        if (currencyCode === "VES" && (!dailyRate || dailyRate <= 0)) {
            setIncomeError("Falta la tasa del dia para ingresos en Bs")
            return
        }

        if (!onRegisterSale) {
            setIncomeError("No se puede registrar el ingreso")
            return
        }

        const manualCode = `manual-${Date.now().toString(36)}${Math.random().toString(16).slice(2, 6)}`.toLowerCase()

        setIncomeSaving(true)
        try {
            const amountUsd = currencyCode === "VES" ? convertVesToUsdValue(amount, dailyRate) : amount
            const method = incomeForm.paymentMethod || undefined

            await Promise.resolve(
                onRegisterSale(
                    [
                        {
                            code: manualCode,
                            name: description,
                            price: amountUsd,
                            points: 0,
                            quantity: 1,
                        },
                    ],
                    undefined,
                    {
                        subtotal: amountUsd,
                        total: amountUsd,
                        source: "manual-income",
                        exchangeRate: currencyCode === "VES" ? dailyRate : undefined,
                        paymentMethod: method,
                        paymentDetails: method
                            ? [
                                {
                                    method,
                                    amount,
                                    currency: currencyCode,
                                },
                            ]
                            : undefined,
                    },
                ),
            )

            setIncomeStatus("Ingreso registrado")
            setIncomeForm({
                description: "",
                amount: "",
                currency: "USD",
                paymentMethod: "efectivo_usd",
            })
        } catch (err) {
            console.error("Error al registrar ingreso", err)
            setIncomeError("No se pudo registrar el ingreso")
        } finally {
            setIncomeSaving(false)
        }
    }, [dailyRate, incomeForm, onRegisterSale])

    const [showCashDetailModal, setShowCashDetailModal] = useState(false)
    const [cashDetailCurrency, setCashDetailCurrency] = useState<"all" | "ves" | "usd">("all")
    const bodyOverflow = useRef<string | null>(null)

    useEffect(() => {
        if (typeof document === "undefined") return
        const shouldLock = showCashDetailModal || showIncomeModal || showExpenseModal || showResetReportsModal || Boolean(selectedExpenseDetail)
        if (shouldLock) {
            if (bodyOverflow.current === null) {
                bodyOverflow.current = document.body.style.overflow
            }
            document.body.style.overflow = "hidden"
            return
        }
        if (bodyOverflow.current !== null) {
            document.body.style.overflow = bodyOverflow.current
            bodyOverflow.current = null
        }
    }, [showCashDetailModal, showIncomeModal, showExpenseModal, showResetReportsModal, selectedExpenseDetail])

    useEffect(() => {
        return () => {
            if (bodyOverflow.current !== null) {
                document.body.style.overflow = bodyOverflow.current
            }
        }
    }, [])

    const renderCashDetails = () => (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] w-full max-w-4xl">
            {/* Header */}
            <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-200 shrink-0">
                        <Wallet size={24} />
                    </div>
                    <div>
                        <h4 className="text-xl font-black text-slate-800 leading-tight">
                            Detalle de Caja
                        </h4>
                        <div className="flex items-center gap-3 mt-1.5">
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 border border-emerald-100 rounded-lg">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest leading-none">
                                    Tasa: {dailyRate.toFixed(2)} Bs/USD
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    {/* Currency Toggle */}
                    <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200 shadow-inner">
                        <button
                            onClick={() => setCashDetailCurrency("all")}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${cashDetailCurrency === "all"
                                ? "bg-white text-slate-800 shadow-sm border border-slate-200"
                                : "text-slate-400 hover:text-slate-600"
                                }`}
                        >
                            Todos
                        </button>
                        <button
                            onClick={() => setCashDetailCurrency("ves")}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${cashDetailCurrency === "ves"
                                ? "bg-white text-emerald-600 shadow-sm border border-emerald-100"
                                : "text-slate-400 hover:text-slate-600"
                                }`}
                        >
                            Bolívares
                        </button>
                        <button
                            onClick={() => setCashDetailCurrency("usd")}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${cashDetailCurrency === "usd"
                                ? "bg-white text-indigo-600 shadow-sm border border-indigo-100"
                                : "text-slate-400 hover:text-slate-600"
                                }`}
                        >
                            Dólares
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowCashDetailModal(false)}
                            className="p-2 hover:bg-rose-50 hover:text-rose-500 rounded-xl text-slate-400 transition-all border border-transparent hover:border-rose-100"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50/20">
                {expensesError && (
                    <div className="mb-6 px-4 py-3 rounded-2xl border border-rose-100 bg-rose-50 text-xs font-bold text-rose-600 animate-in fade-in slide-in-from-top-2">
                        {expensesError}
                    </div>
                )}

                {/* Dashboard Summary */}
                <div className="grid grid-cols-1 gap-6 mb-10">
                    <div className="p-6 rounded-[2.5rem] bg-slate-900 border border-slate-800 relative overflow-hidden group shadow-xl">
                        <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-indigo-500 rounded-full blur-[50px] opacity-20 group-hover:opacity-30 transition-opacity"></div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-white/10 text-white rounded-lg">
                                <Wallet size={16} />
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Disponible en la cuenta</p>
                        </div>
                        <div className="space-y-1 relative z-10">
                            <p className={`text-2xl font-black leading-none ${currencyTotals.bankVes >= 0 ? "text-white" : "text-rose-400"}`}>
                                {formatVesAmount(currencyTotals.bankVes)}
                            </p>
                            <p className={`text-xs font-bold ${currencyTotals.bankUsd >= 0 ? "text-slate-400" : "text-rose-400/80"}`}>
                                {formatMoney(currencyTotals.bankUsd)} USD
                            </p>
                        </div>
                        <div className="mt-4 pt-4 border-t border-white/10 space-y-1 relative z-10">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Disponible en efectivo</p>
                            <p className={`text-sm font-bold ${currencyTotals.cashVes >= 0 ? "text-white" : "text-rose-300"}`}>
                                {formatVesAmount(currencyTotals.cashVes)}
                            </p>
                            <p className={`text-xs font-bold ${currencyTotals.cashUsd >= 0 ? "text-slate-400" : "text-rose-400/80"}`}>
                                {formatMoney(currencyTotals.cashUsd)} USD
                            </p>
                        </div>
                    </div>
                </div>

                {/* Methods Breakdown Section Label */}
                <div className="flex items-center gap-4 mb-8">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                        {cashDetailCurrency === "all" ? "Todos los Métodos" : cashDetailCurrency === "ves" ? "Métodos en Bolívares" : "Métodos en Dólares"}
                    </span>
                    <div className="h-px flex-1 bg-slate-100"></div>
                </div>

                {/* Payment Methods Grid */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-6">
                    {paymentSummary.entries
                        .filter((entry) => {
                            if (cashDetailCurrency === "all") return true
                            if (cashDetailCurrency === "ves") return VES_METHODS.has(entry.method)
                            if (cashDetailCurrency === "usd") return USD_METHODS.has(entry.method)
                            return true
                        })
                        .map((entry) => {
                            const meta = getMethodMeta(entry.method)
                            const MethodIcon = meta.icon
                            const isPositive = entry.netUsd >= 0

                            return (
                                <div key={entry.method} className="bg-white p-5 rounded-[2rem] border border-slate-100/80 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300 group">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-3.5 rounded-2xl ${meta.bg} ${meta.text} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                                                <MethodIcon size={22} />
                                            </div>
                                            <p className="text-sm font-black text-slate-800 tracking-tight">{meta.label}</p>
                                        </div>
                                        <div className={`text-base font-black px-4 py-1.5 rounded-full ${isPositive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                                            {formatMethodAmount(entry.method, entry.netUsd, entry.netVes)}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-4 bg-white border-t border-slate-100 flex justify-end items-center">
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Caja Virtual Activa</span>
            </div>
        </div>
    )



    const renderExpenseDetailModal = () => {
        if (!selectedExpenseDetail) return null
        const currencyCode = normalizeCurrency(selectedExpenseDetail.currency)
        const amountUsd = getExpenseUsdAmount(selectedExpenseDetail, dailyRate)
        const displayAmount = currencyCode === "VES"
            ? formatVesAmount(safeNumber(selectedExpenseDetail.amount))
            : formatMoney(amountUsd)
        const methodValue = selectedExpenseDetail.paymentMethod
            ? normalizePaymentMethod(selectedExpenseDetail.paymentMethod)
            : ""
        const methodMeta = getMethodMeta(methodValue)
        const timestamp = getExpenseTimestamp(selectedExpenseDetail)
        const dateLabel = timestamp
            ? timestamp.toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" })
            : "Sin fecha"
        const timeLabel = timestamp
            ? timestamp.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })
            : "--:--"
        const rateValue = Number(selectedExpenseDetail.exchangeRate ?? dailyRate)
        const rateLabel = currencyCode === "VES" && Number.isFinite(rateValue) && rateValue > 0
            ? `${rateValue.toFixed(2)} Bs/USD`
            : null

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="w-full max-w-xl animate-in zoom-in-95 duration-200">
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                <TrendingDown size={18} className="text-rose-500" /> Detalle de gasto
                            </h4>
                            <button
                                type="button"
                                onClick={() => setSelectedExpenseDetail(null)}
                                className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"
                                aria-label="Cerrar"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Descripcion</p>
                                <p className="font-semibold text-slate-700">{selectedExpenseDetail.description || "Gasto"}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Monto</p>
                                <p className="font-semibold text-slate-700">{displayAmount} {currencyCode}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Metodo</p>
                                <p className="font-semibold text-slate-700">{methodMeta.label || "Sin metodo"}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Categoria</p>
                                <p className="font-semibold text-slate-700">{selectedExpenseDetail.category || "Sin categoria"}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Fecha</p>
                                <p className="font-semibold text-slate-700">{dateLabel} {timeLabel}</p>
                            </div>
                            {rateLabel && (
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tasa aplicada</p>
                                    <p className="font-semibold text-slate-700">{rateLabel}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="absolute inset-0 -z-10" onClick={() => setSelectedExpenseDetail(null)} />
            </div>
        )
    }

    const renderIncomeDetails = () => {
        // Filter methods based on selected currency
        const availableMethods = incomeForm.currency === "VES"
            ? PAYMENT_METHODS.filter(m => VES_METHODS.has(m.id))
            : PAYMENT_METHODS.filter(m => USD_METHODS.has(m.id))

        return (
            <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-[4rem] -z-0 opacity-50"></div>

                <div className="flex items-center justify-between mb-8 relative z-10">
                    <div>
                        <h4 className="text-xl font-black text-slate-800 flex items-center gap-2">
                            <span className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                                <TrendingUp size={20} />
                            </span>
                            Registrar Ingreso
                        </h4>
                        <p className="text-slate-500 text-sm mt-1 ml-1">Agrega dinero extra a la caja</p>
                    </div>
                    <button
                        type="button"
                        onClick={closeIncomeModal}
                        className="p-2 hover:bg-slate-50 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                        aria-label="Cerrar"
                    >
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleIncomeSubmit} className="space-y-6 relative z-10">
                    <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block pl-1">Descripción</label>
                        <input
                            value={incomeForm.description}
                            onChange={(e) => setIncomeForm((prev) => ({ ...prev, description: e.target.value }))}
                            className="w-full rounded-2xl border-0 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-800 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all placeholder:text-slate-400"
                            placeholder="Ej: Venta de garaje, Aporte de socio..."
                            autoFocus
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block pl-1">Monto</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={incomeForm.amount}
                                    onChange={(e) => setIncomeForm((prev) => ({ ...prev, amount: e.target.value }))}
                                    className="w-full rounded-2xl border-0 bg-slate-50 pl-4 pr-12 py-3.5 text-lg font-bold text-slate-800 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all placeholder:text-slate-300"
                                    placeholder="0.00"
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                    <span className="text-xs font-black text-slate-400">{incomeForm.currency}</span>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block pl-1">Moneda</label>
                            <div className="flex bg-slate-50 p-1 rounded-2xl ring-1 ring-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setIncomeForm(prev => ({ ...prev, currency: "USD", paymentMethod: "efectivo_usd" }))} // Reset method on switch
                                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${incomeForm.currency === "USD" ? "bg-white text-slate-900 shadow-sm ring-1 ring-black/5" : "text-slate-400 hover:text-slate-600"}`}
                                >
                                    USD
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIncomeForm(prev => ({ ...prev, currency: "VES", paymentMethod: "pago_movil" }))} // Reset method on switch
                                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${incomeForm.currency === "VES" ? "bg-white text-slate-900 shadow-sm ring-1 ring-black/5" : "text-slate-400 hover:text-slate-600"}`}
                                >
                                    VES
                                </button>
                            </div>
                        </div>
                    </div>

                    {incomeForm.currency === "VES" && (
                        <div className="px-4 py-3 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex items-center gap-3">
                            <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
                                <Banknote size={16} />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Tasa de cambio</p>
                                <p className="text-sm font-bold text-indigo-900">{dailyRate.toFixed(2)} Bs/USD</p>
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block pl-1">Método de Pago</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {availableMethods.map((method) => (
                                <button
                                    key={method.id}
                                    type="button"
                                    onClick={() => setIncomeForm((prev) => ({ ...prev, paymentMethod: method.id }))}
                                    className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden group ${incomeForm.paymentMethod === method.id
                                        ? "bg-slate-900 border-slate-900 text-white shadow-md shadow-slate-900/20"
                                        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                                        }`}
                                >
                                    <div className="flex flex-col gap-1 relative z-10">
                                        <method.icon size={18} className={incomeForm.paymentMethod === method.id ? "text-emerald-400" : "text-slate-400 group-hover:text-slate-600"} />
                                        <span className="text-[11px] font-bold leading-tight">{method.label}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {incomeError && (
                        <div className="px-4 py-3 rounded-2xl border border-rose-100 bg-rose-50/50 text-xs font-bold text-rose-600 flex items-center gap-2 animate-in slide-in-from-top-2">
                            <AlertCircle size={16} />
                            {incomeError}
                        </div>
                    )}
                    {incomeStatus && (
                        <div className="px-4 py-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 text-xs font-bold text-emerald-600 flex items-center gap-2 animate-in slide-in-from-top-2">
                            <Check size={16} />
                            {incomeStatus}
                        </div>
                    )}

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={incomeSaving}
                            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-white font-bold text-sm py-4 shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            {incomeSaving ? <Loader size={18} className="animate-spin" /> : <Plus size={18} strokeWidth={2.5} />}
                            {incomeSaving ? "Guardando..." : "Registrar Ingreso"}
                        </button>
                    </div>
                </form>

                <div className="mt-8 border-t border-slate-100 pt-6">
                    <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Ingresos Recientes</h5>
                    <div className="flex flex-col sm:flex-row gap-4 mb-4">
                        <div className="flex items-center bg-slate-100 p-1 rounded-xl overflow-x-auto max-w-full no-scrollbar">
                            {(["today", "week", "month", "year"] as TimeRange[]).map((r) => (
                                <button
                                    key={r}
                                    type="button"
                                    onClick={() => { setIncomeHistoryRange(r); setIncomeHistoryOffset(0); }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${incomeHistoryRange === r ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"}`}
                                >
                                    {r === "today" ? "Día" : r === "week" ? "Semana" : r === "month" ? "Mes" : "Año"}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
                            <button
                                type="button"
                                onClick={() => setIncomeHistoryOffset(prev => prev - 1)}
                                className="p-1.5 hover:bg-white hover:text-primary-600 hover:shadow-sm rounded-lg text-slate-400 transition-all"
                                aria-label="Periodo anterior"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="px-2 text-xs font-bold text-slate-700 min-w-[140px] text-center capitalize whitespace-nowrap overflow-hidden text-ellipsis">
                                {filteredIncomeSales.label}
                            </span>
                            <button
                                type="button"
                                onClick={() => setIncomeHistoryOffset(prev => prev + 1)}
                                className="p-1.5 hover:bg-white hover:text-primary-600 hover:shadow-sm rounded-lg text-slate-400 transition-all"
                                aria-label="Periodo siguiente"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                    {filteredIncomeSales.list.length === 0 ? (
                        <div className="text-center py-8 border-2 border-dashed border-slate-100 rounded-2xl">
                            <p className="text-xs font-medium text-slate-400">No hay ingresos registrados</p>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
                            {filteredIncomeSales.list.map((sale) => {
                                const createdAt = new Date(sale.createdAt)
                                const timeLabel = Number.isNaN(createdAt.getTime())
                                    ? "--:--"
                                    : createdAt.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })
                                const dateLabel = Number.isNaN(createdAt.getTime())
                                    ? "--"
                                    : createdAt.toLocaleDateString("es-VE", { day: "2-digit", month: "short" })
                                const timestampLabel = `${dateLabel} • ${timeLabel}`
                                const itemNames = sale.items.map(i => i.name).join(", ") || "Ingreso"
                                return (
                                    <div key={sale.id} className="p-3 rounded-2xl border border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3 hover:bg-white transition-colors">
                                        <div className="min-w-0 flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-emerald-100/50 text-emerald-600 flex items-center justify-center shrink-0">
                                                <TrendingUp size={14} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-slate-700 truncate">{itemNames}</p>
                                                <p className="text-[10px] text-slate-400">{timestampLabel}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100/50">
                                                +{formatMoney(sale.totalUsd)}
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // Modern Expense Modal
    const renderExpenseDetails = () => {
        // Filter methods based on selected currency
        const availableMethods = expenseForm.currency === "VES"
            ? PAYMENT_METHODS.filter(m => VES_METHODS.has(m.id))
            : PAYMENT_METHODS.filter(m => USD_METHODS.has(m.id))

        return (
            <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-bl-[4rem] -z-0 opacity-50"></div>

                <div className="flex items-center justify-between mb-8 relative z-10">
                    <div>
                        <h4 className="text-xl font-black text-slate-800 flex items-center gap-2">
                            <span className="p-2 bg-rose-100 text-rose-600 rounded-xl">
                                <TrendingDown size={20} />
                            </span>
                            Registrar Gasto
                        </h4>
                        <p className="text-slate-500 text-sm mt-1 ml-1">Registra salidas de dinero de la caja</p>
                    </div>
                    <button
                        type="button"
                        onClick={closeExpenseModal}
                        className="p-2 hover:bg-slate-50 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                        aria-label="Cerrar"
                    >
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleExpenseSubmit} className="space-y-6 relative z-10">
                    <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block pl-1">Descripción</label>
                        <input
                            value={expenseForm.description}
                            onChange={(e) => setExpenseForm((prev) => ({ ...prev, description: e.target.value }))}
                            className="w-full rounded-2xl border-0 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-800 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-rose-500/20 focus:bg-white transition-all placeholder:text-slate-400"
                            placeholder="Ej: Compra de hielo, Pago de servicio..."
                            autoFocus
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block pl-1">Monto</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={expenseForm.amount}
                                    onChange={(e) => setExpenseForm((prev) => ({ ...prev, amount: e.target.value }))}
                                    className="w-full rounded-2xl border-0 bg-slate-50 pl-4 pr-12 py-3.5 text-lg font-bold text-slate-800 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-rose-500/20 focus:bg-white transition-all placeholder:text-slate-300"
                                    placeholder="0.00"
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                    <span className="text-xs font-black text-slate-400">{expenseForm.currency}</span>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block pl-1">Moneda</label>
                            <div className="flex bg-slate-50 p-1 rounded-2xl ring-1 ring-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setExpenseForm(prev => ({ ...prev, currency: "USD", paymentMethod: "efectivo_usd" }))}
                                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${expenseForm.currency === "USD" ? "bg-white text-slate-900 shadow-sm ring-1 ring-black/5" : "text-slate-400 hover:text-slate-600"}`}
                                >
                                    USD
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setExpenseForm(prev => ({ ...prev, currency: "VES", paymentMethod: "pago_movil" }))}
                                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${expenseForm.currency === "VES" ? "bg-white text-slate-900 shadow-sm ring-1 ring-black/5" : "text-slate-400 hover:text-slate-600"}`}
                                >
                                    VES
                                </button>
                            </div>
                        </div>
                    </div>

                    {expenseForm.currency === "VES" && (
                        <div className="px-4 py-3 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex items-center gap-3">
                            <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
                                <Banknote size={16} />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Tasa de cambio</p>
                                <p className="text-sm font-bold text-indigo-900">{dailyRate.toFixed(2)} Bs/USD</p>
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block pl-1">Método de Pago</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {availableMethods.map((method) => (
                                <button
                                    key={method.id}
                                    type="button"
                                    onClick={() => setExpenseForm((prev) => ({ ...prev, paymentMethod: method.id }))}
                                    className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden group ${expenseForm.paymentMethod === method.id
                                        ? "bg-slate-900 border-slate-900 text-white shadow-md shadow-slate-900/20"
                                        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                                        }`}
                                >
                                    <div className="flex flex-col gap-1 relative z-10">
                                        <method.icon size={18} className={expenseForm.paymentMethod === method.id ? "text-rose-400" : "text-slate-400 group-hover:text-slate-600"} />
                                        <span className="text-[11px] font-bold leading-tight">{method.label}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {expenseError && (
                        <div className="px-4 py-3 rounded-2xl border border-rose-100 bg-rose-50/50 text-xs font-bold text-rose-600 flex items-center gap-2 animate-in slide-in-from-top-2">
                            <AlertCircle size={16} />
                            {expenseError}
                        </div>
                    )}
                    {expenseStatus && (
                        <div className="px-4 py-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 text-xs font-bold text-emerald-600 flex items-center gap-2 animate-in slide-in-from-top-2">
                            <Check size={16} />
                            {expenseStatus}
                        </div>
                    )}

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={expenseSaving}
                            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-500 text-white font-bold text-sm py-4 shadow-lg shadow-rose-500/20 hover:bg-rose-600 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            {expenseSaving ? <Loader size={18} className="animate-spin" /> : <Plus size={18} strokeWidth={2.5} className="rotate-45" />}
                            {expenseSaving ? "Guardando..." : "Registrar Gasto"}
                        </button>
                    </div>
                </form>

                <div className="mt-8 border-t border-slate-100 pt-6">
                    <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Gastos Recientes</h5>
                    <div className="flex flex-col sm:flex-row gap-4 mb-4">
                        <div className="flex items-center bg-slate-100 p-1 rounded-xl overflow-x-auto max-w-full no-scrollbar">
                            {(["today", "week", "month", "year"] as TimeRange[]).map((r) => (
                                <button
                                    key={r}
                                    type="button"
                                    onClick={() => { setExpenseHistoryRange(r); setExpenseHistoryOffset(0); }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${expenseHistoryRange === r ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"}`}
                                >
                                    {r === "today" ? "Día" : r === "week" ? "Semana" : r === "month" ? "Mes" : "Año"}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
                            <button
                                type="button"
                                onClick={() => setExpenseHistoryOffset(prev => prev - 1)}
                                className="p-1.5 hover:bg-white hover:text-primary-600 hover:shadow-sm rounded-lg text-slate-400 transition-all"
                                aria-label="Periodo anterior"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="px-2 text-xs font-bold text-slate-700 min-w-[140px] text-center capitalize whitespace-nowrap overflow-hidden text-ellipsis">
                                {filteredRecentExpenses.label}
                            </span>
                            <button
                                type="button"
                                onClick={() => setExpenseHistoryOffset(prev => prev + 1)}
                                className="p-1.5 hover:bg-white hover:text-primary-600 hover:shadow-sm rounded-lg text-slate-400 transition-all"
                                aria-label="Periodo siguiente"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                    {filteredRecentExpenses.list.length === 0 ? (
                        <div className="text-center py-8 border-2 border-dashed border-slate-100 rounded-2xl">
                            <p className="text-xs font-medium text-slate-400">No hay gastos registrados</p>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
                            {filteredRecentExpenses.list.map((expense, idx) => {
                                const timestamp = getExpenseTimestamp(expense)
                                const dateLabel = timestamp
                                    ? timestamp.toLocaleDateString("es-VE", { day: "2-digit", month: "short" })
                                    : "--"
                                const timeLabel = timestamp
                                    ? timestamp.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })
                                    : "--:--"
                                const timestampLabel = `${dateLabel} • ${timeLabel}`
                                const description = expense.description || "Gasto"
                                const methodLabel = expense.paymentMethod
                                    ? getMethodMeta(normalizePaymentMethod(expense.paymentMethod)).label
                                    : null
                                const currencyCode = normalizeCurrency(expense.currency)
                                const amountValue = safeNumber(expense.amount)
                                const amountLabel = currencyCode === "VES"
                                    ? formatVesAmount(amountValue)
                                    : formatMoney(amountValue)
                                const key = (expense as any).id ?? `${expense.createdAt ?? idx}-${description}`

                                return (
                                    <div key={key} className="p-3 rounded-2xl border border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3 hover:bg-white transition-colors">
                                        <div className="min-w-0 flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-rose-100/60 text-rose-600 flex items-center justify-center shrink-0">
                                                <TrendingDown size={14} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-slate-700 truncate">{description}</p>
                                                <p className="text-[10px] text-slate-400">{timestampLabel}{methodLabel ? ` • ${methodLabel}` : ""}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs font-black text-rose-600 bg-rose-50 px-2 py-1 rounded-lg border border-rose-100/50">
                                                -{amountLabel}
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // Return the main component JSX with resized main buttons
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Finanzas</h2>
                        <p className="text-slate-500 text-sm">Resumen financiero y gestión de caja</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={openIncomeModal}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-md shadow-emerald-200 font-bold text-xs transition-all hover:-translate-y-0.5"
                    >
                        <Plus size={14} strokeWidth={3} />
                        Registrar Ingreso
                    </button>
                    <button
                        type="button"
                        onClick={openExpenseForm}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl shadow-md shadow-rose-200 font-bold text-xs transition-all hover:-translate-y-0.5"
                    >
                        <Minus size={14} strokeWidth={3} />
                        Registrar Gasto
                    </button>

                    <button
                        type="button"
                        onClick={openResetReportsModal}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-500 rounded-xl transition-all text-[11px] font-bold uppercase tracking-wide ${!allowResetReports ? 'hidden' : ''}`}
                        title="Borrar reportes"
                    >
                        <Trash2 size={14} />
                        <span className="hidden sm:inline">Borrar reportes</span>
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 gap-3">
                {/* Net (Redesigned) */}
                <div className="bg-white p-4 md:p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="flex justify-between items-center gap-4 mb-4 md:mb-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shadow-sm border border-indigo-100">
                                <Wallet size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-800 leading-tight">Caja Actual</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                                        Tasa: {Number.isFinite(dailyRate) && dailyRate > 0 ? dailyRate.toFixed(2) : "--"} Bs/USD
                                    </span>
                                </div>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowCashDetailModal(true)}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-all text-[10px] font-bold flex items-center gap-1.5 border border-indigo-100 shrink-0"
                        >
                            Ver detalles
                        </button>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
                        {/* Main Balance */}
                        <div className="col-span-2 lg:col-span-1 flex flex-col justify-center p-4 sm:p-5 rounded-3xl bg-slate-900 text-white relative overflow-hidden shadow-lg shadow-slate-200">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 rounded-full blur-[60px] opacity-20"></div>
                            <div className="relative z-10">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Total Neto</span>
                                <div className="space-y-1">
                                    <div className="flex flex-col">
                                        <span className={`text-xl sm:text-3xl font-black tracking-tight ${currencyTotals.netUsd >= 0 ? "text-white" : "text-rose-300"}`}>
                                            {formatMoney(currencyTotals.netUsd)}
                                        </span>
                                        <span className={`text-sm font-bold ${currencyTotals.netUsd >= 0 ? "text-slate-400" : "text-rose-300/60"}`}>
                                            ({formatVesAmount(currencyTotals.netVes)})
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bank Balance */}
                        <div className="lg:col-span-1 p-5 rounded-3xl bg-slate-50 border border-slate-100 flex flex-col justify-center gap-3 hover:border-indigo-100 hover:shadow-md hover:shadow-indigo-100/20 transition-all group/card">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white text-indigo-500 rounded-xl shadow-sm border border-slate-100 group-hover/card:scale-110 transition-transform">
                                    <Landmark size={18} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">En Cuenta</span>
                            </div>
                            <div className="flex flex-col">
                                <span className={`text-xl font-black ${currencyTotals.bankUsd >= 0 ? "text-slate-800" : "text-rose-500"}`}>
                                    {formatMoney(currencyTotals.bankUsd)}
                                </span>
                                <span className="text-xs font-bold text-slate-400">
                                    ({formatVesAmount(currencyTotals.bankVes)})
                                </span>
                            </div>
                        </div>

                        {/* Cash Balance */}
                        <div className="lg:col-span-1 p-5 rounded-3xl bg-slate-50 border border-slate-100 flex flex-col justify-center gap-3 hover:border-emerald-100 hover:shadow-md hover:shadow-emerald-100/20 transition-all group/card">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white text-emerald-500 rounded-xl shadow-sm border border-slate-100 group-hover/card:scale-110 transition-transform">
                                    <Banknote size={18} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Efectivo</span>
                            </div>
                            <div className="flex flex-col">
                                <span className={`text-xl font-black ${currencyTotals.cashUsd >= 0 ? "text-slate-800" : "text-rose-500"}`}>
                                    {formatMoney(currencyTotals.cashUsd)}
                                </span>
                                <span className="text-xs font-bold text-slate-400">
                                    ({formatVesAmount(currencyTotals.cashVes)})
                                </span>
                            </div>
                        </div>

                        {hasUnclassifiedCash && (
                            <div className="lg:col-span-1 p-5 rounded-3xl bg-amber-50 border border-amber-100 flex flex-col justify-center gap-3 hover:border-amber-200 hover:shadow-md hover:shadow-amber-100/30 transition-all group/card">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white text-amber-500 rounded-xl shadow-sm border border-amber-100 group-hover/card:scale-110 transition-transform">
                                        <AlertCircle size={18} />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">Sin método</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className={`text-xl font-black ${currencyTotals.unclassifiedUsd >= 0 ? "text-slate-800" : "text-rose-500"}`}>
                                        {formatMoney(currencyTotals.unclassifiedUsd)}
                                    </span>
                                    <span className="text-xs font-bold text-amber-700/70">
                                        ({formatVesAmount(currencyTotals.unclassifiedVes)})
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>


                </div>
            </div>

            <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-xl border ${todayCashVsFinance.missingTicketIds.length ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"}`}>
                            {todayCashVsFinance.missingTicketIds.length ? <AlertCircle size={18} /> : <Check size={18} />}
                        </div>
                        <div>
                            <p className="text-sm font-black text-slate-800">Caja vs Finanzas de hoy</p>
                            <p className="text-xs font-semibold text-slate-500 mt-0.5">
                                {todayCashVsFinance.missingTicketIds.length
                                    ? `${todayCashVsFinance.missingTicketIds.length} ticket(s) confirmado(s) sin venta enlazada`
                                    : "Tickets confirmados y ventas enlazadas sin alertas"}
                            </p>
                            {todayCashVsFinance.missingTicketIds.length > 0 && (
                                <p className="text-[11px] font-bold text-amber-600 mt-1">
                                    Revisar: #{todayCashVsFinance.missingTicketIds.slice(0, 4).join(", #")}
                                    {todayCashVsFinance.missingTicketIds.length > 4 ? "..." : ""}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-right">
                        <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Ventas</p>
                            <p className="text-sm font-black text-slate-800">{formatMoney(todayCashVsFinance.salesEquivalentUsd)}</p>
                        </div>
                        <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Tickets</p>
                            <p className="text-sm font-black text-slate-800">{formatMoney(todayCashVsFinance.ticketEquivalentUsd)}</p>
                        </div>
                        <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Esperado USD</p>
                            <p className="text-sm font-black text-slate-800">{formatMoney(todayCashVsFinance.expectedUsd)}</p>
                        </div>
                        <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Esperado VES</p>
                            <p className="text-sm font-black text-slate-800">{formatVesAmount(todayCashVsFinance.expectedVes)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal Overlay for Cash Details */}
            {showCashDetailModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="w-full max-w-4xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                        {renderCashDetails()}
                    </div>
                    {/* Backdrop click to close */}
                    <div className="absolute inset-0 -z-10" onClick={() => setShowCashDetailModal(false)} />
                </div>
            )}

            {showIncomeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
                        {renderIncomeDetails()}
                    </div>
                    <div className="absolute inset-0 -z-10" onClick={closeIncomeModal} />
                </div>
            )}

            {showExpenseModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
                        {renderExpenseDetails()}
                    </div>
                    <div className="absolute inset-0 -z-10" onClick={closeExpenseModal} />
                </div>
            )}

            {showResetReportsModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="w-full max-w-3xl bg-white rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 ring-1 ring-slate-100/50 flex flex-col max-h-[80vh]">
                        {/* Header */}
                        <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white/80 backdrop-blur z-10">
                            <div>
                                <h4 className="text-base font-black text-slate-900 tracking-tight">Borrar Reportes</h4>
                                <p className="text-[10px] font-medium text-slate-500">Esta acción no se puede deshacer.</p>
                            </div>
                            <button
                                type="button"
                                onClick={closeResetReportsModal}
                                className="p-1.5 rounded-lg bg-slate-50 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all active:scale-95"
                                aria-label="Cerrar modal"
                            >
                                <X size={16} className="stroke-[2.5]" />
                            </button>
                        </div>

                        <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
                            {/* Layout Grid: Left (Modes), Right (Details) */}
                            <div className="grid lg:grid-cols-[180px_1fr] gap-4 h-full">
                                {/* Mode Selection - Vertical List on Desktop */}
                                <div className="space-y-2">
                                    <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Modo de borrado</p>
                                    <button
                                        type="button"
                                        onClick={() => setResetMode("all")}
                                        className={`w-full relative group p-3 rounded-xl border-2 text-left transition-all duration-200 ${resetMode === "all"
                                            ? "border-rose-500 bg-rose-50/50 ring-2 ring-rose-500/10"
                                            : "border-slate-100 bg-slate-50 hover:border-rose-200 hover:bg-rose-50/30"
                                            }`}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0 ${resetMode === "all" ? "bg-rose-500 text-white shadow-md shadow-rose-500/30" : "bg-white text-slate-400 group-hover:text-rose-500 shadow-sm"
                                                }`}>
                                                <Trash2 size={14} className="stroke-[2.5]" />
                                            </div>
                                            <div>
                                                <p className={`text-xs font-black transition-colors ${resetMode === "all" ? "text-rose-900" : "text-slate-700"}`}>Todo</p>
                                                <p className={`text-[9px] font-medium leading-tight ${resetMode === "all" ? "text-rose-700/80" : "text-slate-500"}`}>
                                                    Historial completo
                                                </p>
                                            </div>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setResetMode("period")}
                                        className={`w-full relative group p-3 rounded-xl border-2 text-left transition-all duration-200 ${resetMode === "period"
                                            ? "border-indigo-500 bg-indigo-50/50 ring-2 ring-indigo-500/10"
                                            : "border-slate-100 bg-slate-50 hover:border-indigo-200 hover:bg-indigo-50/30"
                                            }`}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0 ${resetMode === "period" ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/30" : "bg-white text-slate-400 group-hover:text-indigo-500 shadow-sm"
                                                }`}>
                                                <Calendar size={14} className="stroke-[2.5]" />
                                            </div>
                                            <div>
                                                <p className={`text-xs font-black transition-colors ${resetMode === "period" ? "text-indigo-900" : "text-slate-700"}`}>Periodo</p>
                                                <p className={`text-[9px] font-medium leading-tight ${resetMode === "period" ? "text-indigo-700/80" : "text-slate-500"}`}>
                                                    Rango de fechas
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                </div>

                                {/* Period Selection Content - Visible only when Period is selected */}
                                <div className="relative h-full transition-all duration-300">
                                    {resetMode !== "period" && (
                                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm rounded-xl border border-slate-100 transition-all animate-in fade-in duration-200">
                                            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mb-2">
                                                <Calendar size={18} className="text-slate-300" />
                                            </div>
                                            <p className="text-xs font-bold text-slate-400">Borrarás todo el historial</p>
                                            <p className="text-[9px] text-slate-400 mt-0.5">Selecciona "Periodo" para configurar el rango de fechas</p>
                                        </div>
                                    )}

                                    <div className="h-full flex flex-col gap-3">
                                        {/* Period Type Selector */}
                                        <div className="bg-slate-100/80 p-1 rounded-lg flex relative shrink-0">
                                            {([
                                                { id: "days", label: "Días" },
                                                { id: "week", label: "Semana" },
                                                { id: "month", label: "Mes" },
                                                { id: "year", label: "Año" },
                                            ] as Array<{ id: ResetPeriodUnit; label: string }>).map((option) => {
                                                const isActive = resetPeriodUnit === option.id
                                                return (
                                                    <button
                                                        key={option.id}
                                                        type="button"
                                                        onClick={() => setResetPeriodUnit(option.id)}
                                                        className={`relative flex-1 py-1 text-[9px] font-bold uppercase tracking-wide rounded-md transition-all duration-200 z-10 ${isActive
                                                            ? "text-indigo-600 shadow-sm bg-white ring-1 ring-black/5"
                                                            : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                                                            }`}
                                                    >
                                                        {option.label}
                                                    </button>
                                                )
                                            })}
                                        </div>

                                        <div className="flex-1 min-h-0">
                                            {/* Calendar / Input Area */}
                                            <div className="flex flex-col gap-3 h-full">
                                                {/* Amount Input (for Days) */}
                                                {resetPeriodUnit === "days" && (
                                                    <div className="animate-in fade-in slide-in-from-top-2 shrink-0">
                                                        <div className="relative">
                                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                                <span className="text-slate-400 font-bold text-[9px] uppercase tracking-wider">Últimos</span>
                                                            </div>
                                                            <input
                                                                type="number"
                                                                min={1}
                                                                max={3650}
                                                                step={1}
                                                                value={resetPeriodDays}
                                                                onChange={(event) => setResetPeriodDays(event.target.value)}
                                                                className="w-full pl-16 pr-10 py-2 rounded-lg border border-slate-200 text-sm font-black text-slate-800 bg-white focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-center"
                                                            />
                                                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                                                <span className="text-slate-400 font-bold text-[9px] uppercase tracking-wider">Días</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Calendar View */}
                                                <div className="bg-white rounded-xl border border-slate-100 p-3 shadow-sm flex flex-col h-full overflow-hidden">
                                                    <div className="flex items-center justify-between mb-1.5 shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setResetCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                                                            }
                                                            className="w-6 h-6 flex items-center justify-center rounded-md bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                                                        >
                                                            <ChevronLeft size={14} />
                                                        </button>

                                                        <div className="flex flex-col items-center">
                                                            <span className="text-[10px] font-black text-slate-800 capitalize">{resetCalendarLabel}</span>
                                                        </div>

                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => setResetAnchorDate(toInputDate(new Date()))}
                                                                className="text-[8px] font-bold text-indigo-500 hover:text-indigo-700 px-1.5 py-0.5 rounded-full bg-indigo-50 hover:bg-indigo-100 transition-colors mr-1"
                                                            >
                                                                Hoy
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setResetCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                                                                }
                                                                className="w-6 h-6 flex items-center justify-center rounded-md bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                                                            >
                                                                <ChevronRight size={14} />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-7 gap-0.5 flex-1 content-start">
                                                        {CALENDAR_WEEK_LABELS.map((label) => (
                                                            <div key={label} className="h-4 flex items-center justify-center text-[8px] font-black text-slate-400 uppercase tracking-wider">
                                                                {label}
                                                            </div>
                                                        ))}
                                                        {resetCalendarDays.map((day, index) => {
                                                            const isRangeEdge = day.isRangeStart || day.isRangeEnd;
                                                            const isInRange = day.inSelectedRange;

                                                            return (
                                                                <button
                                                                    key={`${day.date.toISOString()}-${index}`}
                                                                    type="button"
                                                                    onClick={() => setResetAnchorDate(toInputDate(day.date))}
                                                                    className={`
                                                                        h-8 w-full rounded-md text-[9px] font-bold transition-all relative overflow-hidden group flex items-center justify-center
                                                                        ${isInRange && !isRangeEdge ? "bg-indigo-50 text-indigo-700 rounded-none first:rounded-l-md last:rounded-r-md" : ""}
                                                                        ${isRangeEdge ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 scale-105 z-10" : ""}
                                                                        ${!isInRange && day.inCurrentMonth ? "bg-white text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 border border-transparent hover:border-indigo-100" : ""}
                                                                        ${!isInRange && !day.inCurrentMonth ? "text-slate-300 opacity-50" : ""}
                                                                        ${day.isAnchor ? "ring-1 ring-indigo-400 ring-offset-1" : ""}
                                                                    `}
                                                                >
                                                                    <span className="relative z-10">{day.date.getDate()}</span>
                                                                    {day.isToday && !isRangeEdge && (
                                                                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-0.5 h-0.5 rounded-full bg-rose-500"></div>
                                                                    )}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-4 shrink-0 backdrop-blur-sm">
                            {/* Error Message */}
                            <div className="flex-1 min-w-0">
                                {resetError && (
                                    <div className="text-rose-600 text-[10px] font-bold flex items-center gap-1.5 animate-in fade-in slide-in-from-left-2 truncate">
                                        <AlertCircle size={12} className="shrink-0" />
                                        <span>{resetError}</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    type="button"
                                    onClick={closeResetReportsModal}
                                    className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95"
                                    disabled={resetSubmitting}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleResetReports}
                                    className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 shadow-lg shadow-rose-200 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                                    disabled={resetSubmitting}
                                >
                                    {resetSubmitting ? <Loader size={12} className="animate-spin" /> : <Trash2 size={12} className="stroke-[2.5]" />}
                                    <span>{resetSubmitting ? "Eliminando..." : "Confirmar"}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                    {/* Backdrop click to close */}
                    <div className="absolute inset-0 -z-10" onClick={closeResetReportsModal} />
                </div>
            )}

            {renderExpenseDetailModal()}

            <div className="bg-white p-4 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden mt-6">
                <div className="flex flex-col gap-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h4 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                                <Zap size={20} className="text-amber-500" /> Punto de Equilibrio
                            </h4>
                        </div>
                    </div>

                    <div className="grid lg:grid-cols-3 gap-6">
                        <div className="col-span-1 grid grid-cols-2 lg:grid-cols-1 gap-4 lg:gap-6">
                            <div className="col-span-2 lg:col-span-1 p-4 rounded-2xl bg-indigo-50 border border-indigo-100 relative overflow-hidden group hover:shadow-sm transition-all">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Meta del Periodo</p>
                                        <p className="text-2xl font-black text-indigo-900">
                                            {formatMoney(breakEvenData.periodFixedTarget)}
                                        </p>
                                        <p className="text-sm font-bold text-indigo-700/60">
                                            ({formatVesLabelFromUsd(breakEvenData.periodFixedTarget, dailyRate)})
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setShowFinancialSettings(true)}
                                            className="p-2 bg-white/50 hover:bg-white text-indigo-400 hover:text-indigo-600 rounded-xl transition-all border border-indigo-100 shadow-sm"
                                            title="Configurar Gastos Fijos"
                                        >
                                            <Calculator size={18} />
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-2 text-xs font-medium text-indigo-700/60">
                                    Gastos Fijos ({formatMoney(financialSettings.fixedExpenses)})
                                </div>
                            </div>
                            <div className="col-span-1 p-4 rounded-2xl bg-emerald-50 border border-emerald-100 relative overflow-hidden group hover:shadow-sm transition-all">
                                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Utilidad Bruta Actual</p>
                                <p className="text-2xl font-black text-emerald-700">
                                    {formatMoney(breakEvenData.totalGrossProfit)}
                                </p>
                                <p className="text-sm font-bold text-emerald-700/60">
                                    ({formatVesLabelFromUsd(breakEvenData.totalGrossProfit, dailyRate)})
                                </p>
                                <div className="w-full bg-emerald-200/50 h-1.5 rounded-full mt-3 overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${breakEvenData.progress}%` }}></div>
                                </div>
                                <div className="flex justify-between mt-2 text-[10px] font-bold text-emerald-600/60">
                                    <span>{breakEvenData.progress.toFixed(1)}% Completado</span>
                                </div>
                            </div>
                            {breakEvenData.remaining > 0 ? (
                                <div className="col-span-1 p-4 rounded-xl border border-slate-100 flex items-center gap-3">
                                    <div className="p-2 bg-slate-100 text-slate-400 rounded-lg">
                                        <Target size={18} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-slate-400">Falta para el equilibrio</p>
                                        <p className="text-sm font-black text-slate-700">
                                            {formatMoney(breakEvenData.remaining)} <span className="text-xs font-bold text-slate-400">({formatVesLabelFromUsd(breakEvenData.remaining, dailyRate)})</span>
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="col-span-1 p-4 rounded-xl border border-emerald-100 bg-emerald-50/30 flex items-center gap-3">
                                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                                        <Check size={18} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-emerald-600">Equilibrio Superado</p>
                                        <p className="text-sm font-black text-slate-700">
                                            Ganancia: {formatMoney(breakEvenData.profit)} <span className="text-xs font-bold text-emerald-600/60">({formatVesLabelFromUsd(breakEvenData.profit, dailyRate)})</span>
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="col-span-1 lg:col-span-2 h-[320px] bg-slate-50/50 rounded-2xl border border-slate-100 relative p-6 flex flex-col">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Desempeño Diario (Utilidad vs Meta)</p>
                                <div className="flex items-center gap-4">
                                    {/* Range & Nav */}
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="flex items-center bg-slate-100 p-1 rounded-xl overflow-x-auto max-w-full">
                                            {(["today", "week", "month", "year"] as TimeRange[]).map((r) => (
                                                <button
                                                    key={r}
                                                    onClick={() => setBreakEvenRange(r)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${breakEvenRange === r ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"
                                                        }`}
                                                >
                                                    {r === "today" ? "Día" : r === "week" ? "Semana" : r === "month" ? "Mes" : "Año"}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                                            <button onClick={() => setBreakEvenOffset(prev => prev - 1)} className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-slate-500 transition-all">
                                                <ChevronLeft size={16} />
                                            </button>
                                            <span className="text-[10px] font-bold text-slate-600 px-2 min-w-[100px] text-center whitespace-nowrap overflow-hidden text-ellipsis">
                                                {breakEvenData.label}
                                            </span>
                                            <button onClick={() => setBreakEvenOffset(prev => prev + 1)} className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-slate-500 transition-all">
                                                <ChevronRight size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="hidden sm:flex bg-white rounded-lg border border-slate-100 p-1 shadow-sm flex-wrap gap-1">
                                        <div className="px-2 py-1 text-[10px] font-bold text-emerald-600 flex items-center gap-1 whitespace-nowrap">
                                            <div className="w-2 h-2 rounded-full bg-emerald-400"></div> Meta Cumplida
                                        </div>
                                        <div className="px-2 py-1 text-[10px] font-bold text-rose-500 flex items-center gap-1 whitespace-nowrap">
                                            <div className="w-2 h-2 rounded-full bg-rose-400"></div> No Cumplida
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="w-full h-[240px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={breakEvenData.points.map((point) => {
                                            const dailyGross = point.grossProfit
                                            let pointTarget = 0
                                            if (breakEvenRange === 'year') pointTarget = financialSettings.fixedExpenses
                                            else if (breakEvenRange === 'today') pointTarget = financialSettings.fixedExpenses / 30 / 15
                                            else pointTarget = financialSettings.fixedExpenses / 30
                                            return {
                                                ...point,
                                                dailyGross,
                                                pointTarget,
                                                isMet: dailyGross >= pointTarget
                                            }
                                        })}
                                        margin={{ top: 20, right: 10, left: 0, bottom: 5 }}
                                    >
                                        <XAxis
                                            dataKey="label"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 9, fill: '#94a3b8' }}
                                            interval="preserveStartEnd"
                                            minTickGap={10}
                                            angle={-45}
                                            textAnchor="end"
                                            height={40}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }}
                                            tickFormatter={formatMoney}
                                            width={50}
                                        />

                                        <Tooltip
                                            content={({ active, payload }) => {
                                                if (!active || !payload?.length) return null
                                                const data = payload[0]?.payload as { label: string; dailyGross: number; pointTarget: number; grossProfit: number; revenueUsd: number; manualExpenses: number; recipeMaterialCost: number; recipeOperationalCost: number }
                                                if (!data) return null
                                                return (
                                                    <div className="bg-slate-900 text-white text-[10px] p-2 rounded-lg shadow-xl border border-white/10 z-50">
                                                        <p className="font-bold border-b border-white/10 pb-1 mb-1">{data.label}</p>
                                                        <div className="space-y-0.5">
                                                            <div className="flex justify-between gap-3">
                                                                <span className="text-slate-400">Ventas:</span>
                                                                <span className="font-mono">{formatMoney(data.revenueUsd)}</span>
                                                            </div>
                                                            <div className="flex justify-between gap-3">
                                                                <span className="text-slate-400">Costo Materiales:</span>
                                                                <span className="font-mono text-rose-300">-{formatMoney(data.recipeMaterialCost || 0)}</span>
                                                            </div>
                                                            <div className="border-t border-white/10 pt-0.5 mt-0.5 flex justify-between gap-3">
                                                                <span className="text-slate-400">Utilidad Bruta:</span>
                                                                <span className="font-mono font-bold text-emerald-300">
                                                                    {formatMoney(data.grossProfit)}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between gap-3 text-xs opacity-50 pt-1 border-t border-white/10 mt-1">
                                                                <span>Meta:</span>
                                                                <span>{formatMoney(data.pointTarget)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            }}
                                        />
                                        <Bar dataKey="dailyGross" radius={[4, 4, 0, 0]}>
                                            {breakEvenData.points.map((point, index) => {
                                                const dailyGross = point.grossProfit
                                                let pointTarget = 0
                                                if (breakEvenRange === 'year') pointTarget = financialSettings.fixedExpenses
                                                else if (breakEvenRange === 'today') pointTarget = financialSettings.fixedExpenses / 30 / 15
                                                else pointTarget = financialSettings.fixedExpenses / 30
                                                const isMet = dailyGross >= pointTarget

                                                return <Cell key={`cell-${index}`} fill={isMet ? '#4ade80' : '#fb7185'} />
                                            })}
                                        </Bar>
                                        <ReferenceLine
                                            y={breakEvenRange === 'year' ? financialSettings.fixedExpenses : breakEvenRange === 'today' ? financialSettings.fixedExpenses / 30 / 15 : financialSettings.fixedExpenses / 30}
                                            stroke="#94a3b8"
                                            strokeDasharray="3 3"
                                            strokeWidth={2}
                                            label={{ value: "Meta", position: "insideTopRight", fill: "#94a3b8", fontSize: 10, fontWeight: "bold" }}
                                            {...({ isFront: true } as any)}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* VISUAL SUMMARY & CHART */}
            <div className="bg-white p-4 md:p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-visible">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-6">
                    {/* Controls embedded in header */}
                    <div className="flex flex-col gap-2">
                        <h4 className="font-bold text-slate-800 flex items-center gap-2">
                            <TrendingUp size={20} className="text-primary-600" /> Resumen Visual
                        </h4>

                        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl self-start">
                            <button
                                type="button"
                                onClick={() => setChartOffset(prev => prev - 1)}
                                className="p-1.5 hover:bg-white hover:text-primary-600 hover:shadow-sm rounded-lg text-slate-400 transition-all"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <div className="px-2 text-xs font-bold text-slate-700 min-w-[100px] text-center capitalize">{periodLabel}</div>
                            <button
                                type="button"
                                onClick={() => setChartOffset(prev => prev + 1)}
                                className="p-1.5 hover:bg-white hover:text-primary-600 hover:shadow-sm rounded-lg text-slate-400 transition-all"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-3">
                        <div className="flex gap-2">
                            {/* Chart Mode Toggle */}
                            <div className="bg-slate-100 p-1 rounded-xl flex gap-1 overflow-x-auto max-w-full">
                                <button
                                    type="button"
                                    onClick={() => setChartMode("gross")}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${chartMode === "gross" ? "bg-white text-primary-700 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                                >
                                    Flujo
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setChartMode("net")}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${chartMode === "net" ? "bg-white text-primary-700 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                                >
                                    Ingresos
                                </button>
                            </div>

                            {/* Time Range */}
                            <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
                                {(["today", "week", "month", "year"] as const).map(r => (
                                    <button
                                        type="button"
                                        key={r}
                                        onClick={() => setRange(r)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${range === r ? "bg-white text-primary-700 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                                    >
                                        {r === "today" ? "Hoy" : r === "week" ? "Sem" : r === "month" ? "Mes" : "Año"}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {chartMode === "gross" ? (
                            <div className="flex gap-3">
                                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200"></span> Ingresos
                                </div>
                                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600 whitespace-nowrap">
                                    <span className="w-2 h-2 rounded-full bg-rose-500 shadow-sm shadow-rose-200"></span> Gastos
                                </div>
                            </div>
                        ) : (
                            <div className="flex gap-3">
                                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                                    <span className="w-2 h-2 rounded-full bg-primary-500 shadow-sm shadow-primary-200"></span> Ingresos Netos
                                </div>
                            </div>
                        )}
                    </div>
                </div>


                <div className="flex flex-col lg:flex-row gap-6 min-w-0">

                    <div
                        className={`relative w-full h-64 lg:h-auto lg:flex-1 rounded-2xl ${summaryChartStats.hasData ? "bg-slate-50/50 border border-slate-100 cursor-crosshair" : "bg-slate-50/50 border-2 border-dashed border-slate-100"}`}

                        onClick={(e) => {
                            if (!summaryChartStats.hasData) return
                            if (!summaryChartData.points.length) return
                            const rect = e.currentTarget.getBoundingClientRect()
                            const x = e.clientX - rect.left
                            const width = rect.width
                            if (width <= 0) return
                            const index = summaryChartData.points.length > 1
                                ? Math.min(
                                    Math.max(0, Math.round((x / width) * (summaryChartData.points.length - 1))),
                                    summaryChartData.points.length - 1,
                                )
                                : 0
                            const point = summaryChartData.points[index]
                            const resolvedDay = resolveDayFromSummaryPoint(point.date)
                            setSelectedDay(resolvedDay)
                            setShowDayDetails(true)
                            dayDetailsCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                        }}
                    >
                        {!summaryChartStats.hasData ? (
                            <div className="h-full flex items-center justify-center">
                                <p className="text-slate-400 font-medium text-sm flex items-center gap-2">
                                    <TrendingUp size={18} /> Insuficientes datos para graficar
                                </p>
                            </div>
                        ) : (
                            <>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart
                                        data={summaryChartData.points}
                                        margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                                    >
                                        <XAxis
                                            dataKey="label"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }}
                                            interval="preserveStartEnd"
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }}
                                            tickFormatter={formatSummaryTick}
                                            domain={chartMode === 'net' ? [summaryChartStats.netMin, summaryChartStats.netMax] : [0, 'auto']}
                                            width={40}
                                        />
                                        {chartMode === 'net' && (
                                            <ReferenceLine y={0} stroke="#cbd5f5" strokeWidth={2} />
                                        )}
                                        <Tooltip
                                            content={({ active, payload }) => {
                                                if (!active || !payload?.length) return null
                                                const point = payload[0]?.payload as SummaryChartPoint
                                                if (!point) return null
                                                return (
                                                    <div className="bg-slate-900/90 backdrop-blur text-white p-3 rounded-xl shadow-xl flex flex-col items-center gap-1 min-w-[160px] border border-white/10">
                                                        <div className="text-[10px] font-bold text-slate-400 uppercase border-b border-white/10 pb-1 mb-2 w-full text-center whitespace-nowrap">
                                                            {range === "today"
                                                                ? point.label
                                                                : range === "year"
                                                                    ? point.date.toLocaleDateString("es-VE", { month: "long" })
                                                                    : point.date.toLocaleDateString("es-VE", { weekday: "short", day: "numeric", month: "short" })}
                                                        </div>
                                                        <div className="flex flex-col gap-1.5 w-full">
                                                            {chartMode === "gross" ? (
                                                                <>
                                                                    <div className="flex justify-between items-center gap-4 text-xs">
                                                                        <span className="text-emerald-300 font-bold flex items-center gap-1">
                                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Ingresos
                                                                        </span>
                                                                        <span className="font-bold">{formatMoney(point.incomeUsd)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center gap-4 text-xs">
                                                                        <span className="text-rose-300 font-bold flex items-center gap-1">
                                                                            <div className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Gastos
                                                                        </span>
                                                                        <span className="font-bold">{formatMoney(point.expenseUsd)}</span>
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <div className="flex justify-between items-center gap-4 text-xs">
                                                                    <span className="text-indigo-300 font-bold flex items-center gap-1">
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Ingresos Netos
                                                                    </span>
                                                                    <span className="font-bold">{formatMoney(point.netUsd)}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            }}
                                        />
                                        {chartMode === "gross" ? (
                                            <>
                                                <Line
                                                    type="monotone"
                                                    dataKey="incomeUsd"
                                                    stroke="#10b981"
                                                    strokeWidth={3}
                                                    dot={false}
                                                    activeDot={{ r: 5, fill: '#fff', stroke: '#10b981', strokeWidth: 3 }}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="expenseUsd"
                                                    stroke="#f43f5e"
                                                    strokeWidth={3}
                                                    dot={false}
                                                    activeDot={{ r: 5, fill: '#fff', stroke: '#f43f5e', strokeWidth: 3 }}
                                                />
                                            </>
                                        ) : (
                                            <Line
                                                type="monotone"
                                                dataKey="netUsd"
                                                stroke="#6366f1"
                                                strokeWidth={3}
                                                dot={false}
                                                activeDot={{ r: 5, fill: '#fff', stroke: '#6366f1', strokeWidth: 3 }}
                                            />
                                        )}
                                    </LineChart>
                                </ResponsiveContainer>
                            </>
                        )}
                    </div>

                    {/* VISIBLE STATS CONTAINER (Vertical) */}
                    <div className="grid grid-cols-2 lg:flex lg:flex-col gap-3 w-full lg:w-72 shrink-0">
                        <div className="flex-1 min-h-[70px] p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3 hover:shadow-sm transition-all group/stat">
                            <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-100 text-emerald-500 group-hover/stat:scale-110 transition-transform">
                                <TrendingUp size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ingresos del periodo</p>
                                <p className="text-lg font-black text-slate-800">{formatMoney(summaryChartStats.totalIncomeUsd)}</p>
                                <p className="text-xs font-bold text-slate-500">({formatVesAmount(summaryChartStats.totalIncomeVes)})</p>
                            </div>
                        </div>
                        <div className="flex-1 min-h-[70px] p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3 hover:shadow-sm transition-all group/stat">
                            <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-100 text-rose-500 group-hover/stat:scale-110 transition-transform">
                                <TrendingDown size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Gastos del periodo</p>
                                <p className="text-lg font-black text-slate-800">{formatMoney(summaryChartStats.totalExpenseUsd)}</p>
                                <p className="text-xs font-bold text-slate-500">({formatVesAmount(summaryChartStats.totalExpenseVes)})</p>
                            </div>
                        </div>
                        <div className="col-span-2 lg:col-span-1 flex-1 min-h-[70px] p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3 hover:shadow-sm transition-all group/stat">
                            <div className={`p-3 bg-white rounded-xl shadow-sm border border-slate-100 group-hover/stat:scale-110 transition-transform ${summaryChartStats.totalNetVes >= 0 ? "text-indigo-500" : "text-rose-500"}`}>
                                <Wallet size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Utilidad Neta del periodo</p>
                                <p className={`text-lg font-black ${summaryChartStats.totalNetUsd >= 0 ? "text-indigo-600" : "text-rose-500"}`}>
                                    {formatMoney(summaryChartStats.totalNetUsd)}
                                </p>
                                <p className={`text-xs font-bold ${summaryChartStats.totalNetUsd >= 0 ? "text-indigo-500/80" : "text-rose-500/80"}`}>
                                    ({formatVesAmount(summaryChartStats.totalNetVes)})
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="h-4"></div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                <div
                    ref={dayDetailsCardRef}
                    className="bg-white rounded-[2rem] border border-slate-100 shadow-sm flex flex-col h-[500px] relative overflow-hidden"
                >
                    {/* LIST SLIDE */}
                    <div className={`absolute inset-0 flex flex-col p-6 transition-transform duration-300 ease-in-out ${showDayDetails ? '-translate-x-full' : 'translate-x-0'}`}>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                            <div className="flex flex-col gap-3 w-full sm:w-auto">
                                <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                    <Calendar size={18} className="text-indigo-500" /> Ventas por Día
                                </h4>
                                <div className="flex flex-wrap items-center gap-2 w-full">
                                    <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                                        <button
                                            onClick={() => setDayRange("month")}
                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${dayRange === "month" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                                        >
                                            Mes
                                        </button>
                                        <button
                                            onClick={() => setDayRange("year")}
                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${dayRange === "year" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                                        >
                                            Año
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                                        <button
                                            onClick={() => setDayRangeOffset((prev) => prev - 1)}
                                            className="p-1 hover:bg-white hover:shadow-sm rounded-lg text-slate-400 hover:text-slate-600 transition-all"
                                        >
                                            <ChevronLeft size={14} />
                                        </button>
                                        <span className="text-[10px] font-bold text-slate-600 uppercase text-center leading-tight whitespace-normal max-w-[160px]">
                                            {dayRangeMeta.label}
                                        </span>
                                        <button
                                            onClick={() => setDayRangeOffset((prev) => prev + 1)}
                                            className="p-1 hover:bg-white hover:shadow-sm rounded-lg text-slate-400 hover:text-slate-600 transition-all"
                                        >
                                            <ChevronRight size={14} />
                                        </button>
                                    </div>
                                </div>
                                <div className="relative group/search w-full sm:w-56">
                                    <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${ticketSearchTerm ? 'text-indigo-500' : 'text-slate-400 group-hover/search:text-slate-500'}`} />
                                    <input
                                        type="text"
                                        placeholder="Buscar ticket..."
                                        value={ticketSearchTerm}
                                        onChange={(e) => setTicketSearchTerm(e.target.value)}
                                        className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium text-slate-600 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-200 transition-all w-full shadow-inner"
                                    />
                                    {ticketSearchTerm && (
                                        <button
                                            onClick={() => setTicketSearchTerm("")}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-slate-500 rounded-md transition-colors"
                                        >
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-1 rounded-full border border-slate-200 bg-white text-[10px] font-bold text-slate-600">
                                    {canConvertVes ? dailyRate.toFixed(2) : "--"} Bs/USD
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setConvertVesToUsd((prev) => !prev)}
                                    className="px-3 py-1.5 rounded-full border border-slate-200 bg-white text-[10px] font-bold text-slate-600 hover:border-indigo-200 hover:text-indigo-600 transition-colors disabled:opacity-60"
                                    disabled={!canConvertVes}
                                >
                                    {convertVesToUsd ? "Mostrar Bs" : "Bs -> USD"}
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                            {dayListIsEmpty ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50">
                                    <Receipt size={48} className="mb-2" />
                                    <p className="text-sm font-medium">{ticketSearchTerm ? "Sin resultados" : "Sin actividad registrada"}</p>
                                </div>
                            ) : dayRange === "year" ? (
                                monthGroups.map((group) => {
                                    const isExpanded = expandedMonthKey === group.key
                                    const showMonthDays = ticketSearchQuery ? true : isExpanded
                                    const netVes = group.revenueVes - group.expensesVes
                                    const netUsd = group.revenueUsd - group.expensesUsd
                                    return (
                                        <div key={group.key} className="rounded-2xl bg-slate-50 border border-slate-100 overflow-hidden">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (ticketSearchQuery) return
                                                    setExpandedMonthKey((prev) => (prev === group.key ? null : group.key))
                                                }}
                                                className="w-full p-4 flex items-center justify-between gap-4 text-left hover:bg-slate-100 transition-colors"
                                            >
                                                <div className="flex items-center gap-4 min-w-0">
                                                    <div className="w-12 h-12 rounded-xl bg-white flex flex-col items-center justify-center text-slate-500 border border-slate-200 shadow-sm">
                                                        <span className="text-[11px] uppercase font-bold text-indigo-400">
                                                            {group.date.toLocaleDateString('es-VE', { month: 'short' }).replace(".", "").trim()}
                                                        </span>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-slate-700 text-sm capitalize">{group.date.toLocaleDateString('es-VE', { month: 'long' })}</p>
                                                        <div className="mt-1 flex flex-col gap-1 text-[10px] uppercase font-bold text-slate-400">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                                                    <ArrowUpRight size={10} />
                                                                    {formatDailyVes(group.revenueVes)}
                                                                </div>
                                                                <div className="flex items-center gap-1 text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                                                                    <ArrowDownRight size={10} />
                                                                    {formatDailyVes(group.expensesVes)}
                                                                </div>
                                                                <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${netVes >= 0 ? "text-indigo-600 bg-indigo-50" : "text-rose-600 bg-rose-50"} whitespace-nowrap`}>
                                                                    <Wallet size={10} />
                                                                    Neto {formatDailyVes(netVes)}
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                                                    <ArrowUpRight size={10} />
                                                                    {formatMoney(group.revenueUsd)}
                                                                </div>
                                                                <div className="flex items-center gap-1 text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                                                                    <ArrowDownRight size={10} />
                                                                    {formatMoney(group.expensesUsd)}
                                                                </div>
                                                                <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${netUsd >= 0 ? "text-indigo-600 bg-indigo-50" : "text-rose-600 bg-rose-50"} whitespace-nowrap`}>
                                                                    <Wallet size={10} />
                                                                    Neto {formatMoney(netUsd)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 shrink-0">
                                                    <div className="text-right">
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Días</p>
                                                        <p className="text-lg font-black text-slate-800">{group.days.length}</p>
                                                    </div>
                                                    <ChevronRight size={16} className={`text-slate-400 transition-transform ${showMonthDays ? "rotate-90" : ""}`} />
                                                </div>
                                            </button>
                                            {showMonthDays && (
                                                <div className="px-4 pb-4 space-y-3">
                                                    {group.days.map(renderDayCard)}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })
                            ) : (
                                filteredDailyStats.map(renderDayCard)
                            )}
                        </div>
                    </div>

                    {/* DETAILS SLIDE */}
                    <div className={`absolute inset-0 flex flex-col p-6 bg-white transition-transform duration-300 ease-in-out ${showDayDetails ? 'translate-x-0' : 'translate-x-full'}`}>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setShowDayDetails(false)}
                                    className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                                >
                                    <ChevronLeft size={20} className="text-slate-600" />
                                </button>
                                <h4 className="font-bold text-slate-800 text-lg">
                                    {selectedDay ? selectedDay.date.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Detalle'}
                                </h4>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-1 rounded-full border border-slate-200 bg-white text-[10px] font-bold text-slate-600">
                                    Tasa: {canConvertVes ? dailyRate.toFixed(2) : "--"} Bs/USD
                                </span>
                            </div>
                        </div>
                        {selectedDay && (
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                <div className="space-y-4">
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                                            <p className="text-[10px] font-bold uppercase text-emerald-600 mb-1">Ingresos</p>
                                            <p className="text-xl font-black text-emerald-700 whitespace-nowrap">{formatMoney(selectedDay.revenueUsd)}</p>
                                            <p className="text-xs font-bold text-emerald-700/60 whitespace-nowrap">({formatVesAmount(selectedDay.revenueVes)})</p>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100">
                                            <p className="text-[10px] font-bold uppercase text-rose-600 mb-1">Gastos</p>
                                            <p className="text-xl font-black text-rose-700 whitespace-nowrap">{formatMoney(selectedDay.expensesUsd)}</p>
                                            <p className="text-xs font-bold text-rose-700/60 whitespace-nowrap">({formatVesAmount(selectedDay.expensesVes)})</p>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100">
                                            <p className="text-[10px] font-bold uppercase text-blue-600 mb-1">Neto</p>
                                            <p className="text-xl font-black text-blue-700 whitespace-nowrap">{formatMoney(selectedDayNet.netUsd)}</p>
                                            <p className="text-xs font-bold text-blue-700/60 whitespace-nowrap">({formatVesAmount(selectedDayNet.netVes)})</p>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                                            <h5 className="font-bold text-slate-700">Transacciones ({filteredTransactions.length})</h5>
                                            <div className="relative group/search w-full sm:w-48">
                                                <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${ticketSearchTerm ? 'text-indigo-500' : 'text-slate-400 group-hover/search:text-slate-500'}`} />
                                                <input
                                                    type="text"
                                                    placeholder="Buscar ticket..."
                                                    value={ticketSearchTerm}
                                                    onChange={(e) => setTicketSearchTerm(e.target.value)}
                                                    className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium text-slate-600 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-200 transition-all w-full shadow-inner"
                                                />
                                                {ticketSearchTerm && (
                                                    <button
                                                        onClick={() => setTicketSearchTerm("")}
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-slate-500 rounded-md transition-colors"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        {/* Allow simpler list here for now since transaction details are complex */}
                                        <div className="space-y-2">
                                            {filteredTransactions.map((t, idx) => {
                                                const transactionId = resolveTransactionDisplayId(t)
                                                const amountValue = safeNumber(t.total ?? t.amount ?? 0)
                                                const isIncome = t.kind === "sale"

                                                // Determine type
                                                const isExpense = t.kind === "expense"
                                                const isManualIncome = isIncome && (!t.ticketId && !t.fullDetail?.ticketId && (t.fullDetail?.id?.startsWith("manual-") || t.fullDetail?.id?.startsWith("income-") || !transactionId))
                                                const isTicket = isIncome && !isManualIncome

                                                const amountPrefix = isIncome ? "+" : "-"
                                                const amountLabel = formatMoney(Math.abs(amountValue))
                                                const canOpenDetails = t.kind === "sale"
                                                    ? Boolean(t.fullDetail)
                                                    : Boolean(t.expenseDetail)

                                                // Colors and Icons
                                                let icon = <Ticket size={16} />
                                                let bgClass = "bg-slate-50"
                                                let borderClass = "border-slate-100"
                                                let textClass = "text-slate-700"
                                                let iconBgClass = "bg-white text-slate-400"

                                                if (isExpense) {
                                                    icon = <TrendingDown size={16} />
                                                    bgClass = "bg-rose-50/50"
                                                    borderClass = "border-rose-100/50"
                                                    textClass = "text-rose-900"
                                                    iconBgClass = "bg-rose-100 text-rose-600"
                                                } else if (isManualIncome) {
                                                    icon = <TrendingUp size={16} />
                                                    bgClass = "bg-emerald-50/50"
                                                    borderClass = "border-emerald-100/50"
                                                    textClass = "text-emerald-900"
                                                    iconBgClass = "bg-emerald-100 text-emerald-600"
                                                }

                                                return (
                                                    <div
                                                        key={idx}
                                                        onClick={() => {
                                                            if (canOpenDetails) handleTransactionClick(t)
                                                        }}
                                                        className={`p-3 rounded-xl border flex justify-between items-center group/item transition-all ${bgClass} ${borderClass} ${canOpenDetails ? "cursor-pointer hover:scale-[1.01] hover:shadow-sm" : ""}`}
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${iconBgClass}`}>
                                                                {icon}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className={`text-xs font-bold truncate ${textClass}`}>
                                                                    {t.description || (isManualIncome ? (t.items?.[0]?.name || "Ingreso Manual") : transactionId ? `#${transactionId}` : "Transaccion")}
                                                                </p>
                                                                <p className="text-[10px] text-slate-400 truncate">
                                                                    {isTicket && t.items?.length ? `${t.items.length} items` : (isExpense || isManualIncome) ? "Registro manual" : "Venta"}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-3">
                                                            <span className={`text-sm font-black ${isIncome ? "text-emerald-600" : "text-rose-500"}`}>
                                                                {amountPrefix}{amountLabel}
                                                            </span>
                                                            {isTicket && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        openSaleTicket(t)
                                                                    }}
                                                                    className="w-7 h-7 rounded-lg bg-white shadow-sm border border-slate-200 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all active:scale-90 shrink-0 opacity-0 group-hover/item:opacity-100"
                                                                    title="Ver detalles"
                                                                >
                                                                    <Eye size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col h-[500px]">
                    <div className="flex flex-col gap-4 mb-4">
                        <div className="flex justify-between items-center">
                            <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                <ShoppingBag size={18} className="text-rose-500" /> Top Productos
                            </h4>
                            <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-1 border border-slate-100">
                                <button
                                    onClick={() => setTopProductsOffset(prev => prev - 1)}
                                    className="p-1 hover:bg-white hover:shadow-sm rounded-lg text-slate-400 hover:text-slate-600 transition-all"
                                >
                                    <ChevronLeft size={14} />
                                </button>
                                <span className="text-[10px] font-bold text-slate-600 uppercase text-center leading-tight whitespace-normal break-words max-w-[180px]">
                                    {topProductsData.label}
                                </span>
                                <button
                                    onClick={() => setTopProductsOffset(prev => prev + 1)}
                                    className="p-1 hover:bg-white hover:shadow-sm rounded-lg text-slate-400 hover:text-slate-600 transition-all"
                                >
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 w-full">
                            <div className="bg-slate-100 p-1 rounded-xl flex gap-1 w-full sm:w-auto overflow-x-auto">
                                {(["today", "week", "month", "year"] as const).map(r => (
                                    <button
                                        key={r}
                                        onClick={() => setTopProductsRange(r)}
                                        className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${topProductsRange === r ? "bg-white text-rose-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                                    >
                                        {r === "today" ? "Hoy" : r === "week" ? "Sem" : r === "month" ? "Mes" : "Año"}
                                    </button>
                                ))}
                            </div>
                            <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
                                <button
                                    onClick={() => setTopProductsSort("money")}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${topProductsSort === "money" ? "bg-white text-rose-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                                >
                                    Dinero
                                </button>
                                <button
                                    onClick={() => setTopProductsSort("units")}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${topProductsSort === "units" ? "bg-white text-rose-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                                >
                                    Unidades
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                        {topProductsData.list.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50">
                                <ShoppingBag size={48} className="mb-2" />
                                <p className="text-sm font-medium">No hay datos suficientes</p>
                            </div>
                        ) : (
                            topProductsData.list.map((p, i) => (
                                <div key={i} className="group">
                                    <div className="flex justify-between items-end mb-1">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <span className={`w-5 h-5 flex items-center justify-center rounded-md text-[10px] font-black ${i === 0 ? "bg-yellow-100 text-yellow-700" : i === 1 ? "bg-slate-200 text-slate-600" : i === 2 ? "bg-orange-100 text-orange-700" : "bg-slate-50 text-slate-400"}`}>
                                                #{i + 1}
                                            </span>
                                            <span className="text-sm font-bold text-slate-800 truncate">{p.name}</span>
                                        </div>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden relative">
                                        {/* Dynamic width based on sort metric */}
                                        <div
                                            className={`h-full rounded-full ${i === 0 ? "bg-yellow-400" : i === 1 ? "bg-slate-400" : i === 2 ? "bg-orange-400" : "bg-indigo-400"}`}
                                            style={{ width: `${((topProductsSort === 'money' ? p.rev : p.qty) / topProductsData.maxVal * 100)}%` }}
                                        ></div>
                                    </div>
                                    <div className="mt-1 flex justify-between text-[10px] text-slate-400 font-medium">
                                        <span className={topProductsSort === 'units' ? "text-slate-600 font-bold" : ""}>{p.qty} unidades</span>
                                        <span className={topProductsSort === 'money' ? "text-slate-600 font-bold" : ""}>{currency === "USD" ? formatMoney(p.rev) : formatVesLabelFromUsd(p.rev, dailyRate)}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>




            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-visible mt-6">
                <div className="flex flex-col gap-8">
                    {/* Header Controls */}
                    <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
                        <div>
                            <h4 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                                <Activity size={20} className="text-emerald-500" /> Actividad Diaria
                            </h4>
                            <p className="text-slate-400 text-sm mt-1">Métricas de operación en detalle</p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto min-w-0 flex-wrap justify-end">
                            {/* Series Toggles */}
                            <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100 overflow-x-auto max-w-full">
                                <button
                                    onClick={() => setActivityVisibleSeries(prev => ({ ...prev, transactions: !prev.transactions }))}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${activityVisibleSeries.transactions ? 'bg-white shadow-sm text-indigo-600 ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    <span className={`w-2 h-2 rounded-full ${activityVisibleSeries.transactions ? 'bg-indigo-500' : 'bg-slate-300'}`}></span>
                                    Transacciones
                                </button>
                                <button
                                    onClick={() => setActivityVisibleSeries(prev => ({ ...prev, units: !prev.units }))}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${activityVisibleSeries.units ? 'bg-white shadow-sm text-amber-600 ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    <span className={`w-2 h-2 rounded-full ${activityVisibleSeries.units ? 'bg-amber-500' : 'bg-slate-300'}`}></span>
                                    Unidades
                                </button>
                            </div>

                            {/* Range & Nav */}
                            <div className="flex flex-wrap items-center gap-2 ml-auto sm:ml-0 justify-end">
                                <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                                    {(["today", "week", "month", "year"] as TimeRange[]).map((r) => (
                                        <button
                                            key={r}
                                            onClick={() => setActivityRange(r)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activityRange === r ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"
                                                }`}
                                        >
                                            {r === "today" ? "Día" : r === "week" ? "Semana" : r === "month" ? "Mes" : "Año"}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                                    <button onClick={() => setActivityOffset(prev => prev - 1)} className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-slate-500 transition-all">
                                        <ChevronLeft size={16} />
                                    </button>
                                    <span className="text-[10px] font-bold text-slate-600 px-2 min-w-[100px] text-center whitespace-nowrap overflow-hidden text-ellipsis">
                                        {activityData.label}
                                    </span>
                                    <button onClick={() => setActivityOffset(prev => prev + 1)} className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-slate-500 transition-all">
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-6 min-w-0">

                        {/* CHART AREA */}
                        <div className="relative h-64 lg:h-[280px] lg:flex-1 w-full mt-2 min-w-0">
                            {activityData.points.length > 1 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart
                                        data={activityData.points}
                                        margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                                    >
                                        <XAxis
                                            dataKey="label"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }}
                                            interval="preserveStartEnd"
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }}
                                            tickFormatter={formatActivityTick}
                                            domain={[0, maxActivityValue]}
                                            width={40}
                                        />
                                        <Tooltip
                                            content={({ active, payload }) => {
                                                if (!active || !payload?.length) return null
                                                const point = payload[0]?.payload as typeof activityData.points[0]
                                                if (!point) return null
                                                return (
                                                    <div className="bg-slate-900/90 backdrop-blur text-white p-3 rounded-xl shadow-xl flex flex-col items-center gap-1 min-w-[140px] border border-white/10">
                                                        <div className="text-[10px] font-bold text-slate-400 uppercase border-b border-white/10 pb-1 mb-2 w-full text-center whitespace-nowrap">
                                                            {activityRange === 'today' ? point.label : point.date.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'short' })}
                                                        </div>
                                                        <div className="flex flex-col gap-1.5 w-full">
                                                            {activityVisibleSeries.transactions && (
                                                                <div className="flex justify-between items-center gap-4 text-xs">
                                                                    <span className="text-indigo-300 font-bold flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Transacciones</span>
                                                                    <span className="font-bold">{point.transactions}</span>
                                                                </div>
                                                            )}
                                                            {activityVisibleSeries.units && (
                                                                <div className="flex justify-between items-center gap-4 text-xs">
                                                                    <span className="text-amber-300 font-bold flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Unidades</span>
                                                                    <span className="font-bold">{point.units}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            }}
                                        />
                                        {activityVisibleSeries.transactions && (
                                            <Line
                                                type="monotone"
                                                dataKey="transactions"
                                                stroke="#6366f1"
                                                strokeWidth={3}
                                                dot={false}
                                                activeDot={{ r: 5, fill: '#fff', stroke: '#6366f1', strokeWidth: 3 }}
                                            />
                                        )}
                                        {activityVisibleSeries.units && (
                                            <Line
                                                type="monotone"
                                                dataKey="units"
                                                stroke="#f59e0b"
                                                strokeWidth={3}
                                                dot={false}
                                                activeDot={{ r: 5, fill: '#fff', stroke: '#f59e0b', strokeWidth: 3 }}
                                            />
                                        )}
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-100">
                                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-3">
                                        <Activity size={32} className="text-slate-300" />
                                    </div>
                                    <p className="text-slate-500 font-bold">Sin datos suficientes</p>
                                    <p className="text-slate-400 text-xs mt-1">Necesitamos al menos 2 puntos de datos</p>
                                </div>
                            )}
                        </div>

                        {/* Summary Cards Vertical */}
                        <div className="grid grid-cols-2 lg:flex lg:flex-col gap-4 w-full lg:w-72 shrink-0">
                            <div className="flex-1 min-h-[100px] p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex items-center justify-between group hover:bg-indigo-50 transition-colors">
                                <div>
                                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Total Transacciones</p>
                                    <p className="text-2xl font-black text-indigo-900">{activityData.totalTransactions}</p>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-white text-indigo-500 shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Receipt size={18} />
                                </div>
                            </div>
                            <div className="flex-1 min-h-[100px] p-4 rounded-2xl bg-amber-50/50 border border-amber-100 flex items-center justify-between group hover:bg-amber-50 transition-colors">
                                <div>
                                    <p className="text-[10px] font-bold text-amber-500/80 uppercase tracking-widest mb-1">Unidades Totales</p>
                                    <p className="text-2xl font-black text-amber-900">{activityData.totalUnits}</p>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-white text-amber-500 shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Ticket size={18} />
                                </div>
                            </div>
                        </div>

                    </div>
                    {/* Spacer for X-axis labels */}
                    <div className="h-6"></div>
                </div>
            </div>

            {showFinancialSettings && (
                <FinancialSettingsModal
                    onClose={() => setShowFinancialSettings(false)}
                    onSave={(newSettings) => setFinancialSettings(newSettings)}
                />
            )}
            {renderExpenseDetailModal()}

            {selectedTicket && (

                <TicketModal
                    ticket={selectedTicket}
                    onClose={() => setSelectedTicket(null)}
                    formatMoney={formatMoney}
                    exchangeRate={dailyRate}
                />
            )}
        </div >
    )
}
