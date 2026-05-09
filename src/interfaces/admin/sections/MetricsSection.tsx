import {
    Loader2,
    Zap,
    AlertTriangle,
    ArrowDownLeft,
    ArrowUpRight,
    BadgeCheck,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Clock,
    Gift,
    Hash,
    HelpCircle,
    Phone,
    Search,
    ShoppingBag,
    Sparkles,
    Ticket,
    Trash2,
    User,
    X,
} from "lucide-react"
import { useMemo, useState } from "react"
import type { GeneratedQrRecord, PaymentTicket, SalesEvent } from "../../../types/app"
import type { DashboardStats, LookupUserResponse } from "../../../api/secure"
import type { LevelDefinition } from "../../../types/loyalty"
import type { CouponDto, CouponStats, UserActivityDto, UserLevelState } from "../../../types/userState"
import TicketModal from "../components/TicketModal"
import * as Tooltip from '@radix-ui/react-tooltip';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    BarChart,
    Bar,
    Cell
} from "recharts"
import { convertUsdToVes, convertVesToUsd, roundUsd } from "../../../utils/currency"


type CheckoutCustomerState = {
    email: string
    cedula: string
    userId?: string | null
    levelState: UserLevelState | null
    coupons: CouponDto[]
    loading: boolean
    error: string | null
}

export type MetricsSectionProps = {
    salesEvents: SalesEvent[]
    qrRegistry: GeneratedQrRecord[]
    couponStats: CouponStats
    registeredUsers: number
    activeLevelState?: UserLevelState | null
    levelLadder: LevelDefinition[]
    checkoutCustomer: CheckoutCustomerState
    dashboardStats: DashboardStats | null
    tickets: PaymentTicket[]
    dailyRate: number
    onLookupUser: (query: { cedula?: string; email?: string }) => Promise<LookupUserResponse>
    onDeleteUser: (userId: string) => void | Promise<{ deleted: number } | void>
    isAdmin?: boolean
}

type TimeRange = 'today' | 'week' | 'month' | 'year'

// --- Helpers ---

// Get start of week (Monday)
const getStartOfWeek = (d: Date) => {
    const date = new Date(d)
    const day = date.getDay()
    const diff = date.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is sunday
    return new Date(date.setDate(diff))
}

const getEndOfWeek = (d: Date) => {
    const date = getStartOfWeek(d)
    date.setDate(date.getDate() + 6)
    return date
}

const getStartOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
const getEndOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0)

const toIndoDate = (d: Date) => {
    const year = d.getUTCFullYear()
    const month = String(d.getUTCMonth() + 1).padStart(2, "0")
    const day = String(d.getUTCDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
}

type LookupStatus = {
    tone: "idle" | "loading" | "success" | "error"
    message?: string
}

type PurchaseItem = {
    name: string
    quantity: number
    price: number
    points?: number
    productId?: string
    noPointsByCoupon?: boolean
    coveredUnits?: number
    eligibleUnits?: number
    pointsAwarded?: number
}

type PurchaseGroup = {
    id: string
    claimedAt: string
    label: string
    status: string
    items: PurchaseItem[]
    points: number
    total: number | null
    currency: string | null
    discount: number | null
    couponCode: string | null
    ticket?: PaymentTicket | null
}

type PurchaseEntry = {
    kind: "ticket" | "purchase"
    id: string
    date: string
    label: string
    status: string
    itemsCount: number
    total: number | null
    currency: string | null
    ticket?: PaymentTicket
    purchase?: PurchaseGroup
}

type DetailModalState =
    | { type: "ticket"; ticket: PaymentTicket }
    | { type: "purchase"; purchase: PurchaseGroup }
    | null

const normalizeEmail = (value?: string | null) => value?.trim().toLowerCase() || null
const normalizeCedula = (value?: string | null) => {
    const digits = value?.replace(/\D/g, "")
    return digits && digits.length ? digits : null
}

const formatDateTime = (value?: string | null) => {
    if (!value) return "Sin fecha"
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return "Sin fecha"
    return parsed.toLocaleString("es-VE", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    })
}

const formatMoney = (value?: number | null) => {
    const num = Number(value ?? 0)
    if (!Number.isFinite(num)) return "0.00"
    return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const formatTicketLabel = (rawId?: string | null) => {
    if (!rawId) return "Pedido"
    const digits = rawId.replace(/\D/g, "")
    if (!digits) return `Pedido ${rawId}`
    return `Pedido #${digits.padStart(6, "0")}`
}

const normalizeTicketId = (value?: string | number | null) => {
    if (value === null || value === undefined) return null
    const digits = String(value).replace(/\D/g, "")
    if (!digits) return null
    const parsed = Number.parseInt(digits, 10)
    if (Number.isNaN(parsed)) return null
    return String(parsed)
}

const formatDualMoney = (
    amount?: number | null,
    currency?: string | null,
    exchangeRate?: number,
) => {
    const value = Number(amount ?? NaN)
    if (!Number.isFinite(value)) return "Sin monto"
    const normalizedCurrency = (currency || "USD").toUpperCase()
    const rate = Number(exchangeRate ?? NaN)
    const hasRate = Number.isFinite(rate) && rate > 0
    const isUsd = normalizedCurrency === "USD" || normalizedCurrency === "US$"
    const normalizedValue = roundUsd(value)
    const bsValue = isUsd ? (hasRate ? convertUsdToVes(normalizedValue, rate) : null) : value
    const usdValue = isUsd ? normalizedValue : (hasRate ? convertVesToUsd(value, rate) : null)
    const bsLabel = bsValue !== null ? `Bs ${formatMoney(bsValue)}` : null
    const usdLabel = usdValue !== null ? `USD ${formatMoney(usdValue)}` : null
    if (bsLabel && usdLabel) return `${bsLabel} (${usdLabel})`
    if (bsLabel) return bsLabel
    if (usdLabel) return usdLabel
    return formatMoney(value)
}

const getItemsSubtotal = (items?: { price?: number; quantity?: number }[] | null) => {
    if (!items?.length) return 0
    return items.reduce((sum, item) => {
        const quantity = Math.max(1, Number(item.quantity ?? 1) || 1)
        const price = Number(item.price ?? 0)
        if (!Number.isFinite(price) || !Number.isFinite(quantity)) return sum
        return sum + price * quantity
    }, 0)
}

const getCoverageLabel = (item: {
    quantity?: number
    coveredUnits?: number
    noPointsByCoupon?: boolean
}) => {
    const quantity = Math.max(1, Number(item.quantity ?? 1) || 1)
    const coveredUnits = Math.max(0, Number(item.coveredUnits ?? 0) || 0)
    if (coveredUnits <= 0 && !item.noPointsByCoupon) return null
    if (coveredUnits >= quantity) return "Gratis"
    if (coveredUnits > 0) return `${coveredUnits} gratis`
    return "Promo"
}

const formatPoints = (value?: number | null) => {
    const num = Number(value ?? 0)
    if (!Number.isFinite(num)) return "0"
    return Number.isInteger(num) ? String(num) : num.toFixed(2)
}

const getItemPointsTotal = (item: PurchaseItem) => {
    if (item.noPointsByCoupon) return 0
    const rawPointsAwarded = Number(item.pointsAwarded)
    if (Number.isFinite(rawPointsAwarded)) return Math.max(0, rawPointsAwarded)

    const quantity = Math.max(1, Number(item.quantity ?? 1) || 1)
    const coveredUnits = Math.max(0, Number(item.coveredUnits ?? 0) || 0)
    const eligibleUnits = Number.isFinite(item.eligibleUnits)
        ? Math.max(0, Number(item.eligibleUnits ?? 0))
        : Math.max(0, quantity - coveredUnits)
    const hasCoverageMeta =
        Number.isFinite(item.coveredUnits) ||
        Number.isFinite(item.eligibleUnits) ||
        item.noPointsByCoupon
    const rawPoints = Number(item.points ?? NaN)

    if (hasCoverageMeta) {
        const pointsPerUnit = Number.isFinite(rawPoints) ? Math.max(0, rawPoints) : 0
        return Math.max(0, pointsPerUnit * eligibleUnits)
    }

    if (!Number.isFinite(rawPoints)) return 0
    return Math.max(0, rawPoints)
}

const hasCouponCoverage = (items?: PurchaseItem[] | null) => {
    if (!items?.length) return false
    return items.some((item) => {
        const coveredUnits = Math.max(0, Number(item.coveredUnits ?? 0) || 0)
        return coveredUnits > 0 || Boolean(item.noPointsByCoupon)
    })
}

const getActivityMeta = (type: UserActivityDto["type"]) => {
    switch (type) {
        case "WIN":
            return {
                label: "Cupon ganado",
                icon: <Gift size={20} className="text-emerald-600" />,
                pill: "bg-emerald-50 text-emerald-700 border-emerald-100",
            }
        case "USE":
            return {
                label: "Cupon canjeado",
                icon: <Ticket size={20} className="text-rose-600" />,
                pill: "bg-rose-50 text-rose-700 border-rose-100",
            }
        case "SEND":
            return {
                label: "Cupon regalado",
                icon: <ArrowUpRight size={20} className="text-amber-600" />,
                pill: "bg-amber-50 text-amber-700 border-amber-100",
            }
        case "RECEIVE":
            return {
                label: "Cupon recibido",
                icon: <ArrowDownLeft size={20} className="text-sky-600" />,
                pill: "bg-sky-50 text-sky-700 border-sky-100",
            }
        case "LEVEL_UP":
            return {
                label: "Subio de nivel",
                icon: <BadgeCheck size={20} className="text-indigo-600" />,
                pill: "bg-indigo-50 text-indigo-700 border-indigo-100",
            }
        case "LOGIN":
            return {
                label: "Inicio de sesion",
                icon: <Clock size={20} className="text-slate-600" />,
                pill: "bg-slate-100 text-slate-700 border-slate-200",
            }
        default:
            return {
                label: "Actividad",
                icon: <Clock size={20} className="text-slate-600" />,
                pill: "bg-slate-100 text-slate-700 border-slate-200",
            }
    }
}

const getActivityDetail = (item: UserActivityDto) => {
    const data = item.data ?? {}
    if (item.type === "WIN") {
        return `${data.couponTitle ?? "Premio"}${data.points ? ` - ${data.points} pts` : ""}`
    }
    if (item.type === "USE") {
        return `${data.couponTitle ?? "Cupon"}${data.verifierName ? ` - verificado por ${data.verifierName}` : ""}`
    }
    if (item.type === "SEND") {
        return `${data.couponTitle ?? "Cupon"}${data.peerName ? ` - para ${data.peerName}` : ""}`
    }
    if (item.type === "RECEIVE") {
        return `${data.couponTitle ?? "Cupon"}${data.peerName ? ` - de ${data.peerName}` : ""}`
    }
    if (item.type === "LEVEL_UP") {
        return data.levelName ? `Nivel ${data.levelName}` : "Nuevo nivel"
    }
    return "Actividad registrada"
}

const parseSaleClaim = (code?: string | null) => {
    if (!code || !code.startsWith("sale://")) return null
    const [, query = ""] = code.split("?")
    const params = new URLSearchParams(query)
    const name = params.get("name") || "Venta"
    const points = Number(params.get("points") ?? NaN)
    const price = Number(params.get("price") ?? NaN)
    const qty = Number(params.get("qty") ?? NaN)
    const discount = Number(params.get("discount") ?? NaN)
    const couponCode = params.get("coupon") || params.get("couponCode")
    const safeQty = Number.isFinite(qty) && qty > 0 ? qty : 1
    const safePrice = Number.isFinite(price) ? price : 0
    const safePoints = Number.isFinite(points) ? points : null
    const safeDiscount = Number.isFinite(discount) ? discount : null
    return {
        items: [
            {
                name,
                quantity: safeQty,
                price: safePrice,
                points: safePoints ?? undefined,
            },
        ],
        total: safePrice * safeQty,
        points: safePoints,
        discount: safeDiscount,
        couponCode: couponCode || null,
    }
}

const parseTicketIdFromClaim = (code?: string | null) => {
    if (!code) return null
    if (code.startsWith("ticket://")) return code.replace("ticket://", "")
    if (code.startsWith("ticket-")) {
        const raw = code.replace("ticket-", "")
        return raw.split("-")[0] || null
    }
    return null
}

const formatClaimLabel = (code?: string | null) => {
    if (!code) return "Compra"
    if (code.startsWith("ticket://")) {
        return formatTicketLabel(code.replace("ticket://", ""))
    }
    if (code.startsWith("ticket-")) {
        const raw = code.replace("ticket-", "")
        return formatTicketLabel(raw.split("-")[0] || raw)
    }
    if (code.startsWith("sale://")) {
        const parsed = parseSaleClaim(code)
        if (parsed?.items?.length) {
            const item = parsed.items[0]
            const qtyLabel = item.quantity > 1 ? `${item.quantity}x ` : ""
            return `Venta ${qtyLabel}${item.name}`
        }
        return "Venta registrada"
    }
    return code
}

const statusLabels: Record<string, string> = {
    available: "Disponible",
    used: "Usado",
    claimed: "Reclamado",
    confirmed: "Confirmado",
}

const formatStatusLabel = (status?: string | null) => {
    if (!status) return "Sin estado"
    return statusLabels[status] ?? status
}

export default function MetricsSection({
    levelLadder,
    dashboardStats,
    tickets,
    dailyRate,
    onLookupUser,
    onDeleteUser,
    isAdmin,
}: MetricsSectionProps) {
    const [lookupValue, setLookupValue] = useState("")
    const [lookupStatus, setLookupStatus] = useState<LookupStatus | null>(null)
    const [lookupResult, setLookupResult] = useState<LookupUserResponse | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const [detailModal, setDetailModal] = useState<DetailModalState>(null)

    // UI States
    const [couponFilter, setCouponFilter] = useState<'all' | 'available' | 'used'>('all')
    const [transactionFilter, setTransactionFilter] = useState<'all' | 'app' | 'store'>('all')

    const coupons = lookupResult?.coupons ?? []
    const activity = lookupResult?.activity ?? []
    const claims = lookupResult?.claims ?? []

    const ticketDetail = detailModal?.type === "ticket" ? detailModal.ticket : null
    const purchaseDetail = detailModal?.type === "purchase" ? detailModal.purchase : null
    const purchaseCurrency = purchaseDetail?.currency || "USD"
    const purchaseSubtotal = getItemsSubtotal(purchaseDetail?.items)
    const purchaseDiscountValue = Number(purchaseDetail?.discount ?? NaN)
    const hasPurchaseDiscount = Number.isFinite(purchaseDiscountValue) && purchaseDiscountValue > 0
    const purchaseCouponCode = purchaseDetail?.couponCode || null
    const purchaseTotalValue = Number(purchaseDetail?.total ?? NaN)
    const purchaseTotal = Number.isFinite(purchaseTotalValue) ? purchaseTotalValue : purchaseSubtotal
    const rateValue = Number(dailyRate ?? NaN)
    const hasRate = Number.isFinite(rateValue) && rateValue > 0
    const normalizedPurchaseAmount = roundUsd(purchaseTotal)
    const purchaseCurrencyUpper = (purchaseCurrency || "USD").toUpperCase()
    const purchaseTotalBsValue = purchaseDetail
        ? (purchaseCurrencyUpper === "USD"
            ? (hasRate ? convertUsdToVes(normalizedPurchaseAmount, rateValue) : null)
            : normalizedPurchaseAmount)
        : null
    const purchaseTotalBsLabel = purchaseDetail
        ? purchaseTotalBsValue !== null
            ? `Bs ${formatMoney(purchaseTotalBsValue)}`
            : "Bs --"
        : null
    const purchasePointsRaw = Number(purchaseDetail?.points ?? NaN)
    const purchasePointsTotal = Number.isFinite(purchasePointsRaw) ? Math.max(0, purchasePointsRaw) : 0
    const hasPurchaseCoverage = hasCouponCoverage(purchaseDetail?.items)
    const showPurchaseCouponNote = !hasPurchaseDiscount && !purchaseCouponCode && hasPurchaseCoverage



    const couponCounts = useMemo(() => {
        return coupons.reduce(
            (acc, coupon) => {
                acc.total += 1
                if (coupon.status === "available") acc.available += 1
                if (coupon.status === "used") acc.used += 1
                if (coupon.status === "expired") acc.expired += 1
                return acc
            },
            { total: 0, available: 0, used: 0, expired: 0 },
        )
    }, [coupons])

    const ticketsForUser = useMemo(() => {
        if (!lookupResult) return []
        const targetEmail = normalizeEmail(lookupResult.user?.email ?? null)
        const targetCedula = normalizeCedula(lookupResult.user?.cedula ?? null)
        return tickets
            .filter((ticket) => {
                const ticketEmail = normalizeEmail(ticket.customerEmail ?? null)
                const ticketCedula = normalizeCedula(ticket.documentNumber ?? null)
                return (targetEmail && ticketEmail === targetEmail) || (targetCedula && ticketCedula === targetCedula)
            })
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }, [lookupResult, tickets])

    const purchaseGroups = useMemo(() => {
        if (!claims.length) return []
        const groups = new Map<string, PurchaseGroup>()
        const findTicketById = (ticketId: string) => {
            const idNumber = Number.parseInt(ticketId, 10)
            return tickets.find((ticket) => {
                const rawId = String(ticket.id)
                if (rawId === ticketId) return true
                if (Number.isFinite(idNumber)) return Number(ticket.id) === idNumber
                return false
            })
        }

        claims.forEach((claim) => {
            const code = claim.code || ""
            const claimedAt = claim.claimedAt
            const ticketId = parseTicketIdFromClaim(code)
            if (ticketId) {
                const groupId = `ticket:${ticketId}`
                if (!groups.has(groupId)) {
                    const ticket = findTicketById(ticketId)
                    groups.set(groupId, {
                        id: groupId,
                        claimedAt,
                        label: formatTicketLabel(ticketId),
                        status: claim.status,
                        items: ticket?.items ?? [],
                        points: ticket?.points ?? claim.points ?? 0,
                        total: ticket?.amount ?? null,
                        currency: ticket?.currency ?? "USD",
                        discount: ticket?.discount ?? null,
                        couponCode: ticket?.couponCode ?? null,
                        ticket: ticket ?? null,
                    })
                }
                return
            }

            if (code.startsWith("sale://")) {
                const saleKey = `sale:${claimedAt}`
                const parsed = parseSaleClaim(code)
                const existing = groups.get(saleKey)
                if (!existing) {
                    groups.set(saleKey, {
                        id: saleKey,
                        claimedAt,
                        label: "Venta registrada",
                        status: claim.status,
                        items: parsed?.items ? [...parsed.items] : [],
                        points: claim.points ?? 0,
                        total: parsed?.total ?? 0,
                        currency: "USD",
                        discount: parsed?.discount ?? null,
                        couponCode: parsed?.couponCode ?? null,
                    })
                } else {
                    if (parsed?.items?.length) {
                        existing.items.push(...parsed.items)
                        existing.total = (existing.total ?? 0) + (parsed.total ?? 0)
                    }
                    existing.points += claim.points ?? 0
                    if (!existing.discount && parsed?.discount) existing.discount = parsed.discount
                    if (!existing.couponCode && parsed?.couponCode) existing.couponCode = parsed.couponCode
                }
                return
            }

            const fallbackKey = `claim:${claim.id}`
            const parsed = parseSaleClaim(code)
            groups.set(fallbackKey, {
                id: fallbackKey,
                claimedAt,
                label: formatClaimLabel(code),
                status: claim.status,
                items: parsed?.items ?? [],
                points: claim.points ?? parsed?.points ?? 0,
                total: parsed?.total ?? null,
                currency: "USD",
                discount: parsed?.discount ?? null,
                couponCode: parsed?.couponCode ?? null,
            })
        })

        groups.forEach((group) => {
            if (!group.id.startsWith("sale:")) return
            if (group.items.length === 1) {
                const item = group.items[0]
                const qtyLabel = item.quantity > 1 ? `${item.quantity}x ` : ""
                group.label = `Venta ${qtyLabel}${item.name}`
            } else if (group.items.length > 1) {
                group.label = `Venta ${group.items.length} productos`
            }
        })

        return Array.from(groups.values()).sort(
            (a, b) => new Date(b.claimedAt).getTime() - new Date(a.claimedAt).getTime(),
        )
    }, [claims, tickets])

    const combinedEntries = useMemo(() => {
        if (!ticketsForUser.length && !purchaseGroups.length) return []
        const ticketIds = new Set(
            ticketsForUser
                .map((ticket) => normalizeTicketId(ticket.id))
                .filter((value): value is string => Boolean(value)),
        )
        const purchaseEntries: PurchaseEntry[] = purchaseGroups
            .filter((group) => {
                if (!group.id.startsWith("ticket:")) return true
                const ticketId = normalizeTicketId(group.id.replace("ticket:", ""))
                if (!ticketId) return true
                return !ticketIds.has(ticketId)
            })
            .map((group) => ({
                kind: "purchase",
                id: group.id,
                date: group.claimedAt,
                label: group.label,
                status: group.status,
                itemsCount: group.items.length,
                total: group.total,
                currency: group.currency,
                purchase: group,
            }))
        const ticketEntries: PurchaseEntry[] = ticketsForUser.map((ticket) => ({
            kind: "ticket",
            id: `ticket:${ticket.id}`,
            date: ticket.createdAt,
            label: formatTicketLabel(String(ticket.id)),
            status: ticket.status,
            itemsCount: ticket.items?.length ?? 0,
            total: ticket.amount ?? null,
            currency: ticket.currency ?? "USD",
            ticket,
        }))
        return [...ticketEntries, ...purchaseEntries].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        )
    }, [purchaseGroups, ticketsForUser])








    const handleLookup = async () => {
        const trimmed = lookupValue.trim()
        if (!trimmed) {
            setLookupStatus({ tone: "error", message: "Ingresa un correo o cedula" })
            setLookupResult(null)
            return
        }
        const isEmail = trimmed.includes("@")
        const normalizedCedula = normalizeCedula(trimmed)
        const payload = isEmail ? { email: trimmed } : { cedula: normalizedCedula ?? undefined }
        if (!payload.email && !payload.cedula) {
            setLookupStatus({ tone: "error", message: "Ingresa un correo valido o una cedula" })
            setLookupResult(null)
            return
        }
        setLookupStatus({ tone: "loading", message: "Buscando usuario..." })
        try {
            const result = await onLookupUser(payload)
            setLookupResult(result)
            setLookupStatus({ tone: "success", message: "Usuario encontrado" })
        } catch (err: any) {
            setLookupResult(null)
            setLookupStatus({ tone: "error", message: err?.message || "No se pudo buscar el usuario" })
        }
    }

    const handleClear = () => {
        setLookupValue("")
        setLookupResult(null)
        setLookupStatus(null)
    }

    const handleDelete = async () => {
        if (!lookupResult?.user?.id) return
        const label = lookupResult.user.email || lookupResult.user.cedula || lookupResult.user.id
        const confirmed = window.confirm(`Vas a borrar el usuario ${label}. Esta accion elimina su informacion y movimientos.`)
        if (!confirmed) return
        setIsDeleting(true)
        try {
            await onDeleteUser(lookupResult.user.id)
            setLookupResult(null)
            setLookupValue("")
            setLookupStatus({ tone: "success", message: "Usuario eliminado" })
        } catch (err: any) {
            setLookupStatus({ tone: "error", message: err?.message || "No se pudo borrar el usuario" })
        } finally {
            setIsDeleting(false)
        }
    }





    const filteredCoupons = useMemo(() => {
        let list = [...coupons]
        if (couponFilter === 'available') {
            list = list.filter(c => c.status === 'available')
        } else if (couponFilter === 'used') {
            list = list.filter(c => c.status === 'used')
        }

        // Sort: Available first, then by date
        return list.sort((a, b) => {
            if (a.status === 'available' && b.status !== 'available') return -1
            if (a.status !== 'available' && b.status === 'available') return 1
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        })
    }, [coupons, couponFilter])

    const pendingTickets = ticketsForUser.filter((ticket) => ticket.status === "pending")
    const confirmedTickets = ticketsForUser.filter((ticket) => ticket.status === "confirmed")

    const summaryCards = lookupResult
        ? [
            {
                label: "Nivel actual",
                value: lookupResult.levelState?.currentLevel?.name ?? "Sin nivel",
                helper: lookupResult.levelState?.nextLevel?.name
                    ? `Siguiente: ${lookupResult.levelState.nextLevel.name}`
                    : "Sin siguiente nivel",
                icon: <BadgeCheck size={16} className="text-indigo-600" />,
                tone: "indigo",
            },
            {
                label: "Puntos",
                value: `${lookupResult.totalPoints ?? 0}`,
                helper: lookupResult.levelState?.pointsToNext !== null && lookupResult.levelState?.pointsToNext !== undefined
                    ? `${lookupResult.levelState.pointsToNext} para subir`
                    : "Sin meta activa",
                icon: <Sparkles size={16} className="text-amber-500" />,
                tone: "amber",
            },
            {
                label: "Cupones activos",
                value: `${couponCounts.available}`,
                helper: `${couponCounts.used} usados - ${couponCounts.expired} expirados`,
                icon: <Gift size={16} className="text-emerald-600" />,
                tone: "emerald",
            },
            {
                label: "Pedidos",
                value: `${ticketsForUser.length}`,
                helper: `Pendientes: ${pendingTickets.length} - Confirmados: ${confirmedTickets.length}`,
                icon: <ShoppingBag size={16} className="text-sky-600" />,
                tone: "sky",
            },
        ]
        : []



    const summaryToneStyles: Record<string, { card: string; icon: string }> = {
        indigo: { card: "bg-indigo-50/60 border-indigo-100", icon: "bg-white text-indigo-600" },
        amber: { card: "bg-amber-50/60 border-amber-100", icon: "bg-white text-amber-600" },
        emerald: { card: "bg-emerald-50/60 border-emerald-100", icon: "bg-white text-emerald-600" },
        sky: { card: "bg-sky-50/60 border-sky-100", icon: "bg-white text-sky-600" },
    }

    const couponStatusStyles: Record<string, string> = {
        available: "border-emerald-100 bg-emerald-50 text-emerald-700",
        used: "border-slate-200 bg-slate-100 text-slate-600",
        expired: "border-rose-100 bg-rose-50 text-rose-600",
    }



    return (
        <Tooltip.Provider>
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-8">

                {/* Modern Minimalist Search Bar */}
                <div className="max-w-4xl mx-auto">
                    <div className={`
                        relative z-20 transition-all duration-300
                        bg-white rounded-full p-2
                        shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100
                        flex items-center gap-2
                        ${lookupStatus?.tone === 'loading' ? 'ring-2 ring-indigo-100' : 'hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]'}
                    `}>
                        <div className="h-10 w-10 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center shrink-0">
                            {lookupStatus?.tone === 'loading' ? (
                                <Loader2 size={18} className="animate-spin text-indigo-500" />
                            ) : (
                                <Search size={18} />
                            )}
                        </div>

                        <input
                            value={lookupValue}
                            onChange={(e) => setLookupValue(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                            placeholder="Buscar usuario por correo o cédula..."
                            className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-slate-700 placeholder:text-slate-400 h-10 px-2"
                        />

                        {lookupValue && (
                            <button
                                onClick={handleClear}
                                className="h-8 w-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors"
                            >
                                <X size={14} />
                            </button>
                        )}

                        <button
                            onClick={handleLookup}
                            disabled={!lookupValue.trim() || lookupStatus?.tone === 'loading'}
                            className="h-10 px-6 rounded-full bg-slate-900 text-white text-xs font-bold uppercase tracking-wider hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            Buscar
                        </button>
                    </div>

                    {/* Status Feedback */}
                    <div className="flex justify-center mt-3 min-h-[20px]">
                        {lookupStatus?.message && (
                            <div className={`
                                inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider animate-in fade-in slide-in-from-top-2
                                ${lookupStatus.tone === 'error' ? 'bg-rose-50 text-rose-600' :
                                    lookupStatus.tone === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-500'}
                            `}>
                                {lookupStatus.tone === 'error' && <AlertTriangle size={12} />}
                                {lookupStatus.tone === 'success' && <BadgeCheck size={12} />}
                                {lookupStatus.message}
                            </div>
                        )}
                    </div>
                </div>

                {lookupResult ? (
                    <div className="animate-in fade-in zoom-in-95 duration-500 space-y-6">

                        {/* Header Profile Card */}
                        <div className="relative overflow-hidden rounded-[2rem] bg-white border border-slate-100 shadow-sm">
                            <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 opacity-50" />
                            <div className="relative px-8 pt-12 pb-8">
                                <div className="flex flex-col md:flex-row items-center md:items-end justify-between gap-6">
                                    <div className="flex items-center gap-6">
                                        <div className="h-24 w-24 rounded-3xl bg-white p-1.5 shadow-xl shadow-indigo-100/50 rotate-3">
                                            <div className="h-full w-full rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center text-white">
                                                <User size={32} strokeWidth={1.5} />
                                            </div>
                                        </div>
                                        <div className="text-center md:text-left space-y-1">
                                            <div className="flex items-center gap-2 justify-center md:justify-start">
                                                <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                                                    {lookupResult.user?.name || "Usuario sin nombre"}
                                                </h2>
                                                {lookupResult.user?.isProvisional && (
                                                    <span className="px-2 py-0.5 rounded-md bg-amber-100/50 text-amber-700 text-[10px] font-bold uppercase tracking-wider border border-amber-100">
                                                        Provisional
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-slate-500 font-medium">
                                                {lookupResult.user?.email || lookupResult.user?.cedula}
                                            </p>
                                            <div className="flex items-center gap-3 pt-2 justify-center md:justify-start">
                                                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-100 text-xs font-semibold text-slate-600">
                                                    <Hash size={12} />
                                                    {lookupResult.user?.cedula || "N/A"}
                                                </div>
                                                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-100 text-xs font-semibold text-slate-600">
                                                    <Phone size={12} />
                                                    {lookupResult.user?.phoneNumber || "N/A"}
                                                </div>
                                                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-100 text-xs font-semibold text-slate-600">
                                                    <Calendar size={12} />
                                                    {lookupResult.user?.createdAt ? new Date(lookupResult.user.createdAt).toLocaleDateString() : "N/A"}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Stats Grid in Header */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full md:w-auto">
                                        {summaryCards.map((card) => {
                                            const tone = summaryToneStyles[card.tone] ?? summaryToneStyles.indigo
                                            return (
                                                <div key={card.label} className={`p-4 rounded-2xl border bg-white/50 backdrop-blur-sm ${tone.card} transition-transform hover:-translate-y-1`}>
                                                    <div className="flex flex-col items-center text-center gap-2">
                                                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${tone.icon} shadow-sm`}>
                                                            {card.icon}
                                                        </div>
                                                        <div>
                                                            <p className="text-lg font-black text-slate-800">{card.value}</p>
                                                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{card.label}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Danger Zone */}
                            {isAdmin && (
                                <div className="absolute top-4 right-4">
                                    <button
                                        onClick={handleDelete}
                                        disabled={isDeleting}
                                        className="group h-9 px-4 rounded-full bg-rose-50 hover:bg-rose-100 border border-rose-100 hover:border-rose-200 flex items-center gap-2 text-rose-600 hover:text-rose-700 transition-all text-xs font-bold shadow-sm"
                                    >
                                        {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={16} />}
                                        <span>Eliminar usuario</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Content Grid */}
                        <div className="grid lg:grid-cols-5 gap-6">

                            {/* Left Column: Coupons & Activity */}
                            <div className="lg:col-span-2 space-y-6">
                                {/* Coupons Section */}
                                <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex flex-col h-[500px]">
                                    <div className="flex flex-col gap-4 mb-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                                    <Ticket size={20} />
                                                </div>
                                                <div>
                                                    <h3 className="text-base font-bold text-slate-800">Cupones</h3>
                                                </div>
                                            </div>
                                            <div className="flex gap-1 bg-slate-50 p-1 rounded-lg">
                                                <button
                                                    onClick={() => setCouponFilter('all')}
                                                    className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${couponFilter === 'all' ? 'bg-white shadow-sm text-slate-700' : 'text-slate-400 hover:text-slate-600'}`}
                                                >
                                                    Todos
                                                </button>
                                                <button
                                                    onClick={() => setCouponFilter('available')}
                                                    className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${couponFilter === 'available' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400 hover:text-emerald-600'}`}
                                                >
                                                    Disp.
                                                </button>
                                                <button
                                                    onClick={() => setCouponFilter('used')}
                                                    className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${couponFilter === 'used' ? 'bg-white shadow-sm text-slate-700' : 'text-slate-400 hover:text-slate-600'}`}
                                                >
                                                    Usados
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                                        {filteredCoupons.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center text-center p-4">
                                                <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 mb-2">
                                                    <Ticket size={24} />
                                                </div>
                                                <p className="text-xs font-semibold text-slate-400">No hay cupones</p>
                                            </div>
                                        ) : (
                                            filteredCoupons.map((coupon) => (
                                                <div key={coupon.id} className="group relative overflow-hidden rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-md hover:border-emerald-100 transition-all p-4">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <h4 className="text-sm font-bold text-slate-800 truncate">{coupon.title}</h4>
                                                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border shrink-0 ${couponStatusStyles[coupon.status]}`}>
                                                                {formatStatusLabel(coupon.status)}
                                                            </span>
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                                            <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
                                                                <Calendar size={10} className="text-slate-300" />
                                                                <span className="font-medium text-slate-500">Obtenido:</span> {formatDateTime(coupon.createdAt).split(',')[0]}
                                                            </p>
                                                            {coupon.expiresAt && (
                                                                <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
                                                                    <AlertTriangle size={10} className="text-amber-400" />
                                                                    <span className="font-medium text-slate-500">Expira:</span> {formatDateTime(coupon.expiresAt).split(',')[0]}
                                                                </p>
                                                            )}
                                                            {coupon.usedAt && (
                                                                <p className="text-[10px] text-slate-400 flex items-center gap-1.5 col-span-2">
                                                                    <BadgeCheck size={10} className="text-emerald-500" />
                                                                    <span className="font-medium text-slate-500">Usado el:</span> {formatDateTime(coupon.usedAt)}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Activity Feed (Merged with Purchases) */}
                                <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex flex-col h-[600px]">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="h-10 w-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                            <Zap size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-bold text-slate-800">Actividad</h3>
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                                        {(() => {
                                            // Merge Activity and Purchases for the Feed
                                            const mixedFeed = [
                                                ...activity.map(a => ({ ...a, _kind: 'activity' })),
                                                ...combinedEntries.map(e => ({
                                                    id: e.id,
                                                    type: e.kind === 'ticket' ? 'ORDER' : 'PURCHASE',
                                                    createdAt: e.date,
                                                    data: { label: e.label, total: e.total, currency: e.currency },
                                                    _kind: 'transaction'
                                                }))
                                            ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

                                            if (mixedFeed.length === 0) {
                                                return (
                                                    <div className="text-center p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                                        <p className="text-xs text-slate-500 font-medium">Sin registros recientes</p>
                                                    </div>
                                                )
                                            }

                                            return (
                                                <div className="relative border-l-2 border-slate-100 ml-5 space-y-8 py-2">
                                                    {mixedFeed.map((item: any) => {
                                                        const isTransaction = item._kind === 'transaction';
                                                        let meta: any = {};

                                                        // Calculate amounts for transactions
                                                        let bsAmount = null;
                                                        let usdAmount = null;

                                                        if (isTransaction) {
                                                            const isOrder = item.type === 'ORDER'
                                                            meta = {
                                                                // Label for the Tag
                                                                tag: isOrder ? "Pedido App" : "Tienda",
                                                                // Main Title
                                                                title: item.data.label,
                                                                icon: isOrder ? <ShoppingBag size={22} className="text-sky-600" /> : <Ticket size={22} className="text-purple-600" />,
                                                                pill: isOrder ? "bg-sky-50 border-sky-200" : "bg-purple-50 border-purple-200",
                                                                tagStyle: isOrder ? "bg-sky-50 text-sky-700 border-sky-100" : "bg-purple-50 text-purple-700 border-purple-100"
                                                            }

                                                            // Currency Logic
                                                            const val = Number(item.data.total ?? 0)
                                                            const isUsd = (item.data.currency || "USD").toUpperCase() === "USD"
                                                            const normalizedValue = roundUsd(val)
                                                            bsAmount = isUsd ? (hasRate ? convertUsdToVes(normalizedValue, rateValue) : null) : normalizedValue
                                                            usdAmount = isUsd ? normalizedValue : (hasRate ? convertVesToUsd(normalizedValue, rateValue) : null)
                                                        } else {
                                                            meta = getActivityMeta(item.type)
                                                        }

                                                        const Wrapper = isTransaction ? 'button' : 'div';
                                                        const wrapperProps = isTransaction ? {
                                                            onClick: () => {
                                                                const original = combinedEntries.find(e => e.id === item.id)
                                                                if (original?.kind === 'ticket' && original.ticket) {
                                                                    setDetailModal({ type: 'ticket', ticket: original.ticket })
                                                                } else if (original?.kind === 'purchase' && original.purchase) {
                                                                    setDetailModal({ type: 'purchase', purchase: original.purchase })
                                                                }
                                                            },
                                                            className: "relative pl-10 w-full text-left group/item cursor-pointer"
                                                        } : {
                                                            className: "relative pl-10"
                                                        }

                                                        return (
                                                            <Wrapper key={item.id} {...wrapperProps}>
                                                                <div className={`absolute left-0 top-0 h-8 w-8 rounded-xl border border-slate-100 flex items-center justify-center ${meta.pill} shadow-sm z-10 bg-white`}>
                                                                    {meta.icon}
                                                                </div>

                                                                {isTransaction ? (
                                                                    // Redesigned Transaction Item
                                                                    <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm hover:border-indigo-100 hover:shadow-indigo-50 transition-all">
                                                                        <div className="flex justify-between items-start gap-4">
                                                                            <div className="min-w-0">
                                                                                <div className="flex items-center gap-2 mb-1">
                                                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border whitespace-nowrap ${meta.tagStyle}`}>
                                                                                        {meta.tag}
                                                                                    </span>
                                                                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100 whitespace-nowrap">
                                                                                        {formatDateTime(item.createdAt).split(',')[0]}
                                                                                    </span>
                                                                                </div>
                                                                                <p className="text-sm font-bold text-slate-800 truncate group-hover/item:text-indigo-600 transition-colors">
                                                                                    {meta.title}
                                                                                </p>
                                                                            </div>
                                                                            <div className="text-right shrink-0">
                                                                                {bsAmount !== null && (
                                                                                    <p className="text-sm font-black text-slate-900">
                                                                                        Bs {formatMoney(bsAmount)}
                                                                                    </p>
                                                                                )}
                                                                                {usdAmount !== null && (
                                                                                    <p className="text-[10px] font-medium text-slate-400">
                                                                                        (USD {formatMoney(usdAmount)})
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    // Standard Activity Item
                                                                    <div>
                                                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-1">
                                                                            <p className="text-sm font-bold text-slate-700">{meta.label}</p>
                                                                            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100 w-fit">
                                                                                {formatDateTime(item.createdAt)}
                                                                            </span>
                                                                        </div>
                                                                        <div className="text-xs text-slate-600 leading-relaxed bg-white rounded-xl p-3 border border-slate-100 shadow-sm relative group hover:border-indigo-100 transition-colors">
                                                                            {getActivityDetail(item)}
                                                                            <div className="absolute left-[-6px] top-4 w-1.5 h-1.5 bg-white border-l border-t border-slate-100 rotate-45 transform group-hover:border-indigo-100 transition-colors"></div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </Wrapper>
                                                        )
                                                    })}
                                                </div>
                                            )
                                        })()}
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Transactions & Historial */}
                            <div className="lg:col-span-3 space-y-6">
                                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm flex flex-col h-[1125px]">
                                    <div className="p-6 border-b border-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center">
                                                <ShoppingBag size={20} />
                                            </div>
                                            <div>
                                                <h3 className="text-base font-bold text-slate-800">Transacciones</h3>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl">
                                            <button
                                                onClick={() => setTransactionFilter('all')}
                                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${transactionFilter === 'all' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                                            >
                                                Todo
                                            </button>
                                            <button
                                                onClick={() => setTransactionFilter('app')}
                                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${transactionFilter === 'app' ? 'bg-white shadow-sm text-sky-600' : 'text-slate-400 hover:text-sky-600'}`}
                                            >
                                                App
                                            </button>
                                            <button
                                                onClick={() => setTransactionFilter('store')}
                                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${transactionFilter === 'store' ? 'bg-white shadow-sm text-purple-600' : 'text-slate-400 hover:text-purple-600'}`}
                                            >
                                                Tienda
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                                        {(() => {
                                            const filteredTransactions = combinedEntries.filter(entry => {
                                                if (transactionFilter === 'app') return entry.kind === 'ticket'
                                                if (transactionFilter === 'store') return entry.kind === 'purchase'
                                                return true
                                            })

                                            if (filteredTransactions.length === 0) {
                                                return (
                                                    <div className="h-full flex flex-col items-center justify-center">
                                                        <div className="w-16 h-16 rounded-3xl bg-slate-50 text-slate-300 flex items-center justify-center mb-4">
                                                            <ShoppingBag size={32} />
                                                        </div>
                                                        <p className="text-sm font-semibold text-slate-500">No hay movimientos</p>
                                                        <p className="text-xs text-slate-400 mt-1 max-w-[200px] text-center">No se encontraron transacciones con el filtro actual.</p>
                                                    </div>
                                                )
                                            }

                                            return (
                                                <div className="grid grid-cols-1 gap-3">
                                                    {filteredTransactions.map((entry) => {
                                                        const isUsd = (entry.currency || "USD").toUpperCase() === "USD"
                                                        const amount = entry.total ?? 0
                                                        const normalizedAmount = roundUsd(amount)
                                                        const bsValue = isUsd ? (hasRate ? convertUsdToVes(normalizedAmount, rateValue) : null) : normalizedAmount
                                                        const usdValue = isUsd ? normalizedAmount : (hasRate ? convertVesToUsd(normalizedAmount, rateValue) : null)

                                                        return (
                                                            <button
                                                                key={entry.id}
                                                                onClick={() => (
                                                                    entry.kind === "ticket" && entry.ticket
                                                                        ? setDetailModal({ type: "ticket", ticket: entry.ticket })
                                                                        : entry.purchase
                                                                            ? setDetailModal({ type: "purchase", purchase: entry.purchase })
                                                                            : null
                                                                )}
                                                                className="group flex items-center justify-between gap-4 p-4 rounded-2xl border border-slate-100 bg-white hover:border-sky-200 hover:shadow-md hover:shadow-sky-50 transition-all duration-300 text-left"
                                                            >
                                                                <div className="flex items-center gap-4 min-w-0">
                                                                    <div className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-colors shadow-sm ${entry.kind === 'ticket' ? 'bg-sky-50 text-sky-600 group-hover:bg-sky-100' : 'bg-purple-50 text-purple-600 group-hover:bg-purple-100'}`}>
                                                                        {entry.kind === 'ticket' ? <ShoppingBag size={22} /> : <Ticket size={22} />}
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <div className="flex items-center gap-2 mb-0.5">
                                                                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${entry.kind === 'ticket' ? 'bg-sky-50 text-sky-700 border-sky-100' : 'bg-purple-50 text-purple-700 border-purple-100'
                                                                                }`}>
                                                                                {entry.kind === 'ticket' ? 'App' : 'Tienda'}
                                                                            </span>
                                                                            <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">{formatDateTime(entry.date).split(',')[0]}</span>
                                                                        </div>
                                                                        <p className="text-sm font-bold text-slate-800 truncate">{entry.label}</p>
                                                                    </div>
                                                                </div>

                                                                <div className="text-right shrink-0">
                                                                    {bsValue !== null ? (
                                                                        <div className="text-base font-black text-slate-800">
                                                                            Bs {formatMoney(bsValue)}
                                                                        </div>
                                                                    ) : <div className="text-base font-black text-slate-800">-</div>}

                                                                    {usdValue !== null && (
                                                                        <div className="text-xs font-bold text-slate-400 mt-0.5">
                                                                            USD {formatMoney(usdValue)}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            )
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}

                {/* Charts Grid */}
                {/* User Growth */}
                <div className="bg-white rounded-[1.75rem] p-6 border border-slate-100 shadow-sm">
                    <SmartChartSection
                        title="Nuevos Usuarios"
                        subtitle="Crecimiento"
                        data={dashboardStats?.userGrowth?.daily || []}
                        color="#606af3"
                        tooltipLabel="Usuarios"
                    />
                </div>

                <div className="grid lg:grid-cols-2 gap-6">

                    {/* Activity */}
                    <div className="bg-white rounded-[1.75rem] p-6 border border-slate-100 shadow-sm">
                        <SmartChartSection
                            title="Uso de la plataforma"
                            subtitle="Actividad"
                            data={useMemo(() => {
                                const activity = dashboardStats?.activityHistory || []
                                const growth = dashboardStats?.userGrowth?.daily || []
                                const combined = new Map<string, number>()

                                activity.forEach(a => combined.set(a.date, (combined.get(a.date) || 0) + a.count))
                                growth.forEach(g => combined.set(g.date, (combined.get(g.date) || 0) + g.count))

                                return Array.from(combined.entries())
                                    .map(([date, count]) => ({ date, count }))
                                    .sort((a, b) => a.date.localeCompare(b.date))
                            }, [dashboardStats])}
                            color="#0ea5e9"
                            infoTooltip="Interacciones incluye: Logins, Scaneos de QR y Canjes de cupones."
                            tooltipLabel="Interacciones"
                        />
                    </div>

                    {/* Coupons */}
                    <div className="bg-white rounded-[1.75rem] p-6 border border-slate-100 shadow-sm">
                        <SmartCouponSection
                            data={dashboardStats?.couponHistory || []}
                        />
                    </div>
                </div>

                {/* Vertical Level Distribution */}
                <div className="bg-white rounded-[1.75rem] p-6 border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.18em]">Distribucion por nivel</p>
                            <h3 className="text-lg font-bold text-slate-900">Clientes vistos por nivel</h3>
                        </div>
                    </div>
                    <VerticalLevelChart levelLadder={levelLadder} dashboardStats={dashboardStats} />
                </div>

                {ticketDetail && (
                    <TicketModal
                        ticket={ticketDetail}
                        onClose={() => setDetailModal(null)}
                        formatMoney={(value) => formatMoney(Number(value ?? 0))}
                        exchangeRate={dailyRate}
                    />
                )}

                {purchaseDetail && !ticketDetail && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-[2px] px-4 py-8">
                        <div
                            className="absolute inset-0"
                            onClick={() => setDetailModal(null)}
                        />
                        <div className="relative w-full max-w-md rounded-[24px] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.08)] border border-slate-100 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200"
                            role="dialog"
                            aria-modal="true"
                        >
                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50 shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-purple-50 text-purple-600">
                                        <Ticket size={18} />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-black text-slate-900 leading-tight">
                                            {purchaseDetail.label || "Compra"}
                                        </h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                            {purchaseDetail.claimedAt
                                                ? new Date(purchaseDetail.claimedAt).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                                                : '-'}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setDetailModal(null)} className="p-1.5 text-slate-400 hover:text-slate-900 transition-colors">
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="px-6 py-4 overflow-y-auto custom-scrollbar flex flex-col gap-5">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Compra</span>
                                        <span className="text-[10px] font-bold text-slate-400">{purchaseDetail.items.length} items</span>
                                    </div>
                                    <div className="divide-y divide-slate-50">
                                        {purchaseDetail.items.map((item, idx) => {
                                            const coverageLabel = getCoverageLabel(item)
                                            const itemPoints = getItemPointsTotal(item)
                                            const itemPointsLabel = itemPoints > 0 ? formatPoints(itemPoints) : null
                                            return (
                                                <div key={idx} className="py-2.5 flex justify-between items-start gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-slate-800 truncate leading-tight">
                                                            {Number(item.quantity) > 1 && <span className="text-purple-600 mr-1.5">{item.quantity}x</span>}
                                                            {item.name}
                                                        </p>
                                                        <div className="flex flex-wrap gap-2 mt-0.5">
                                                            {coverageLabel && (
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-[10px] font-bold text-purple-600">{coverageLabel}</span>
                                                                    <span className="text-[9px] font-black text-white bg-purple-500 px-1.5 py-0.5 rounded-[4px] uppercase tracking-wider">Cupon</span>
                                                                </div>
                                                            )}
                                                            {itemPointsLabel ? (
                                                                <p className="text-[10px] font-bold text-emerald-600">+{itemPointsLabel} pts</p>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className="text-sm font-black text-slate-900">
                                                            {formatDualMoney(Number(item.price) * Number(item.quantity), purchaseCurrency, dailyRate)}
                                                        </p>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                <div className="mt-1 pt-4 border-t-2 border-slate-50 flex flex-col items-end gap-1.5">
                                    <div className="w-full flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        <span>Subtotal</span>
                                        <span>{formatDualMoney(purchaseSubtotal, purchaseCurrency, dailyRate)}</span>
                                    </div>
                                    {hasPurchaseDiscount && (
                                        <div className="flex flex-col items-end -mt-1 mb-1">
                                            <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-md">
                                                Descuento: -{formatDualMoney(purchaseDiscountValue, purchaseCurrency, dailyRate)}{purchaseCouponCode ? ` (${purchaseCouponCode})` : ""}
                                            </span>
                                        </div>
                                    )}
                                    {!hasPurchaseDiscount && purchaseCouponCode && (
                                        <div className="flex flex-col items-end -mt-1 mb-1">
                                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                                                Cupon aplicado: {purchaseCouponCode}
                                            </span>
                                        </div>
                                    )}
                                    {showPurchaseCouponNote && (
                                        <div className="flex flex-col items-end -mt-1 mb-1">
                                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                                                Cupon aplicado (sin codigo)
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-xs font-bold text-slate-400 uppercase">Total:</span>
                                        <span className="text-2xl font-black text-slate-900 tracking-tight italic">
                                            {purchaseTotalBsLabel ?? "Bs --"}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-slate-500">
                                            {formatMoney(purchaseTotal)} {purchaseCurrency}
                                        </p>
                                        <div className="mt-1 flex items-center justify-end gap-1.5 text-emerald-600">
                                            <Ticket size={12} />
                                            <span className="text-[11px] font-black">Total puntos: {purchasePointsTotal > 0 ? `+${formatPoints(purchasePointsTotal)}` : "0"}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Tooltip.Provider >
    )
}

// --- Component Definitions ---

// --- HOOK: useChartDateFilter ---
const useChartDateFilter = () => {
    const [timeRange, setTimeRange] = useState<TimeRange>('week')
    const [currentDate, setCurrentDate] = useState(new Date())

    const handlePrev = () => {
        const newDate = new Date(currentDate)
        if (timeRange === 'today') newDate.setDate(newDate.getDate() - 1)
        if (timeRange === 'week') newDate.setDate(newDate.getDate() - 7)
        if (timeRange === 'month') newDate.setMonth(newDate.getMonth() - 1)
        if (timeRange === 'year') newDate.setFullYear(newDate.getFullYear() - 1)
        setCurrentDate(newDate)
    }

    const handleNext = () => {
        const newDate = new Date(currentDate)
        if (timeRange === 'today') newDate.setDate(newDate.getDate() + 1)
        if (timeRange === 'week') newDate.setDate(newDate.getDate() + 7)
        if (timeRange === 'month') newDate.setMonth(newDate.getMonth() + 1)
        if (timeRange === 'year') newDate.setFullYear(newDate.getFullYear() + 1)
        setCurrentDate(newDate)
    }

    const getDateRangeLabel = (): string => {
        if (timeRange === 'today') return currentDate.toLocaleDateString("es-ES", { weekday: 'long', day: 'numeric', month: 'long' })
        if (timeRange === 'week') {
            const start = getStartOfWeek(currentDate)
            const end = getEndOfWeek(currentDate)
            return `${start.getDate()} ${start.toLocaleDateString("es-ES", { month: 'short' })} - ${end.getDate()} ${end.toLocaleDateString("es-ES", { month: 'short' })}`
        }
        if (timeRange === 'month') return currentDate.toLocaleDateString("es-ES", { month: 'long', year: 'numeric' })
        if (timeRange === 'year') return currentDate.getFullYear().toString()
        return ""
    }

    return { timeRange, setTimeRange, currentDate, handlePrev, handleNext, getDateRangeLabel }
}

const ChartControls = ({
    label,
    handlePrev,
    handleNext,
    timeRange,
    setTimeRange
}: {
    label: string,
    handlePrev: () => void,
    handleNext: () => void,
    timeRange: TimeRange,
    setTimeRange: (r: TimeRange) => void
}) => {
    return (
        <div className="flex flex-col gap-2 items-end">
            <div className="flex bg-slate-100 p-0.5 rounded-lg">
                {(['today', 'week', 'month', 'year'] as TimeRange[]).map((r) => (
                    <button
                        key={r}
                        onClick={() => setTimeRange(r)}
                        className={`px-2 py-0.5 text-[10px] font-semibold rounded-md transition-all capitalize ${timeRange === r
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                            }`}
                    >
                        {r === 'today' ? 'Hoy' : r === 'week' ? 'Sem' : r === 'month' ? 'Mes' : 'Año'}
                    </button>
                ))}
            </div>
            <div className="flex items-center gap-1 bg-white rounded-lg p-0.5 border border-slate-100 shadow-sm">
                <button onClick={handlePrev} className="p-0.5 hover:bg-slate-50 rounded-md text-slate-500 hover:text-slate-800 transition-colors">
                    <ChevronLeft size={14} />
                </button>
                <span className="text-[10px] font-semibold text-slate-700 min-w-[80px] text-center capitalize">
                    {label}
                </span>
                <button onClick={handleNext} className="p-0.5 hover:bg-slate-50 rounded-md text-slate-500 hover:text-slate-800 transition-colors">
                    <ChevronRight size={14} />
                </button>
            </div>
        </div>
    )
}

// --- Smart Components ---

const SmartChartSection = ({
    title,
    subtitle,
    data,
    color,
    infoTooltip,
    tooltipLabel
}: {
    title: string,
    subtitle: string,
    data: { date: string, count: number }[],
    color: string,
    infoTooltip?: string,
    tooltipLabel?: string
}) => {
    const { timeRange, setTimeRange, currentDate, handlePrev, handleNext, getDateRangeLabel } = useChartDateFilter()
    const [tooltipOpen, setTooltipOpen] = useState(false)

    // Filtering logic...
    const filteredData = useMemo(() => {
        const dataMap = new Map(data.map(d => [d.date, d.count]))
        const points = []
        let start: Date, end: Date

        if (timeRange === 'today') {
            const key = toIndoDate(currentDate)
            points.push({ label: 'Hoy', value: dataMap.get(key) ?? 0, fullDate: key })
            // Add prior mock point for line drawing if single point
            const prevv = new Date(currentDate); prevv.setDate(prevv.getDate() - 1);
            const keyPrev = toIndoDate(prevv)
            if (dataMap.has(keyPrev)) {
                points.unshift({ label: 'Ayer', value: dataMap.get(keyPrev) ?? 0, fullDate: keyPrev })
            }
        } else if (timeRange === 'week') {
            start = getStartOfWeek(currentDate); end = getEndOfWeek(currentDate)
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const key = toIndoDate(d)
                const dayLabel = d.toLocaleDateString("es-ES", { weekday: 'short' })
                points.push({ label: dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1), value: dataMap.get(key) ?? 0, fullDate: key })
            }
        } else if (timeRange === 'month') {
            start = getStartOfMonth(currentDate); end = getEndOfMonth(currentDate)
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const key = toIndoDate(d)
                points.push({ label: d.getDate().toString(), value: dataMap.get(key) ?? 0, fullDate: key })
            }
        } else if (timeRange === 'year') {
            const year = currentDate.getFullYear()
            for (let m = 0; m < 12; m++) {
                const monthKeyPrefix = `${year}-${String(m + 1).padStart(2, '0')}`
                let count = 0
                data.forEach(item => { if (item.date.startsWith(monthKeyPrefix)) count += item.count })
                const monthLabel = new Date(year, m, 1).toLocaleDateString("es-ES", { month: 'short' })
                points.push({ label: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1), value: count, fullDate: monthKeyPrefix })
            }
        }
        return points
    }, [data, timeRange, currentDate])

    return (
        <>
            <div className="flex items-start justify-between mb-4">
                <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.18em]">{subtitle}</p>
                    <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-slate-900 leading-tight">{title}</h3>
                        {infoTooltip && (
                            <Tooltip.Root open={tooltipOpen} onOpenChange={setTooltipOpen} delayDuration={0}>
                                <Tooltip.Trigger asChild>
                                    <button
                                        onClick={() => setTooltipOpen(!tooltipOpen)}
                                        className="text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        <HelpCircle size={14} />
                                    </button>
                                </Tooltip.Trigger>
                                <Tooltip.Portal>
                                    <Tooltip.Content
                                        className="z-50 bg-slate-900 text-white text-xs px-3 py-2 rounded-md shadow-lg max-w-[200px] leading-relaxed animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95"
                                        sideOffset={5}
                                        onClick={() => setTooltipOpen(false)}
                                    >
                                        {infoTooltip}
                                        <Tooltip.Arrow className="fill-slate-900" />
                                    </Tooltip.Content>
                                </Tooltip.Portal>
                            </Tooltip.Root>
                        )}
                    </div>
                </div>
                <ChartControls
                    label={getDateRangeLabel()}
                    handlePrev={handlePrev}
                    handleNext={handleNext}
                    timeRange={timeRange}
                    setTimeRange={setTimeRange}
                />
            </div>
            <SmoothLineChartContainer data={filteredData} color={color} tooltipLabel={tooltipLabel || title} />
        </>
    )
}

const SmartCouponSection = ({ data }: { data: { date: string, created: number, redeemed: number }[] }) => {
    const { timeRange, setTimeRange, currentDate, handlePrev, handleNext, getDateRangeLabel } = useChartDateFilter()

    const filteredData = useMemo(() => {
        const dataMap = new Map(data.map(d => [d.date, { created: d.created, redeemed: d.redeemed }]))
        const points = []
        let start: Date, end: Date

        if (timeRange === 'today') {
            const key = toIndoDate(currentDate)
            const val = dataMap.get(key) || { created: 0, redeemed: 0 }
            points.push({ label: 'Hoy', created: val.created, redeemed: val.redeemed })
        } else if (timeRange === 'week') {
            start = getStartOfWeek(currentDate); end = getEndOfWeek(currentDate)
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const key = toIndoDate(d)
                const val = dataMap.get(key) || { created: 0, redeemed: 0 }
                const dayLabel = d.toLocaleDateString("es-ES", { weekday: 'short' })
                points.push({ label: dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1), created: val.created, redeemed: val.redeemed })
            }
        } else if (timeRange === 'month') {
            start = getStartOfMonth(currentDate); end = getEndOfMonth(currentDate)
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const key = toIndoDate(d)
                const val = dataMap.get(key) || { created: 0, redeemed: 0 }
                points.push({ label: d.getDate().toString(), created: val.created, redeemed: val.redeemed })
            }
        } else if (timeRange === 'year') {
            const year = currentDate.getFullYear()
            for (let m = 0; m < 12; m++) {
                const monthKeyPrefix = `${year}-${String(m + 1).padStart(2, '0')}`
                let created = 0, redeemed = 0
                data.forEach(item => { if (item.date.startsWith(monthKeyPrefix)) { created += item.created; redeemed += item.redeemed } })
                const monthLabel = new Date(year, m, 1).toLocaleDateString("es-ES", { month: 'short' })
                points.push({ label: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1), created, redeemed })
            }
        }
        return points
    }, [data, timeRange, currentDate])

    return (
        <>
            <div className="flex items-start justify-between mb-4">
                <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.18em]">Cupones</p>
                    <h3 className="text-lg font-bold text-slate-900 leading-tight">Generados vs Canjeados</h3>
                    <div className="flex items-center gap-3 mt-1">
                        <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-gold"></div>
                            <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Generado</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-secondary-500"></div>
                            <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Canjeado</span>
                        </div>
                    </div>
                </div>
                <ChartControls
                    label={getDateRangeLabel()}
                    handlePrev={handlePrev}
                    handleNext={handleNext}
                    timeRange={timeRange}
                    setTimeRange={setTimeRange}
                />
            </div>
            <CouponChartContainer data={filteredData} />
        </>
    )
}

const VerticalLevelChart = ({ levelLadder, dashboardStats }: { levelLadder: LevelDefinition[], dashboardStats: DashboardStats | null }) => {
    const data = useMemo(() => {
        const ladder = [...levelLadder].sort((a, b) => a.minPoints - b.minPoints)
        const backendDist = dashboardStats?.levelDistribution || []
        const counts = new Map(backendDist.map(i => [i.name, i.count]))

        return ladder.map(level => ({
            name: level.name,
            value: counts.get(level.name) ?? 0,
            color: level.badge?.color ?? "#6366f1"
        }))
    }, [levelLadder, dashboardStats])

    return (
        <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        fontSize={10}
                        fontWeight="bold"
                        stroke="#94a3b8"
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                        dy={5}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        fontSize={10}
                        fontWeight="bold"
                        stroke="#94a3b8"
                    />
                    <RechartsTooltip
                        contentStyle={{
                            borderRadius: '12px',
                            border: 'none',
                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                            fontSize: '11px',
                            fontWeight: 'bold'
                        }}
                        cursor={{ fill: 'transparent' }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={50} name="Usuarios">
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

const SmoothLineChartContainer = ({ data, color, tooltipLabel }: { data: { label: string, value: number }[], color: string, tooltipLabel?: string }) => {
    if (data.length === 0) return <div className="h-64 flex items-center justify-center text-slate-400">Sin datos</div>

    const gradientId = `grad-${color.replace('#', '')}`

    return (
        <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        fontSize={10}
                        fontWeight="bold"
                        stroke="#94a3b8"
                        dy={10}
                        interval={0}
                        tickFormatter={(value) => String(value).charAt(0).toUpperCase() + String(value).slice(1)}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        fontSize={10}
                        fontWeight="bold"
                        stroke="#94a3b8"
                    />
                    <RechartsTooltip
                        contentStyle={{
                            borderRadius: '12px',
                            border: 'none',
                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                            fontSize: '11px',
                            fontWeight: 'bold'
                        }}
                    />
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke={color}
                        strokeWidth={3}
                        fillOpacity={1}
                        fill={`url(#${gradientId})`}
                        name={tooltipLabel || "Valor"}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    )
}

const CouponChartContainer = ({ data }: { data: { label: string, created: number, redeemed: number }[] }) => {
    if (data.length === 0) return <div className="h-64 flex items-center justify-center text-slate-400">Sin datos</div>

    return (
        <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        fontSize={10}
                        fontWeight="bold"
                        stroke="#94a3b8"
                        interval={0}
                        tickFormatter={(value) => String(value).charAt(0).toUpperCase() + String(value).slice(1)}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        fontSize={10}
                        fontWeight="bold"
                        stroke="#94a3b8"
                    />
                    <RechartsTooltip
                        contentStyle={{
                            borderRadius: '12px',
                            border: 'none',
                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                            fontSize: '11px',
                            fontWeight: 'bold'
                        }}
                    />
                    <Bar dataKey="created" fill="#F7DD81" radius={[2, 2, 0, 0]} name="Generados" />
                    <Bar dataKey="redeemed" fill="#6A3A30" radius={[2, 2, 0, 0]} name="Canjeados" />
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}
