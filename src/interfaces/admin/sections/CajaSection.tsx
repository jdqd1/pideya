import {
    ArrowRightLeft,
    Banknote,
    Camera,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    CreditCard,
    DollarSign,
    LayoutGrid,
    Loader,
    Mail,
    Search,
    ShoppingBag,
    Tag,
    Trash2,
    User,
    UserX,
    Smartphone,
    Wallet,
    X,
    IdCard,
    Plus,
    Minus,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react"
import type { CouponDto, CouponInspectResponse, UserLevelState } from "../../../types/userState"
import type { GeneratedQrRecord, ProductDef, ScannedProduct, SalesEvent, CajaState } from "../../../types/app"
import type { LevelDefinition } from "../../../types/loyalty"
import { DecodeHintType, BarcodeFormat } from "@zxing/library"
import { BrowserQRCodeReader } from "@zxing/browser"
import { getCouponCoverageByItem } from "../../client/utils"

// --- TYPES INLINED FOR PORTABILITY ---

type CheckoutCustomerState = {
    email: string
    cedula: string
    userId?: string | null
    levelState: UserLevelState | null
    coupons: CouponDto[]
    loading: boolean
    error: string | null
}

export type CajaSectionProps = {
    catalog: ProductDef[]
    qrRegistry: GeneratedQrRecord[]
    manualSales: ScannedProduct[]
    confirmedHistory: ScannedProduct[]
    qrSalesLedger: ScannedProduct[]
    onRegisterSale: (
        items: { code?: string; codes?: string[]; name: string; price: number; points: number; productId?: string; quantity?: number }[],
        customerEmail?: string,
        saleMeta?: { customerId?: string | null; couponId?: string | null; subtotal?: number; total?: number; discount?: number; customerCedula?: string | null; exchangeRate?: number; paymentMethod?: string; paymentDetails?: { method: string; amount: number; currency?: string; amountNative?: number; currencyNative?: string; amountUsd?: number; exchangeRate?: number | null }[]; customerName?: string; customerPhone?: string; documentType?: string; documentNumber?: string },
    ) => void | Promise<void>
    checkoutCustomer: CheckoutCustomerState
    onLookupCustomer: (cedula: string) => void | Promise<void>
    onClearCustomer: () => void
    activeLevelState?: UserLevelState | null
    formatMoney: (value: number | string | undefined | null) => string
    formatCouponSubtitle: (coupon: CouponDto) => string
    inspectCouponForSale: (raw: string) => Promise<{ coupon: CouponInspectResponse | null; isCoupon: boolean; error?: string }>
    redeemCouponForSale: (couponId: string) => Promise<{ ok: boolean; message?: string }>
    dailyRate?: number
    cajaState: CajaState
    setCajaState: Dispatch<SetStateAction<CajaState>>
}

// --- UTILS INLINED ---
const normalizeSaleCode = (code: string | undefined | null): string => {
    if (!code) return ""
    return code.trim().toUpperCase()
}
const normalizeCedula = (value?: string | null) => value?.replace(/\D/g, "") || ""
const VES_METHODS = new Set(["efectivo_bs", "pago_movil", "punto", "transferencia", "otro"])
const USD_METHODS = new Set(["efectivo_usd", "zelle"])


export default function CajaSection({
    catalog,
    qrRegistry,
    manualSales,
    confirmedHistory,
    qrSalesLedger,
    onRegisterSale,
    checkoutCustomer,
    onLookupCustomer,
    onClearCustomer,
    activeLevelState,
    formatMoney,
    formatCouponSubtitle,
    inspectCouponForSale,
    redeemCouponForSale,
    dailyRate,
    cajaState,
    setCajaState,
}: CajaSectionProps) {
    const { cartItems, appliedCoupon, isRegisteredUser } = cajaState

    const setCartItems = (action: SetStateAction<SalesEvent[]>) => {
        setCajaState(prev => {
            const nextCart = typeof action === 'function' ? action(prev.cartItems) : action
            return { ...prev, cartItems: nextCart }
        })
    }
    const setAppliedCoupon = (action: SetStateAction<CouponInspectResponse | null>) => {
        setCajaState(prev => {
            const next = typeof action === 'function' ? action(prev.appliedCoupon) : action
            return { ...prev, appliedCoupon: next }
        })
    }
    const setIsRegisteredUser = (action: SetStateAction<boolean>) => {
        setCajaState(prev => {
            const next = typeof action === 'function' ? action(prev.isRegisteredUser) : action
            return { ...prev, isRegisteredUser: next }
        })
    }

    const [cartCode, setCartCode] = useState("")
    const saleInputRef = useRef<HTMLInputElement | null>(null)
    const customerInputRef = useRef<HTMLInputElement>(null)
    const registerVideoRef = useRef<HTMLVideoElement>(null)
    const registerControlsRef = useRef<any>(null)
    const changeInputInitializedRef = useRef(false)
    const [registerScannerActive, setRegisterScannerActive] = useState(false)
    const [registerScannerStatus, setRegisterScannerStatus] = useState("Escaneando...")
    const [isProcessingScan, setIsProcessingScan] = useState(false)
    const isProcessingScanRef = useRef(false)
    useEffect(() => { isProcessingScanRef.current = isProcessingScan }, [isProcessingScan])

    const lastRegisterScanRef = useRef<string>("")
    const lastRegisterScanTimeRef = useRef<number>(0)
    // applyLevelPerks removed
    const [customerCedula, setCustomerCedula] = useState(checkoutCustomer.cedula ?? "")
    // showChargeModal removed


    const [finalizingSale, setFinalizingSale] = useState(false)
    const [checkoutError, setCheckoutError] = useState<string | null>(null)



    // UI States for layout control (New for Redesign)
    // isRegisteredUser lifted to props
    const [isShortcutsOpen, setIsShortcutsOpen] = useState(false) // Default closed to save space
    // appliedCoupon lifted to props
    const [viewCurrency, setViewCurrency] = useState<'USD' | 'VES'>('VES') // Default to BS
    const [showCoupons, setShowCoupons] = useState(false) // Default collapsed
    const [payments, setPayments] = useState<{ id: string; method: string; amount: number }[]>([])
    const [showPaymentModal, setShowPaymentModal] = useState(false)
    const [paymentAmountInput, setPaymentAmountInput] = useState("")
    const [changePayments, setChangePayments] = useState<{ id: string; method: string; amount: number }[]>([])
    const [changeAmountInput, setChangeAmountInput] = useState("")
    const [paymentTab, setPaymentTab] = useState<'VES' | 'USD'>('VES')
    const [changeTab, setChangeTab] = useState<'VES' | 'USD'>('VES')
    // Removed unused currentPaymentMethod

    // Prevent background scroll when modal is open
    useEffect(() => {
        if (showPaymentModal) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => {
            document.body.style.overflow = ''
        }
    }, [showPaymentModal])

    const roundUsd = (value: number) => Math.round(value * 100) / 100
    // Use cent-level USD units; no tolerance is allowed.
    const USD_SCALE = 100
    const USD_TOLERANCE_UNITS = 0
    const toUsdUnits = (value: number) => Math.round(value * USD_SCALE)
    const fromUsdUnits = (units: number) => units / USD_SCALE
    const toCents = (value: number) => Math.round(value * 100)
    const toNumber = (value: number | string | null | undefined) => {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : 0
    }
    const snapUnitsToZero = (units: number) =>
        Math.abs(units) <= USD_TOLERANCE_UNITS ? 0 : units
    const roundedRate = useMemo(() => {
        const rate = Number(dailyRate || 0)
        if (!Number.isFinite(rate) || rate <= 0) return 0
        return Math.round(rate * 100) / 100
    }, [dailyRate])

    const getRateCents = () => Math.round(roundedRate * 100)
    const convertUsdCentsToVesCents = (usdCents: number) => {
        const rateCents = getRateCents()
        if (!rateCents) return 0
        return Math.round((usdCents * rateCents) / 100)
    }
    const convertUsdToVes = (amountUsd: number) => {
        const rateCents = getRateCents()
        if (!rateCents) return 0
        const usdCents = toUsdUnits(amountUsd)
        const vesCents = Math.round((usdCents * rateCents) / 100)
        return vesCents / 100
    }
    const convertVesToUsdUnits = (amountVes: number) => {
        const rateCents = getRateCents()
        if (!rateCents) return 0
        const vesCents = toCents(amountVes)
        return Math.round((vesCents * 100) / rateCents)
    }
    const convertVesToUsd = (amountVes: number) =>
        fromUsdUnits(convertVesToUsdUnits(amountVes))

    const formatCurrency = (amountUsd: number | undefined | null) => {
        const val = roundUsd(toNumber(amountUsd))
        if (viewCurrency === 'USD') return formatMoney(val)
        if (!roundedRate) return "Bs. --"
        const vesAmount = convertUsdToVes(val)
        return `Bs. ${vesAmount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }
    const formatVesFromCents = (cents: number) =>
        `Bs. ${(cents / 100).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    const formatTabAmount = (target: 'USD' | 'VES', amountUsd: number, amountVesCents?: number) => {
        const amount = toNumber(amountUsd)
        if (target === 'USD') return formatMoney(roundUsd(amount))
        if (!roundedRate) return "Bs. --"
        const cents = typeof amountVesCents === 'number'
            ? Math.max(0, Math.round(amountVesCents))
            : Math.round(convertUsdToVes(amount) * 100)
        return formatVesFromCents(cents)
    }
    const formatMethodAmount = (method: string, amountUsd: number) => {
        const amount = toNumber(amountUsd)
        if (USD_METHODS.has(method)) return formatMoney(amount)
        if (VES_METHODS.has(method)) {
            return `Bs. ${amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        }
        return formatMoney(amount)
    }
    const convertVesCentsToUsdUnits = (vesCents: number) => {
        const rateCents = getRateCents()
        if (!rateCents) return 0
        return Math.round((vesCents * 100) / rateCents)
    }
    const sumPaymentsByCurrency = (list: { method: string; amount: number }[]) => {
        let usdCents = 0
        let vesCents = 0
        list.forEach((payment) => {
            const amount = toNumber(payment.amount)
            if (USD_METHODS.has(payment.method)) {
                usdCents += toUsdUnits(amount)
                return
            }
            if (VES_METHODS.has(payment.method)) {
                vesCents += toCents(amount)
                return
            }
            usdCents += toUsdUnits(amount)
        })
        return { usdCents, vesCents }
    }
    const getTotalPaidUnits = (list: { method: string; amount: number }[]) => {
        const totals = sumPaymentsByCurrency(list)
        return totals.usdCents + convertVesCentsToUsdUnits(totals.vesCents)
    }
    const getTotalPaidVesCents = (list: { method: string; amount: number }[]) => {
        const totals = sumPaymentsByCurrency(list)
        return totals.vesCents + convertUsdCentsToVesCents(totals.usdCents)
    }
    const getRemainingAfterPayments = (list: { method: string; amount: number }[]) => {
        const totals = sumPaymentsByCurrency(list)
        const paidUsdUnits = totals.usdCents + convertVesCentsToUsdUnits(totals.vesCents)
        const remainingUsdUnits = totalDueUnits - paidUsdUnits
        const paidVesCents = totals.vesCents + convertUsdCentsToVesCents(totals.usdCents)
        const remainingVesCents = rateCents ? totalDueVesCents - paidVesCents : 0
        return { remainingUsdUnits, remainingVesCents }
    }
    const getAmountForTab = (payment: { method: string; amount: number }, target: 'USD' | 'VES') => {
        const amount = toNumber(payment.amount)
        if (target === 'USD') {
            if (USD_METHODS.has(payment.method)) return amount
            return convertVesToUsd(amount)
        }
        if (VES_METHODS.has(payment.method)) return amount
        return convertUsdToVes(amount)
    }
    const toPaymentInputValue = (amountUsd: number, target: 'USD' | 'VES', amountVesCents?: number) => {
        const amount = toNumber(amountUsd)
        if (target === 'USD') {
            if (amount <= fromUsdUnits(USD_TOLERANCE_UNITS)) return ""
            return roundUsd(amount).toFixed(2)
        }
        if (!roundedRate) return ""
        if (typeof amountVesCents === 'number') {
            const normalized = Math.max(0, Math.round(amountVesCents)) / 100
            return normalized > 0 ? normalized.toFixed(2) : ""
        }
        return roundUsd(convertUsdToVes(amount)).toFixed(2)
    }
    // --- Memos y Efectos ---
    const soldCodesSet = useMemo(() => {
        const entries = [...manualSales, ...confirmedHistory, ...qrSalesLedger]
        const codes = entries
            .map((item) => normalizeSaleCode(item.code))
            .filter((val): val is string => Boolean(val))
        return new Set(codes)
    }, [confirmedHistory, manualSales, qrSalesLedger])
    const cartCodeSet = useMemo(() => {
        const set = new Set<string>()
        cartItems.forEach((item) => {
            const normalized = normalizeSaleCode(item.code)
            if (normalized) set.add(normalized)
                ; (item.codes ?? []).forEach((code) => {
                    const norm = normalizeSaleCode(code)
                    if (norm) set.add(norm)
                })
        })
        return set
    }, [cartItems])
    const typedCustomerCedula = normalizeCedula(customerCedula)
    const checkoutCustomerCedula = normalizeCedula(checkoutCustomer.cedula)
    const saleCedulaForTicket = isRegisteredUser ? checkoutCustomerCedula : typedCustomerCedula
    const canUseTicket = isRegisteredUser || Boolean(typedCustomerCedula)

    useEffect(() => {
        if (isRegisteredUser) {
            setCustomerCedula(checkoutCustomer.cedula ?? "")
        }
    }, [checkoutCustomer.cedula, isRegisteredUser])

    // --- DEBOUNCE SEARCH EFFECT ---
    useEffect(() => {
        if (!isRegisteredUser) return
        const query = typedCustomerCedula
        if (!query || query.length < 3) return // Don't search for tiny strings

        // Don't search if it matches the currently loaded user to avoid redundant calls
        if (checkoutCustomer.cedula === query) return

        const timer = setTimeout(() => {
            void onLookupCustomer(query)
        }, 600) // 600ms debounce

        return () => clearTimeout(timer)
    }, [isRegisteredUser, typedCustomerCedula, checkoutCustomer.cedula, onLookupCustomer])

    // Clean up on unmount (switching sections)
    // Clean up on unmount (switching sections) - REMOVED for persistence
    // useEffect(() => {
    //     return () => {
    //         onClearCustomer()
    //         // Note: internal state (cartItems) is cleared automatically on unmount
    //     }
    // }, [])

    // Effect to handle customer type toggle logic
    useEffect(() => {
        if (!isRegisteredUser && checkoutCustomer.userId) {
            onClearCustomer()
        }
    }, [checkoutCustomer.userId, isRegisteredUser, onClearCustomer])

    // Safety: Remove applied coupon if switching to non-registered or clearing customer
    useEffect(() => {
        if (!isRegisteredUser || !checkoutCustomer.userId) {
            if (appliedCoupon) {
                setAppliedCoupon(null)
            }
        }
        if (!isRegisteredUser || checkoutCustomer.userId) {
            setCheckoutError(null)
        }
    }, [isRegisteredUser, checkoutCustomer.userId, appliedCoupon])

    useEffect(() => {
        if (!isRegisteredUser && typedCustomerCedula && checkoutError) {
            setCheckoutError(null)
        }
    }, [checkoutError, isRegisteredUser, typedCustomerCedula])

    useEffect(() => {
        if (isRegisteredUser && checkoutCustomer.userId) {
            setIsShortcutsOpen(true)
        }
    }, [checkoutCustomer.userId, isRegisteredUser])

    // --- Logica Carrito ---
    const resolveSaleItem = (raw: string): SalesEvent | null => {
        // EXTRACT CODE FROM LINE
        let rawCode = raw
        let overridePrice: number | undefined
        let overridePoints: number | undefined

        try {
            // Robust parsing: Handle full URLs, partials, or query strings
            // This ensures we extract the stable "code" param even if the QR has dynamic noise (timestamps etc)
            const dummyBase = 'http://app.local'
            let urlToParse = raw

            // If it does not look like a URL (no protocol), treat as potential query string or path
            if (!raw.match(/^[a-z]+:\/\//i)) {
                // If starts with ?, plain query string. If NOT, assume it might be "code=xyz" format, so prepend ?
                // If it is just "xyz", prepending ? makes it search searchParams, but "code" key will not be found, which is correct fallback.
                urlToParse = raw.startsWith('?') ? `${dummyBase}${raw}` : `${dummyBase}?${raw}`
            }

            const urlObj = new URL(urlToParse)
            const codeParam = urlObj.searchParams.get('code')

            // Only update if we explicitly found the "code" parameter
            if (codeParam) {
                rawCode = codeParam

                const priceParam = urlObj.searchParams.get('price')
                if (priceParam) overridePrice = Number(priceParam)

                const pointsParam = urlObj.searchParams.get('points')
                if (pointsParam) overridePoints = Number(pointsParam)
            }
        } catch (e) {
            // Not a parsable URL structure, continue with raw input
        }

        const normalizedCode = normalizeSaleCode(rawCode)
        const fallbackCode = rawCode.trim().toUpperCase()
        const code = normalizedCode || fallbackCode
        const uniqueKey = normalizedCode || code
        if (!uniqueKey) return null

        // 1. Check if already SOLD/REGISTERED
        if (soldCodesSet.has(uniqueKey)) {
            setRegisterScannerStatus('Producto ya entregado/vendido')
            return null
        }

        // Match Logic
        const qrMatch = qrRegistry.find((qr) => qr.id.toLowerCase() === uniqueKey.toLowerCase())
        // STRICTER FINDING LOGIC: Do not default to catalog[0]
        const productById = qrMatch?.productId ? catalog.find((p) => p.id === qrMatch.productId) : undefined
        // Allow partial name match for manual search if no exact match found
        const productByName = catalog.find((p) => p.name.toLowerCase() === uniqueKey.toLowerCase() || (uniqueKey.length > 3 && p.name.toLowerCase().includes(uniqueKey.toLowerCase())))
        const productByCode = catalog.find((p) => p.id?.toLowerCase() === uniqueKey.toLowerCase())

        // Use matches or null
        const product = productById || productByName || productByCode

        if (!product && !qrMatch) {
            setRegisterScannerStatus('Producto no encontrado')
            return null
        }

        if (normalizedCode && qrMatch && cartCodeSet.has(normalizedCode)) {
            setRegisterScannerStatus('Ya esta en el carrito')
            return null
        }

        const name = qrMatch?.productName ?? product?.name ?? code
        const price = roundUsd(qrMatch?.price ?? overridePrice ?? product?.price ?? 0)
        const points = qrMatch?.points ?? overridePoints ?? product?.points ?? 0
        const baseCodes = normalizedCode ? [normalizedCode] : []

        return {
            key: `cart-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
            code, // Use the extracted/normalized code
            codes: baseCodes.length ? baseCodes : undefined,
            productId: qrMatch?.productId ?? product?.id,
            name,
            price,
            points,
            quantity: 1,
            scannedAt: new Date().toISOString(),
        }
    }
    const upsertCartItem = (incoming: SalesEvent, options?: { allowQuantityMerge?: boolean }) => {
        const normalizedIncomingCodes = [
            normalizeSaleCode(incoming.code),
            ...(incoming.codes ?? []).map((code) => normalizeSaleCode(code)),
        ].filter((val): val is string => Boolean(val))
        const allowQuantityMerge = options?.allowQuantityMerge ?? false

        setCartItems((prev) => {
            const codeSet = new Set<string>()
            prev.forEach((item) => {
                const base = normalizeSaleCode(item.code)
                if (base) codeSet.add(base)
                    ; (item.codes ?? []).forEach((code) => {
                        const norm = normalizeSaleCode(code)
                        if (norm) codeSet.add(norm)
                    })
            })

            const overlaps = normalizedIncomingCodes.some((code) => codeSet.has(code))
            if (overlaps && !allowQuantityMerge) {
                setRegisterScannerStatus("Ya esta en el carrito")
                return prev
            }

            const mergeIdx = prev.findIndex((item) => {
                if (incoming.productId && item.productId && incoming.productId === item.productId) return true
                if (!incoming.productId && !item.productId) {
                    return item.name.toLowerCase() === incoming.name.toLowerCase()
                }
                return false
            })

            const collectCodes = (item: SalesEvent) => {
                const codes = new Set<string>()
                const base = normalizeSaleCode(item.code)
                if (base) codes.add(base)
                    ; (item.codes ?? []).forEach((code) => {
                        const norm = normalizeSaleCode(code)
                        if (norm) codes.add(norm)
                    })
                return codes
            }

            if (mergeIdx !== -1) {
                const target = prev[mergeIdx]
                const mergedCodes = collectCodes(target)
                normalizedIncomingCodes.forEach((code) => mergedCodes.add(code))
                const merged: SalesEvent = {
                    ...target,
                    quantity: (target.quantity ?? 1) + (incoming.quantity ?? 1),
                }
                if (mergedCodes.size) merged.codes = Array.from(mergedCodes)
                return prev.map((item, idx) => (idx === mergeIdx ? merged : item))
            }

            const mergedCodes = collectCodes(incoming)
            normalizedIncomingCodes.forEach((code) => mergedCodes.add(code))
            const fresh: SalesEvent = {
                ...incoming,
                quantity: incoming.quantity ?? 1,
                ...(mergedCodes.size ? { codes: Array.from(mergedCodes) } : {}),
            }
            return [fresh, ...prev]
        })
    }

    const updateCartItemQuantity = (key: string, delta: number) => {
        setCartItems(prev => prev.map(item => {
            if (item.key === key) {
                const currentQty = item.quantity ?? 1
                const nextQty = Math.max(1, currentQty + delta)
                return { ...item, quantity: nextQty }
            }
            return item
        }))
    }

    const processCouponScan = useCallback(
        async (raw: string): Promise<'success' | 'error' | 'none'> => {
            const data = await inspectCouponForSale(raw)
            if (!data.isCoupon) return 'none'
            if (data.error) {
                setRegisterScannerStatus(data.error)
                return 'error'
            }
            const couponData = data.coupon
            if (!couponData) return 'error'

            if (couponData.coupon.status !== "available") {
                setRegisterScannerStatus("Este cupon no esta disponible")
                return 'error'
            }
            if (appliedCoupon && appliedCoupon.coupon.id !== couponData.coupon.id) {
                setRegisterScannerStatus("Solo puedes usar un cupon por ticket")
                return 'error'
            }
            if (appliedCoupon && appliedCoupon.coupon.id === couponData.coupon.id) {
                setRegisterScannerStatus("Este cupon ya esta aplicado")
                return 'error'
            }
            if (isRegisteredUser && !checkoutCustomer.userId) {
                setRegisterScannerStatus("Asocia un cliente para usar el cupon")
                return 'error'
            }
            const ownerId = couponData.owner?.id
            if (ownerId && checkoutCustomer.userId && ownerId !== checkoutCustomer.userId) {
                setRegisterScannerStatus("El cupon pertenece a otro cliente")
                return 'error'
            }
            const ownerEmail = couponData.owner?.email?.toLowerCase()
            const checkoutEmail = checkoutCustomer.email?.toLowerCase()
            if (checkoutEmail && ownerEmail && ownerEmail !== checkoutEmail) {
                setRegisterScannerStatus("El cupon pertenece a otro cliente")
                return 'error'
            }
            const ownerCedula = normalizeCedula(couponData.owner?.cedula ?? null)
            const checkoutCedula = normalizeCedula(checkoutCustomer.cedula ?? null)
            if (checkoutCedula && ownerCedula && ownerCedula !== checkoutCedula) {
                setRegisterScannerStatus("El cupon pertenece a otro cliente")
                return 'error'
            }

            // ALL coupons are now applied directly as discounts
            setAppliedCoupon(couponData)
            setRegisterScannerStatus("Cupon aplicado al ticket")
            return 'success'
        },
        [appliedCoupon, checkoutCustomer.cedula, checkoutCustomer.email, checkoutCustomer.userId, isRegisteredUser, inspectCouponForSale],
    )

    const addCodeToCart = async (raw: string) => {
        if (!canUseTicket) {
            setCheckoutError("Ingresa la cedula para activar el ticket provisional")
            setRegisterScannerStatus("Cedula requerida")
            customerInputRef.current?.focus()
            return
        }
        const result = await processCouponScan(raw)
        if (result === 'success') {
            setCartCode("")
            setRegisterScannerActive(false) // Close scanner on success
            return
        }
        if (result === 'error') {
            // Keep scanner open to show error
            return
        }

        // result === 'none' -> Try regular item
        const item = resolveSaleItem(raw)
        if (!item) {
            // Unknown code
            setRegisterScannerActive(true)
            saleInputRef.current?.focus()
            return
        }
        const isQrItem = (item.codes ?? []).some((code) =>
            qrRegistry.some((qr) => normalizeSaleCode(qr.id) === code),
        )
        const now = Date.now()
        const dedupeKey = normalizeSaleCode(item.code) || item.code || ""
        if (dedupeKey === lastRegisterScanRef.current && now - lastRegisterScanTimeRef.current < 1000) {
            setRegisterScannerStatus("Espera un momento...")
            return
        }
        lastRegisterScanRef.current = dedupeKey
        lastRegisterScanTimeRef.current = now
        upsertCartItem(item, { allowQuantityMerge: !isQrItem })
        setCartCode("")
        setRegisterScannerActive(false) // Close scanner on item add
        setTimeout(() => saleInputRef.current?.focus(), 50)
    }


    // State-fresh wrapper for addCodeToCart to be used in scanner callback
    const latestAddCodeToCart = useRef(addCodeToCart)

    // Update the ref on every render so the scanner always sees the latest logic/state
    useEffect(() => {
        latestAddCodeToCart.current = addCodeToCart
    })

    const addProductToCart = (product: ProductDef) => {
        if (!canUseTicket) {
            setCheckoutError("Ingresa la cedula para activar el ticket provisional")
            customerInputRef.current?.focus()
            return
        }
        if (product.active === false || (product.stock ?? 1) <= 0) {
            setCheckoutError("Este producto no esta disponible para vender")
            return
        }
        const normalizedCode = normalizeSaleCode(product.id ?? product.name)
        const item: SalesEvent = {
            key: `cart-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
            code: normalizedCode || product.id || product.name,
            productId: product.id,
            name: product.name,
            price: roundUsd(product.price ?? 0),
            points: product.points ?? 0,
            quantity: 1,
            scannedAt: new Date().toISOString(),
        }
        upsertCartItem(item, { allowQuantityMerge: true })
        // Removed auto-focus on mobile request to prevent keyboard popup
        // setTimeout(() => saleInputRef.current?.focus(), 50)
    }
    const cartTotals = useMemo(
        () =>
            cartItems.reduce(
                (acc, item) => {
                    const qty = Number(item.quantity ?? 1) || 1
                    acc.units += qty
                    acc.revenue += roundUsd(item.price ?? 0) * qty
                    acc.points += Number(item.points ?? 0) * qty
                    return acc
                },
                { units: 0, revenue: 0, points: 0 },
            ),
        [cartItems],
    )
    const totalUnits = cartTotals.units
    const customerEmailDisplay = checkoutCustomer.email?.trim() || ""
    const customerNameDisplay = useMemo(() => {
        const nameFromEmail = customerEmailDisplay ? customerEmailDisplay.split("@")[0] : ""
        if (nameFromEmail) return nameFromEmail
        if (checkoutCustomer.cedula) return `Cliente ${checkoutCustomer.cedula}`
        if (!isRegisteredUser && typedCustomerCedula) return `Cliente provisional ${typedCustomerCedula}`
        return "Cliente sin nombre"
    }, [checkoutCustomer.cedula, customerEmailDisplay, isRegisteredUser, typedCustomerCedula])

    const appliedLevel = useMemo(
        () => checkoutCustomer.levelState?.currentLevel ?? activeLevelState?.currentLevel ?? null,
        [activeLevelState?.currentLevel, checkoutCustomer.levelState],
    )

    const couponCoverage = useMemo(
        () => getCouponCoverageByItem(cartItems, appliedCoupon?.coupon ?? null),
        [cartItems, appliedCoupon],
    )
    const pointsBlockedByCoupon = useMemo(
        () => couponCoverage.some((covered) => covered > 0),
        [couponCoverage],
    )
    const blockedItemsCount = useMemo(
        () => couponCoverage.reduce((sum, covered) => sum + (covered > 0 ? 1 : 0), 0),
        [couponCoverage],
    )

    const effectiveTotalPoints = useMemo(() => (
        cartItems.reduce((sum, item, index) => {
            const qty = Math.max(1, Number(item.quantity ?? 1) || 1)
            const coveredUnits = Math.max(0, Math.min(qty, Number(couponCoverage[index] ?? 0) || 0))
            const eligibleUnits = Math.max(0, qty - coveredUnits)
            return sum + (Number(item.points ?? 0) * eligibleUnits)
        }, 0)
    ), [cartItems, couponCoverage])

    const calculateLevelTotals = useCallback(
        (level: LevelDefinition | null) => {
            const subtotal = cartTotals.revenue
            const total = Math.max(0, subtotal)
            return {
                level,
                subtotal,
                apply: false,
                permanentPct: 0,
                selectivePct: 0,
                discountPermanent: 0,
                discountSelective: 0,
                totalDiscount: 0,
                total,
                color: level?.badge?.color ?? "#0ea5e9",
            }
        },
        [cartTotals.revenue],
    )

    const levelDiscounts = useMemo(
        () => calculateLevelTotals(appliedLevel),
        [appliedLevel, calculateLevelTotals],
    )



    const couponDiscount = useMemo(() => {
        if (!appliedCoupon || levelDiscounts.total <= 0) return 0

        // Percentage Discount
        if (appliedCoupon.coupon.kind === "percent" && appliedCoupon.coupon.value) {
            const raw = (levelDiscounts.total * appliedCoupon.coupon.value) / 100
            const cap = appliedCoupon.coupon.capUsd ?? null
            const capped = cap ? Math.min(raw, cap) : raw
            return Math.max(0, capped)
        }

        // Free Item / Gift Card Style Discount
        if (appliedCoupon.coupon.kind === "free-item" || appliedCoupon.coupon.kind === "gift-card" || appliedCoupon.coupon.kind === "combo") {
            const value = appliedCoupon.coupon.capUsd ?? 0 // capUsd holds the dollar value
            return Math.min(levelDiscounts.total, value)
        }

        return 0
    }, [appliedCoupon, levelDiscounts.total])

    const totalAfterDiscounts = useMemo(
        () => Math.max(0, levelDiscounts.total - couponDiscount),
        [couponDiscount, levelDiscounts.total],
    )
    const cartSubtotalUnits = useMemo(
        () => Math.max(0, toUsdUnits(cartTotals.revenue)),
        [cartTotals.revenue],
    )
    const totalDueUnits = useMemo(
        () => Math.max(0, toUsdUnits(totalAfterDiscounts)),
        [totalAfterDiscounts],
    )
    const cartSubtotalUsd = fromUsdUnits(cartSubtotalUnits)
    const totalDueUsd = fromUsdUnits(totalDueUnits)
    const rateCents = getRateCents()
    const paymentTotals = useMemo(
        () => sumPaymentsByCurrency(payments),
        [payments],
    )
    const changeTotals = useMemo(
        () => sumPaymentsByCurrency(changePayments),
        [changePayments],
    )
    const totalPaidUnits = useMemo(
        () => paymentTotals.usdCents + convertVesCentsToUsdUnits(paymentTotals.vesCents),
        [paymentTotals, rateCents],
    )
    const totalPaidVesCents = useMemo(
        () => (rateCents ? paymentTotals.vesCents + convertUsdCentsToVesCents(paymentTotals.usdCents) : 0),
        [paymentTotals, rateCents],
    )
    const totalDueVesCents = useMemo(
        () => (rateCents ? convertUsdCentsToVesCents(totalDueUnits) : 0),
        [totalDueUnits, rateCents],
    )
    const remainingUsdUnits = totalDueUnits - totalPaidUnits
    const remainingVesCents = rateCents ? totalDueVesCents - totalPaidVesCents : 0
    const hasUsdPayments = paymentTotals.usdCents > 0
    const hasVesPayments = paymentTotals.vesCents > 0
    const paymentRequiresUsdSettlement = !rateCents || hasUsdPayments || !hasVesPayments
    const paymentRequiresVesSettlement = Boolean(rateCents && hasVesPayments)
    const paymentUsdCovered = totalPaidUnits >= totalDueUnits
    const paymentVesCovered = !rateCents || totalPaidVesCents >= totalDueVesCents
    const isPaymentCovered =
        (!paymentRequiresUsdSettlement || paymentUsdCovered) &&
        (!paymentRequiresVesSettlement || paymentVesCovered)
    const changeDueUsdUnits = Math.max(0, -remainingUsdUnits)
    const changeDueVesCents = rateCents ? Math.max(0, -remainingVesCents) : 0
    const changePaidUnits = useMemo(
        () => changeTotals.usdCents + convertVesCentsToUsdUnits(changeTotals.vesCents),
        [changeTotals, rateCents],
    )
    const changePaidVesCents = useMemo(
        () => (rateCents ? changeTotals.vesCents + convertUsdCentsToVesCents(changeTotals.usdCents) : 0),
        [changeTotals, rateCents],
    )
    const changeRemainingUsdUnits = snapUnitsToZero(changeDueUsdUnits - changePaidUnits)
    const changeRemainingVesCents = rateCents ? changeDueVesCents - changePaidVesCents : 0
    const showChangePanel = changeDueUsdUnits > 0 || changeDueVesCents > 0
    const hasUsdChangePayments = changeTotals.usdCents > 0
    const hasVesChangePayments = changeTotals.vesCents > 0
    const changeRequiresVesSettlement = Boolean(
        rateCents &&
        changeDueVesCents > 0 &&
        (changeDueUsdUnits <= 0 || hasVesChangePayments),
    )
    const changeRequiresUsdSettlement = Boolean(
        changeDueUsdUnits > 0 &&
        (!changeRequiresVesSettlement || hasUsdChangePayments),
    )
    const isChangeSettled = !showChangePanel ||
        ((!changeRequiresUsdSettlement || changeRemainingUsdUnits === 0) &&
            (!changeRequiresVesSettlement || changeRemainingVesCents === 0))
    const canConfirmPayment = canUseTicket && isPaymentCovered && isChangeSettled

    useEffect(() => {
        if (!showChangePanel || !rateCents) return
        if (changeDueUsdUnits <= 0 && changeDueVesCents > 0 && changeTab !== 'VES') {
            setChangeTab('VES')
        }
    }, [changeDueUsdUnits, changeDueVesCents, changeTab, rateCents, showChangePanel])



    const quickProducts = useMemo(() => {
        const sellable = catalog.filter((p) => p.active !== false && (p.stock ?? 1) > 0)
        if (!cartCode.trim()) return sellable
        const query = cartCode.toLowerCase()
        return sellable.filter((p) =>
            p.name.toLowerCase().includes(query) ||
            (p.id?.toLowerCase() ?? "").includes(query)
        )
    }, [catalog, cartCode])

    const hasCartItems = totalUnits > 0
    useEffect(() => {
        if (showChangePanel) return
        if (changePayments.length) setChangePayments([])
        if (changeAmountInput) setChangeAmountInput("")
    }, [changeAmountInput, changePayments.length, showChangePanel])
    useEffect(() => {
        if (!showChangePanel) {
            changeInputInitializedRef.current = false
            return
        }
        if (changeInputInitializedRef.current) return
        const remainingVes = rateCents && changeTab === 'VES'
            ? Math.max(0, changeRemainingVesCents)
            : rateCents
                ? convertUsdCentsToVesCents(Math.max(0, changeRemainingUsdUnits))
                : 0
        const remainingUnits = changeTab === 'VES' && rateCents
            ? convertVesCentsToUsdUnits(remainingVes)
            : Math.max(0, changeRemainingUsdUnits)
        const nextInput = toPaymentInputValue(
            fromUsdUnits(remainingUnits),
            changeTab,
            remainingVes,
        )
        if (nextInput) {
            setChangeAmountInput(nextInput)
        }
        changeInputInitializedRef.current = true
    }, [
        showChangePanel,
        changeRemainingVesCents,
        changeRemainingUsdUnits,
        changeTab,
        rateCents,
    ])
    useEffect(() => {
        if (!hasCartItems) {
            setAppliedCoupon(null)
        }
    }, [hasCartItems])

    const levelCouponsAvailable = useMemo(
        () => (checkoutCustomer.coupons ?? []).filter((coupon) => coupon.status === "available"),
        [checkoutCustomer.coupons],
    )

    const handleApplyLevelCoupon = (coupon: CouponDto) => {
        if (!isRegisteredUser || !checkoutCustomer.userId) {
            setRegisterScannerStatus("Asocia un cliente para usar el cupon")
            return
        }
        if (coupon.status !== "available") {
            setRegisterScannerStatus("Cupon no disponible")
            return
        }
        if (appliedCoupon && appliedCoupon.coupon.id !== coupon.id) {
            setRegisterScannerStatus("Solo puedes usar un cupon por ticket")
            return
        }
        if (appliedCoupon && appliedCoupon.coupon.id === coupon.id) {
            setRegisterScannerStatus("Este cupon ya esta aplicado")
            return
        }

        const inspection: CouponInspectResponse = {
            coupon,
            owner: checkoutCustomer.userId ? { id: checkoutCustomer.userId, email: checkoutCustomer.email || undefined, cedula: checkoutCustomer.cedula || undefined } : null,
            progress: null,
        }
        setAppliedCoupon(inspection)
        setRegisterScannerStatus("Cupon aplicado al ticket")
    }
    const finalizeSale = useCallback(async () => {
        if (!hasCartItems || finalizingSale || !canConfirmPayment) return
        if (!isRegisteredUser && !typedCustomerCedula) {
            setCheckoutError("Ingresa la cedula para crear el cliente provisional")
            setShowPaymentModal(false)
            customerInputRef.current?.focus()
            return
        }
        setFinalizingSale(true)
        setShowPaymentModal(false)
        try {
            if (appliedCoupon) {
                if (!checkoutCustomer.userId) {
                    setRegisterScannerStatus("Error: Asocia un cliente para usar el cupón")
                    setFinalizingSale(false)
                    return
                }
                const redemption = await redeemCouponForSale(appliedCoupon.coupon.id)
                if (!redemption.ok) {
                    setRegisterScannerStatus(redemption.message || "No se pudo canjear el cupon")
                    return
                }
            }
            const itemsForSale = cartItems.map((i) => {
                const basePrice = roundUsd(i.price ?? 0)
                const price = basePrice
                const rawPoints = Number(i.points ?? 0)
                const points = Number.isFinite(rawPoints) ? rawPoints : 0
                return {
                    code: i.code,
                    codes: i.codes,
                    name: i.name,
                    price,
                    points,
                    productId: i.productId,
                    quantity: i.quantity ?? 1,
                }
            })
            const uniqueMethods = Array.from(new Set(payments.map((p) => p.method).filter(Boolean)))
            const paymentMethod = uniqueMethods.length === 1 ? uniqueMethods[0] : undefined
            const paymentDetails = [
                ...payments
                    .filter((p) => Number.isFinite(p.amount) && p.amount > 0)
                    .map((p) => ({
                        method: p.method,
                        amount: p.amount,
                        currency: USD_METHODS.has(p.method) ? "USD" : "VES",
                    })),
                ...changePayments
                    .filter((p) => Number.isFinite(p.amount) && p.amount > 0)
                    .map((p) => ({
                        method: `vuelto_${p.method}`,
                        amount: p.amount,
                        currency: USD_METHODS.has(p.method) ? "USD" : "VES",
                    })),
            ]

            await Promise.resolve(
                onRegisterSale(itemsForSale, isRegisteredUser ? checkoutCustomer.email || undefined : undefined, {
                    customerId: isRegisteredUser ? checkoutCustomer.userId : null,
                    customerCedula: saleCedulaForTicket,
                    // Pass customer info for immediate ticket display
                    customerName: customerNameDisplay,
                    customerPhone: isRegisteredUser && checkoutCustomer.cedula
                        ? "Referencia: " + checkoutCustomer.cedula
                        : saleCedulaForTicket
                            ? `Cliente provisional; debe registrarse con cedula ${saleCedulaForTicket} antes de 7 dias`
                            : undefined,
                    documentType: "V", // Default or improve if data available
                    documentNumber: saleCedulaForTicket,

                    couponId: appliedCoupon?.coupon.id,
                    subtotal: cartSubtotalUsd,
                    total: totalDueUsd,
                    discount: fromUsdUnits(Math.max(0, cartSubtotalUnits - totalDueUnits)),
                    exchangeRate: roundedRate || undefined,
                    paymentMethod,
                    paymentDetails: paymentDetails.length ? paymentDetails : undefined,
                }),
            )
            setCartItems([])
            setAppliedCoupon(null)
            // setShowChargeModal(false) removed
            setChangePayments([])
            setChangeAmountInput("")
        } finally {
            setFinalizingSale(false)
        }
    }, [
        appliedCoupon,
        cartItems,
        cartSubtotalUnits,
        cartSubtotalUsd,
        checkoutCustomer.cedula,
        checkoutCustomer.email,
        checkoutCustomer.userId,
        customerNameDisplay,
        finalizingSale,
        hasCartItems,
        isRegisteredUser,
        onRegisterSale,
        redeemCouponForSale,
        roundedRate,
        saleCedulaForTicket,
        typedCustomerCedula,
        totalDueUnits,
        totalDueUsd,
        payments,
        changePayments,
        canConfirmPayment,
    ])
    useEffect(() => {
        // Auto-focus input on mount
        setTimeout(() => saleInputRef.current?.focus(), 50)
    }, [])

    // State-fresh wrapper for addCodeToCart to be used in scanner callback


    // Modified wrapper to handle loading state
    const handleScanResult = useCallback(async (text: string) => {
        setIsProcessingScan(true)
        try {
            await latestAddCodeToCart.current(text)
        } finally {
            setIsProcessingScan(false)
        }
    }, [])

    useEffect(() => {
        if (!registerScannerActive) {
            registerControlsRef.current?.stop?.()
            setIsProcessingScan(false)
            return
        }
        let canceled = false

        if (canceled) return
        if (!registerVideoRef.current) return

        const hints = new Map()
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE])

        const reader = new BrowserQRCodeReader(hints, {
            delayBetweenScanAttempts: 100, // slightly more frequent attempts
        })

        // We use a simplified flow here: scan -> pause/process -> close or resume
        reader.decodeFromConstraints(
            { video: { facingMode: "environment", width: { ideal: 720 } } }, // 720p ideal for speed/quality balance
            registerVideoRef.current,
            (result: any, _error: any) => {
                if (canceled) return
                if (result) {
                    const text = result.getText()
                    if (text) {
                        setRegisterScannerStatus("¡QR Encontrado!")
                        // Do NOT stop controls here, so video keeps running during loader
                        // Trigger processing
                        if (!isProcessingScanRef.current) {
                            void handleScanResult(text)
                        }
                    }
                }
                // Ignore errors (rendering usually continues)
            }
        ).then((controls: any) => {
            registerControlsRef.current = controls
        }).catch((err: any) => {
            if (err.name !== 'AbortError' && !canceled) {
                console.warn(err)
                setRegisterScannerStatus("Error cámara")
            }
        })

        return () => {
            canceled = true
            registerControlsRef.current?.stop?.()
        }
    }, [registerScannerActive, handleScanResult])

    // --- EFFECT: Clear scanner status after 3 seconds ---
    useEffect(() => {
        if (registerScannerStatus) {
            const timer = setTimeout(() => {
                setRegisterScannerStatus("")
            }, 3000)
            return () => clearTimeout(timer)
        }
    }, [registerScannerStatus])

    // Mobile Auto-focus on Customer Input
    useEffect(() => {
        const isMobile = window.innerWidth < 1024
        if (isMobile) {
            // Small delay to ensure render
            setTimeout(() => {
                customerInputRef.current?.focus()
            }, 100)
        } else {
            // Optional: Desktop behavior if needed, currently default is fine or focus search
            // setTimeout(() => saleInputRef.current?.focus(), 100) 
        }
    }, [])

    return (
        <>
            <div className="bg-slate-100 min-h-screen lg:min-h-full">
                <div className="w-full p-2 lg:p-6 grid lg:grid-cols-[1fr_0.7fr] gap-4 lg:gap-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto">

                    {/* --- LEFT COLUMN: Input & Interaction --- */}
                    <div className="flex flex-col gap-5">

                        {/* 1. Customer Type Selector (Toggle) */}
                        <div className="flex gap-3">
                            <div className="bg-white p-1.5 rounded-3xl shadow-sm border border-slate-100 flex relative flex-1">
                                <button
                                    onClick={() => setIsRegisteredUser(true)}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${isRegisteredUser
                                        ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
                                        : "text-slate-500 hover:bg-slate-50"
                                        }`}
                                >
                                    <User size={18} />
                                    Registrado
                                </button>
                                <button
                                    onClick={() => setIsRegisteredUser(false)}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${!isRegisteredUser
                                        ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
                                        : "text-slate-500 hover:bg-slate-50"
                                        }`}
                                >
                                    <UserX size={18} />
                                    No Registrado
                                </button>
                            </div>
                        </div>

                        {/* 2. Customer Lookup & Level Info */}
                        <div className="overflow-hidden transition-all duration-500 ease-in-out max-h-[800px] opacity-100">
                            <div className="space-y-3">
                                <form
                                    className="flex gap-2"
                                    onSubmit={(e) => {
                                        e.preventDefault()
                                        if (isRegisteredUser) onLookupCustomer(customerCedula)
                                    }}
                                >
                                    <div className="relative flex-1 group">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={16} />
                                        <input
                                            ref={customerInputRef}
                                            type="text"
                                            inputMode="numeric"
                                            className="w-full bg-[#6A3A30]/5 border border-[#6A3A30]/10 rounded-xl pl-9 pr-3 py-2.5 text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-[#6A3A30]/20 focus:border-[#6A3A30]/30 transition-all outline-none"
                                            placeholder={isRegisteredUser ? "Cedula del cliente..." : "Cedula para cliente provisional..."}
                                            value={customerCedula}
                                            onChange={(e) => setCustomerCedula(e.target.value.replace(/\D/g, ""))}
                                        />
                                    </div>
                                    {isRegisteredUser && (
                                        <button
                                            type="submit"
                                            disabled={!customerCedula.trim() || checkoutCustomer.loading}
                                            className="bg-primary-600 text-white p-2.5 rounded-xl text-sm font-bold shadow-md shadow-primary-600/10 hover:bg-primary-700 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none shrink-0"
                                        >
                                            {checkoutCustomer.loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search size={18} />}
                                        </button>
                                    )}
                                </form>

                                {!isRegisteredUser && (
                                    <div className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-start gap-2 ${typedCustomerCedula
                                        ? "bg-amber-50 text-amber-700 border-amber-100"
                                        : "bg-slate-50 text-slate-500 border-slate-100"
                                        }`}>
                                        <IdCard size={14} className="mt-0.5 shrink-0" />
                                        <span>
                                            {typedCustomerCedula
                                                ? `Se creara un cliente provisional por 7 dias con la cedula ${typedCustomerCedula}. Debe registrarse con esa misma cedula para conservar los puntos.`
                                                : "Ingresa la cedula para activar el ticket y asociar los puntos de la compra."}
                                        </span>
                                    </div>
                                )}

                                {/* Errors */}
                                {isRegisteredUser && checkoutCustomer.error && (
                                    <div className="bg-rose-50 text-rose-600 px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2 animate-in slide-in-from-top-1 border border-rose-100">
                                        <X size={14} /> {checkoutCustomer.error}
                                    </div>
                                )}

                                {checkoutError && (
                                    <div className="bg-rose-50 text-rose-600 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 animate-in slide-in-from-top-1 border border-rose-200 shadow-sm">
                                        <X size={14} className="animate-pulse" /> {checkoutError}
                                    </div>
                                )}

                                {/* Active Level Badge Card */}
                                {isRegisteredUser && activeLevelState && checkoutCustomer.levelState && (
                                    <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm animate-in zoom-in-95">
                                        <div>
                                            <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center shadow-sm shrink-0">
                                                    <User size={18} className="text-slate-600" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-slate-900 leading-tight truncate">{customerNameDisplay}</p>
                                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-800">
                                                            <Tag size={12} className="text-primary-500" />
                                                            <span className="truncate max-w-[160px]">{activeLevelState.currentLevel.name}</span>
                                                        </span>
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-medium text-slate-600">
                                                            <Mail size={12} />
                                                            <span className="truncate max-w-[160px]">{customerEmailDisplay || "Correo no disponible"}</span>
                                                        </span>
                                                        {checkoutCustomer.cedula && (
                                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700">
                                                                <IdCard size={12} />
                                                                <span>{checkoutCustomer.cedula}</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-3 border-t border-slate-100 pt-3">
                                            <button
                                                onClick={() => setShowCoupons(!showCoupons)}
                                                className="w-full flex items-center justify-between hover:bg-slate-50 p-2 rounded-xl transition-colors group"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center border border-primary-100 group-hover:bg-primary-100 transition-colors">
                                                        <Tag size={16} />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cupones Disponibles</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[11px] font-bold text-primary-600 bg-primary-50 px-2 py-1 rounded-lg border border-primary-100">
                                                        {levelCouponsAvailable.length} activos
                                                    </span>
                                                    <ChevronDown size={16} className={`text-slate-400 transition-transform duration-300 ${showCoupons ? "rotate-180" : ""}`} />
                                                </div>
                                            </button>
                                            <div className={`mt-2 space-y-2 overflow-hidden transition-all duration-300 ease-in-out ${showCoupons ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}`}>
                                                {isRegisteredUser && checkoutCustomer.userId ? (
                                                    levelCouponsAvailable.length > 0 ? (
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {levelCouponsAvailable.map((coupon) => {
                                                                const isApplied = appliedCoupon?.coupon.id === coupon.id
                                                                return (
                                                                    <div key={coupon.id} className="flex items-center justify-between bg-white border border-slate-100 rounded-lg p-2 gap-2 shadow-sm">
                                                                        <div className="min-w-0 flex-1 pr-1">
                                                                            <p className="text-xs font-bold text-slate-800 break-words leading-tight mb-0.5">{coupon.title}</p>
                                                                            <p className="text-[10px] text-slate-500 font-medium leading-tight">{formatCouponSubtitle(coupon)}</p>
                                                                        </div>
                                                                        <button
                                                                            onClick={() => handleApplyLevelCoupon(coupon)}
                                                                            disabled={isApplied}
                                                                            className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-all shrink-0 ${isApplied
                                                                                ? "bg-secondary-50 text-secondary-700 border-secondary-100"
                                                                                : "bg-primary-600 text-white border-primary-600 hover:bg-primary-700"
                                                                                }`}
                                                                        >
                                                                            {isApplied ? "Aplicado" : "Aplicar"}
                                                                        </button>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs font-semibold text-slate-500">No hay cupones de nivel aplicables.</p>
                                                    )
                                                ) : (
                                                    <p className="text-xs font-semibold text-slate-500">Asocia un cliente para ver los cupones de su nivel.</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 4. Quick Shortcuts Grid (Collapsible) + Manual Input - FIXED Layout */}
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden relative">
                            <button
                                onClick={() => setIsShortcutsOpen(!isShortcutsOpen)}
                                className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50 transition-colors relative z-10"
                            >
                                <div className="flex items-center gap-2">
                                    <LayoutGrid size={18} className="text-slate-400" />
                                    <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Productos</h4>
                                </div>
                                {isShortcutsOpen ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                            </button>

                            <div className={`transition-all duration-300 ease-in-out ${isShortcutsOpen ? "max-h-[65vh] opacity-100 overflow-y-auto custom-scrollbar" : "max-h-0 opacity-0 overflow-hidden"}`}>

                                {/* Manual Input - Discrete Style */}
                                <div className="px-4 pb-4">
                                    <div className="flex items-center gap-2 bg-[#6A3A30]/5 border border-[#6A3A30]/10 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-[#6A3A30]/20 focus-within:border-[#6A3A30]/30 transition-all">
                                        <Search className="text-slate-400" size={16} />
                                        <input
                                            ref={saleInputRef}
                                            className="flex-1 bg-transparent border-none text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:ring-0 p-0"
                                            placeholder="Buscar producto..."
                                            value={cartCode}
                                            disabled={!canUseTicket}
                                            onChange={(e) => setCartCode(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && canUseTicket && (void addCodeToCart(cartCode))}
                                        />
                                    </div>
                                </div>

                                <div className="p-3 pt-0 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                                    {quickProducts.map((p, i) => (
                                        <button
                                            key={i}
                                            onClick={() => addProductToCart(p)}
                                            disabled={!canUseTicket}
                                            className="bg-slate-50 p-0 rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-200 hover:shadow-md hover:-translate-y-0.5 transition-all text-left flex flex-col group overflow-hidden disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
                                        >
                                            <div className="flex flex-col h-full bg-white">
                                                {/* Image Area - Much larger on mobile */}
                                                <div className="relative w-full aspect-[4/3] sm:aspect-square overflow-hidden bg-slate-100">
                                                    {p.imageUrl ? (
                                                        <img src={p.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                            <ShoppingBag size={32} />
                                                        </div>
                                                    )}
                                                    {/* Price Tag Overlay on Image */}
                                                    <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end">
                                                        <span className="bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-[10px] sm:text-xs font-bold text-slate-900 shadow-sm border border-slate-100/50">
                                                            {formatCurrency(p.price)}
                                                        </span>
                                                        <div className="bg-primary-600 text-white p-1.5 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Plus size={12} />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Content Area */}
                                                <div className="p-3 flex flex-col justify-between flex-1 gap-1">
                                                    <span className="font-bold text-slate-800 text-xs sm:text-sm leading-tight line-clamp-2">{p.name}</span>

                                                    {/* Only show points if relevant/available space */}
                                                    {(p.points ?? 0) > 0 && (
                                                        <span className="text-[10px] font-medium text-secondary-600">+{p.points} pts</span>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                    {quickProducts.length === 0 && (
                                        <p className="text-slate-400 text-sm italic col-span-2 sm:col-span-3 lg:col-span-4">
                                            {cartCode.trim() ? "No se encontraron productos." : "Catalogo vacio."}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* --- RIGHT COLUMN: Cart & Checkout --- */}
                    <div className="lg:h-full">
                        <div className="flex flex-col gap-5 lg:sticky lg:top-[90px] lg:h-[calc(100vh-110px)] z-20">
                            {!canUseTicket && (
                                <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 min-h-[420px] flex flex-col items-center justify-center text-center px-6">
                                    <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mb-4">
                                        <IdCard size={30} />
                                    </div>
                                    <h3 className="font-black text-slate-900 text-2xl leading-tight">Ticket bloqueado</h3>
                                    <p className="mt-2 text-sm font-semibold text-slate-500 max-w-xs">
                                        Ingresa la cedula del cliente no registrado para crear el cliente provisional y activar el ticket.
                                    </p>
                                    <p className="mt-3 text-xs font-bold text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 max-w-sm">
                                        El cliente tiene 7 dias para registrarse con esa misma cedula y conservar los puntos.
                                    </p>
                                </div>
                            )}

                            {/* Cart Container */}
                            <div className={`bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 ${canUseTicket ? "flex flex-col" : "hidden"} min-h-[600px] h-auto lg:h-full relative overflow-hidden`}>

                                {/* Cart Header */}
                                <div className="px-6 py-5 border-b border-slate-50 flex flex-col gap-4 bg-white z-10 shrink-0">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                        <div className="flex-1">
                                            <h3 className="font-black text-slate-900 text-3xl tracking-tight leading-none">Ticket</h3>
                                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                                <p className="text-sm text-slate-400 font-medium whitespace-nowrap">{totalUnits} ítems en la orden</p>
                                                <span className="hidden sm:inline h-4 w-[1px] bg-slate-200"></span>
                                                <p className="text-[10px] font-bold text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded-md border border-primary-100 flex items-center gap-1 whitespace-nowrap">
                                                    <DollarSign size={10} />
                                                    {roundedRate ? roundedRate.toFixed(2) : "--"} Bs/USD
                                                </p>
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 p-1.5 rounded-xl flex gap-1 border border-slate-100 w-full sm:w-auto mt-2 sm:mt-0">
                                            <button
                                                onClick={() => setViewCurrency('VES')}
                                                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewCurrency === 'VES'
                                                    ? 'bg-primary-600 text-white shadow-sm'
                                                    : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
                                                    }`}
                                            >
                                                Bs
                                            </button>
                                            <button
                                                onClick={() => setViewCurrency('USD')}
                                                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewCurrency === 'USD'
                                                    ? 'bg-primary-600 text-white shadow-sm'
                                                    : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
                                                    }`}
                                            >
                                                $
                                            </button>
                                        </div>
                                    </div>
                                    {hasCartItems && (
                                        <button onClick={() => setCartItems([])} className="text-rose-500 hover:bg-rose-50 px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 h-10 border border-transparent hover:border-rose-100">
                                            <Trash2 size={14} /> Limpiar
                                        </button>
                                    )}
                                </div>

                                {finalizingSale && !showPaymentModal && (
                                    <div className="px-6 pb-2">
                                        <div className="flex items-center gap-3 rounded-2xl bg-slate-900 text-white px-4 py-3 shadow-sm">
                                            <Loader size={18} className="animate-spin" />
                                            <span className="text-sm font-semibold tracking-wide">Confirmando ticket...</span>
                                        </div>
                                    </div>
                                )}


                                {/* Scanner Location */}
                                <div className="px-6 pb-2">
                                    <div className="rounded-2xl border border-slate-100 overflow-hidden bg-slate-50">
                                        <button
                                            onClick={() => setRegisterScannerActive(!registerScannerActive)}
                                            className="w-full py-2.5 px-4 text-slate-600 font-bold text-xs flex items-center justify-between hover:bg-slate-100 transition-colors"
                                        >
                                            <span className="flex items-center gap-2"><Camera size={14} /> {registerScannerActive ? "Cerrar Escáner" : "Abrir Escáner QR"}</span>
                                            {registerScannerActive ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                        </button>

                                        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${registerScannerActive ? "max-h-64" : "max-h-0"}`}>
                                            <div className="bg-black relative aspect-video">
                                                {registerScannerActive && (
                                                    <>
                                                        <video
                                                            ref={registerVideoRef}
                                                            className="w-full h-full object-cover"
                                                            muted
                                                            playsInline
                                                        />
                                                        {/* Scan Overlay */}
                                                        <div className="absolute inset-0 border-[30px] border-slate-900/50 pointer-events-none">
                                                            <div className="w-full h-full border-2 border-white/50 relative">
                                                                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-secondary-500 -mt-1 -ml-1" />
                                                                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-secondary-500 -mt-1 -mr-1" />
                                                                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-secondary-500 -mb-1 -ml-1" />
                                                                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-secondary-500 -mb-1 -mr-1" />
                                                            </div>
                                                        </div>

                                                        {/* Processing Overlay */}
                                                        {isProcessingScan && (
                                                            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center z-20 animate-in fade-in duration-200">
                                                                <Loader size={48} className="text-secondary-500 animate-spin mb-4" />
                                                                <span className="text-white font-bold text-lg tracking-wide">Procesando...</span>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                                {registerScannerStatus && (
                                                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur text-white text-[10px] px-3 py-1 rounded-full font-medium">
                                                        {registerScannerStatus}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>


                                {/* Scrollable Items List */}
                                <div className="flex-1 overflow-y-auto p-4 pt-0 space-y-3 custom-scrollbar">
                                    {!hasCartItems ? (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-60 min-h-[200px]">
                                            <ShoppingBag size={64} strokeWidth={1} className="mb-4" />
                                            <p className="font-medium text-lg">Carrito vacio</p>
                                            <p className="text-sm">Escanea o agrega productos</p>
                                        </div>
                                    ) : (
                                        cartItems.map((item, index) => {
                                            const qty = Number(item.quantity ?? 1) || 1
                                            const lineTotal = Number((Number(item.price ?? 0) * qty).toFixed(2))
                                            const coveredUnits = Math.max(0, Math.min(qty, Number(couponCoverage[index] ?? 0) || 0))
                                            const eligibleUnits = Math.max(0, qty - coveredUnits)
                                            const linePoints = Number(item.points ?? 0) * eligibleUnits
                                            return (
                                                <div key={item.key} className="group flex justify-between items-center p-2 bg-slate-50 hover:bg-white border border-transparent hover:border-slate-100 hover:shadow-sm rounded-xl transition-all duration-200">
                                                    <div className="flex-1 min-w-0 pr-3">
                                                        <div className="flex justify-between items-start">
                                                            <p className="font-bold text-slate-800 text-xs leading-snug truncate">{item.name}</p>
                                                            <span className="font-bold text-slate-900 text-xs">{formatCurrency(lineTotal)}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between mt-0.5">
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex items-center bg-slate-200/50 rounded-lg p-0.5 border border-slate-200/50">
                                                                    <button
                                                                        onClick={() => updateCartItemQuantity(item.key, -1)}
                                                                        disabled={qty <= 1}
                                                                        className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-white text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                                                                    >
                                                                        <Minus size={10} />
                                                                    </button>
                                                                    <span className="text-[10px] font-bold text-slate-700 w-6 text-center">{qty}</span>
                                                                    <button
                                                                        onClick={() => updateCartItemQuantity(item.key, 1)}
                                                                        className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-white text-slate-500 transition-all"
                                                                    >
                                                                        <Plus size={10} />
                                                                    </button>
                                                                </div>
                                                                {qty > 1 && <span className="text-[10px] text-slate-400 font-medium">({formatCurrency(Number(item.price ?? 0))} c/u)</span>}
                                                                {linePoints > 0 && <span className="text-[9px] font-bold text-secondary-600">+{linePoints} pts</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => setCartItems((c) => c.filter((x) => x.key !== item.key))}
                                                        className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:bg-rose-100 hover:text-rose-500 transition-all shrink-0 ml-1"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                                {/* Footer: Summaries & Actions */}
                                <div className="bg-white border-t border-slate-100 p-5 space-y-4 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)]">



                                    {/* Total Info */}
                                    <div className="space-y-3">
                                        {appliedCoupon && (
                                            <div className="flex items-center justify-between text-xs font-semibold bg-primary-50 border border-primary-100 px-3 py-2 rounded-lg">
                                                <div className="flex flex-col gap-1 text-primary-700 min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <Tag size={12} className="shrink-0" />
                                                        <span className="font-bold break-words leading-tight">{appliedCoupon.coupon.title}</span>
                                                    </div>
                                                    <span className="text-primary-500 text-[10px] pl-5">{formatCouponSubtitle(appliedCoupon.coupon)}</span>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        setAppliedCoupon(null)

                                                    }}
                                                    className="ml-2 text-[10px] text-primary-600 hover:text-primary-800 px-2 py-1 bg-white rounded border border-primary-100 shadow-sm shrink-0"
                                                >
                                                    Quitar
                                                </button>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-sm text-slate-500">
                                            <span>Subtotal</span>
                                            <span className="font-mono">{formatCurrency(cartTotals.revenue)}</span>
                                        </div>
                                        {levelDiscounts.apply && levelDiscounts.totalDiscount > 0 && (
                                            <div className="flex justify-between text-sm font-bold text-emerald-600 bg-emerald-50 p-2 rounded-lg">
                                                <span>Ahorro por Nivel</span>
                                                <span>-{formatCurrency(levelDiscounts.totalDiscount)}</span>
                                            </div>
                                        )}
                                        {couponDiscount > 0 && (
                                            <div className="flex justify-between text-sm font-bold text-primary-600 bg-primary-50 p-2 rounded-lg">
                                                <span>Descuento cupon</span>
                                                <span>-{formatCurrency(couponDiscount)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between items-center pt-1 text-sm font-semibold text-slate-600">
                                            <span>Total puntos</span>
                                            <span className={`${pointsBlockedByCoupon ? 'line-through text-slate-400' : 'font-black text-slate-900'}`}>
                                                {cartTotals.points} pts
                                            </span>
                                        </div>
                                        {pointsBlockedByCoupon && (
                                            <div className="text-[10px] text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100 font-medium">
                                                Productos cubiertos por el cupón no generan puntos{blockedItemsCount ? ` (${blockedItemsCount})` : ""}.
                                            </div>
                                        )}
                                        {pointsBlockedByCoupon && (
                                            <div className="text-right font-black text-slate-900 text-sm">
                                                = {effectiveTotalPoints} pts
                                            </div>
                                        )}

                                        <div className="flex justify-between items-end pt-2">
                                            <span className="text-slate-900 font-bold text-lg">Total</span>
                                            <span className="text-slate-900 font-black text-3xl tracking-tight">{formatCurrency(totalDueUsd)}</span>
                                        </div>
                                    </div>
                                    {/* Main CTA */}
                                    <button
                                        onClick={() => {
                                            if (!hasCartItems) return

                                            // VALIDATION: Block if Registered but no user selected
                                            if (isRegisteredUser && !checkoutCustomer.userId) {
                                                setCheckoutError("Asocia un cliente para procesar la venta")
                                                saleInputRef.current?.focus()
                                                return
                                            }
                                            if (!isRegisteredUser && !typedCustomerCedula) {
                                                setCheckoutError("Ingresa la cedula para crear el cliente provisional")
                                                customerInputRef.current?.focus()
                                                return
                                            }

                                            // Direct to Payment Methods
                                            setPaymentAmountInput(toPaymentInputValue(totalDueUsd, viewCurrency, totalDueVesCents))
                                            // Default tab based on current view
                                            setPaymentTab(viewCurrency)
                                            setPayments([]) // Reset on open
                                            setChangePayments([])
                                            setChangeAmountInput("")
                                            setChangeTab(viewCurrency)
                                            setShowPaymentModal(true)
                                        }} disabled={!hasCartItems || !canUseTicket}
                                        className="w-full bg-primary-600 text-white font-bold text-lg py-4 rounded-2xl shadow-xl shadow-primary-600/20 hover:bg-primary-700 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 disabled:shadow-none flex items-center justify-center gap-3"
                                    >
                                        <span>Cobrar</span>
                                        <span className="bg-white/20 text-white text-xs px-2 py-1 rounded font-mono">{totalUnits}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>


            {showPaymentModal && (
                <div className="fixed inset-0 z-[130] bg-slate-950/70 backdrop-blur-md flex items-end md:items-center justify-center md:p-4 animate-in fade-in duration-200">
                    {/* Main Card Container - Fixed Layout */}
                    <div className={`bg-white w-full ${showChangePanel ? 'max-w-6xl' : 'max-w-5xl'} overflow-hidden md:rounded-3xl shadow-2xl flex flex-col h-full md:h-[85vh] animate-in slide-in-from-bottom border-t md:border-none border-slate-200`}>

                        {/* MOBILE HEADER: Fixed Total */}
                        <div className="md:hidden bg-white border-b border-slate-100 p-3 px-4 flex justify-between items-center shrink-0 z-30">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Total a Pagar</p>
                                <div className="text-xl font-black text-slate-900 leading-none">
                                    {formatCurrency(totalDueUsd)}
                                </div>
                            </div>
                        </div>

                        {/* MIDDLE CONTENT: Scrollable Columns */}
                        <div className="flex-1 overflow-hidden flex flex-col md:flex-row relative">

                            {/* LEFT COLUMN: Input & Methods */}
                            <div className="w-full md:flex-1 flex flex-col bg-slate-50 border-r border-slate-100 h-full overflow-hidden">
                                <div className="p-4 md:p-8 flex flex-col h-full overflow-y-auto custom-scrollbar">
                                    <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                                        <div className="bg-primary-100 p-2 rounded-xl text-primary-600">
                                            <CreditCard size={20} />
                                        </div>
                                        Procesar Pago
                                    </h3>

                                    {/* Currency Toggles & Input */}
                                    <div className="space-y-6">
                                        <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-2 gap-2">
                                            {[
                                                { id: 'VES', label: 'Bolívares', symbol: 'Bs', icon: Banknote },
                                                { id: 'USD', label: 'Dólares', symbol: '$', icon: DollarSign },
                                            ].map((opt) => {
                                                const isActive = (showChangePanel ? changeTab : paymentTab) === opt.id
                                                return (
                                                    <button
                                                        key={opt.id}
                                                        onClick={() => {
                                                            if (showChangePanel) {
                                                                setChangeTab(opt.id as 'VES' | 'USD')
                                                                const target = opt.id as 'VES' | 'USD'
                                                                const remainingVesForTab = rateCents && target === 'VES'
                                                                    ? Math.max(0, changeRemainingVesCents)
                                                                    : rateCents
                                                                        ? convertUsdCentsToVesCents(Math.max(0, changeRemainingUsdUnits))
                                                                        : 0
                                                                const remainingUsdUnits = target === 'VES' && rateCents
                                                                    ? convertVesCentsToUsdUnits(remainingVesForTab)
                                                                    : Math.max(0, changeRemainingUsdUnits)
                                                                setChangeAmountInput(
                                                                    toPaymentInputValue(
                                                                        fromUsdUnits(remainingUsdUnits),
                                                                        target,
                                                                        remainingVesForTab,
                                                                    ),
                                                                )
                                                            } else {
                                                                setPaymentTab(opt.id as 'VES' | 'USD')
                                                                const { remainingUsdUnits, remainingVesCents } = getRemainingAfterPayments(payments)
                                                                setPaymentAmountInput(
                                                                    toPaymentInputValue(
                                                                        fromUsdUnits(Math.max(0, remainingUsdUnits)),
                                                                        opt.id as 'VES' | 'USD',
                                                                        Math.max(0, remainingVesCents),
                                                                    ),
                                                                )
                                                            }
                                                        }}
                                                        className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all duration-200 ${isActive
                                                            ? 'bg-slate-900 text-white shadow-md'
                                                            : 'text-slate-500 hover:bg-slate-100'
                                                            }`}
                                                    >
                                                        <opt.icon size={18} />
                                                        <span>{opt.label}</span>
                                                    </button>
                                                )
                                            })}
                                        </div>

                                        <div className="relative group">
                                            <div className="flex justify-between items-center mb-2 px-1">
                                                <span className={`text-xs font-bold uppercase tracking-wider ${(showChangePanel ? changeTab : paymentTab) === 'VES' ? 'text-emerald-500' : 'text-primary-500'}`}>
                                                    Monto a {(showChangePanel ? 'Devolver' : 'Pagar')}
                                                </span>
                                            </div>
                                            <div className="relative">
                                                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-400">
                                                    {(showChangePanel ? changeTab : paymentTab) === 'VES' ? 'Bs' : '$'}
                                                </span>
                                                <input
                                                    type="number"
                                                    value={showChangePanel ? changeAmountInput : paymentAmountInput}
                                                    onChange={(e) => showChangePanel ? setChangeAmountInput(e.target.value) : setPaymentAmountInput(e.target.value)}
                                                    placeholder="0.00"
                                                    className={`w-full pl-20 pr-6 py-5 rounded-3xl bg-[#6A3A30]/5 border-2 text-slate-900 outline-none transition-all font-black text-3xl md:text-4xl shadow-sm ${(showChangePanel ? changeTab : paymentTab) === 'VES'
                                                        ? 'border-emerald-100 focus:border-emerald-500 focus:shadow-emerald-500/10'
                                                        : 'border-[#6A3A30]/10 focus:border-[#6A3A30]/30 focus:shadow-[#6A3A30]/10'
                                                        }`}
                                                />
                                            </div>
                                        </div>

                                        {/* Mobile Progress Bar */}
                                        <div className="md:hidden">
                                            {(() => {
                                                const hasRemaining =
                                                    (paymentRequiresUsdSettlement && remainingUsdUnits > 0) ||
                                                    (paymentRequiresVesSettlement && remainingVesCents > 0)
                                                const paymentDisplayTab = paymentTab === 'VES' && rateCents && paymentRequiresVesSettlement && remainingVesCents > 0
                                                    ? 'VES'
                                                    : paymentTab === 'USD' && paymentRequiresUsdSettlement && remainingUsdUnits > 0
                                                        ? 'USD'
                                                        : rateCents && paymentRequiresVesSettlement && remainingVesCents > 0
                                                            ? 'VES'
                                                            : 'USD'
                                                const hasChangeRemainder =
                                                    (changeRequiresUsdSettlement && changeRemainingUsdUnits !== 0) ||
                                                    (changeRequiresVesSettlement && changeRemainingVesCents !== 0)
                                                const changeDisplayTab = changeTab === 'VES' && rateCents && changeRequiresVesSettlement && changeRemainingVesCents !== 0
                                                    ? 'VES'
                                                    : changeTab === 'USD' && changeRequiresUsdSettlement && changeRemainingUsdUnits !== 0
                                                        ? 'USD'
                                                        : rateCents && changeRequiresVesSettlement && changeRemainingVesCents !== 0
                                                            ? 'VES'
                                                            : 'USD'
                                                const isChangeOver = changeDisplayTab === 'VES' && rateCents ? changeRemainingVesCents < 0 : changeRemainingUsdUnits < 0

                                                const remainingUsdDisplay = paymentDisplayTab === 'VES' && rateCents
                                                    ? fromUsdUnits(convertVesCentsToUsdUnits(Math.abs(remainingVesCents)))
                                                    : fromUsdUnits(Math.abs(remainingUsdUnits))
                                                const changeRemainingUsdDisplay = changeDisplayTab === 'VES' && rateCents
                                                    ? fromUsdUnits(convertVesCentsToUsdUnits(Math.abs(changeRemainingVesCents)))
                                                    : fromUsdUnits(Math.abs(changeRemainingUsdUnits))
                                                const remainingVesDisplay = paymentDisplayTab === 'VES' && rateCents
                                                    ? Math.max(0, remainingVesCents)
                                                    : rateCents
                                                        ? convertUsdCentsToVesCents(Math.max(0, remainingUsdUnits))
                                                        : 0
                                                const changeVesDisplay = changeDisplayTab === 'VES' && rateCents
                                                    ? Math.abs(changeRemainingVesCents)
                                                    : rateCents
                                                        ? convertUsdCentsToVesCents(Math.abs(changeRemainingUsdUnits))
                                                        : 0

                                                if (hasRemaining) {
                                                    return (
                                                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                                            <div className="flex justify-between items-end mb-2">
                                                                <span className="text-xs font-bold text-slate-500">Falta por Pagar</span>
                                                                <span className="text-xl font-black text-primary-600">
                                                                    {formatTabAmount(paymentDisplayTab, remainingUsdDisplay, remainingVesDisplay)}
                                                                </span>
                                                            </div>
                                                            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                                                <div className="h-full bg-primary-500 transition-all duration-500 ease-out" style={{ width: `${totalDueUnits > 0 ? Math.min(100, (totalPaidUnits / totalDueUnits) * 100) : 0}%` }} />
                                                            </div>
                                                        </div>
                                                    )
                                                }
                                                if (hasChangeRemainder && !isChangeSettled) {
                                                    return (
                                                        <div className={`p-4 rounded-xl border ${isChangeOver ? 'bg-rose-50 border-rose-100' : 'bg-amber-50 border-amber-100'}`}>
                                                            <div className="flex justify-between items-center">
                                                                <span className={`text-xs font-bold uppercase ${isChangeOver ? 'text-rose-600' : 'text-amber-600'}`}>
                                                                    {isChangeOver ? 'Exceso' : 'Vuelto'}
                                                                </span>
                                                                <span className={`text-xl font-black ${isChangeOver ? 'text-rose-700' : 'text-amber-700'}`}>
                                                                    {formatTabAmount(changeDisplayTab, changeRemainingUsdDisplay, changeVesDisplay)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )
                                                }
                                                return null
                                            })()}
                                        </div>

                                        {/* Method Grid */}
                                        <div>
                                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 pl-1">
                                                Seleccionar Método
                                            </h4>
                                            <div className="grid grid-cols-3 lg:grid-cols-3 gap-2 md:gap-3">
                                                {[
                                                    { id: 'pago_movil', label: 'Pago Móvil', icon: Smartphone, isUsd: false, color: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-200', hover: 'hover:border-cyan-400 hover:bg-cyan-100 hover:shadow-cyan-100' },
                                                    { id: 'efectivo_bs', label: 'Efectivo Bs', icon: Banknote, isUsd: false, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', hover: 'hover:border-emerald-400 hover:bg-emerald-100 hover:shadow-emerald-100' },
                                                    { id: 'punto', label: 'Punto', icon: CreditCard, isUsd: false, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', hover: 'hover:border-blue-400 hover:bg-blue-100 hover:shadow-blue-100' },
                                                    { id: 'transferencia', label: 'Transferencia', icon: ArrowRightLeft, isUsd: false, color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200', hover: 'hover:border-indigo-400 hover:bg-indigo-100 hover:shadow-indigo-100' },
                                                    { id: 'otro', label: 'Otro', icon: Tag, isUsd: false, color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200', hover: 'hover:border-slate-400 hover:bg-slate-100 hover:shadow-slate-100' },
                                                    { id: 'efectivo_usd', label: 'Efectivo $', icon: DollarSign, isUsd: true, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', hover: 'hover:border-emerald-400 hover:bg-emerald-100 hover:shadow-emerald-100' },
                                                    { id: 'zelle', label: 'Zelle', icon: Wallet, isUsd: true, color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', hover: 'hover:border-purple-400 hover:bg-purple-100 hover:shadow-purple-100' },
                                                ]
                                                    .filter(m => {
                                                        const currentTab = showChangePanel ? changeTab : paymentTab
                                                        if (currentTab === 'USD') return m.isUsd
                                                        return !m.isUsd
                                                    })
                                                    .map((m) => (
                                                        <button
                                                            key={m.id}
                                                            onClick={() => {
                                                                const isChange = showChangePanel
                                                                let rawVal = parseFloat(isChange ? changeAmountInput : paymentAmountInput)
                                                                if (isChange && (!rawVal || rawVal <= 0)) {
                                                                    const remainingVes = changeTab === 'VES' && rateCents
                                                                        ? Math.max(0, changeRemainingVesCents)
                                                                        : rateCents
                                                                            ? convertUsdCentsToVesCents(Math.max(0, changeRemainingUsdUnits))
                                                                            : 0
                                                                    const remainingUnits = changeTab === 'VES' && rateCents
                                                                        ? convertVesCentsToUsdUnits(remainingVes)
                                                                        : Math.max(0, changeRemainingUsdUnits)
                                                                    rawVal = changeTab === 'USD'
                                                                        ? fromUsdUnits(remainingUnits)
                                                                        : remainingVes / 100
                                                                }
                                                                if (!rawVal || rawVal <= 0) return
                                                                const normalizedAmount = roundUsd(rawVal)
                                                                if (normalizedAmount <= 0) return

                                                                if (isChange) {
                                                                    // Validation for Change
                                                                    const remainingChangeVesCents = rateCents ? Math.max(0, changeDueVesCents - getTotalPaidVesCents(changePayments)) : 0
                                                                    const remainingChangeUsdUnits = Math.max(0, changeDueUsdUnits - getTotalPaidUnits(changePayments))
                                                                    const remainingChangeForTab = changeTab === 'VES' && rateCents && changeDueVesCents > 0
                                                                        ? remainingChangeVesCents
                                                                        : remainingChangeUsdUnits
                                                                    if (remainingChangeForTab <= 0) return

                                                                    const newChange = { id: Math.random().toString(36).substring(7), method: m.id, amount: normalizedAmount }
                                                                    setChangePayments(prev => [...prev, newChange])

                                                                    // Update input
                                                                    const remainUnits = Math.max(0, changeDueUsdUnits - getTotalPaidUnits([...changePayments, newChange]))
                                                                    const remainVes = rateCents ? Math.max(0, changeDueVesCents - getTotalPaidVesCents([...changePayments, newChange])) : 0
                                                                    const inputUnits = changeTab === 'VES' && rateCents ? convertVesCentsToUsdUnits(remainVes) : remainUnits
                                                                    const inputVes = changeTab === 'VES' && rateCents
                                                                        ? remainVes
                                                                        : rateCents
                                                                            ? convertUsdCentsToVesCents(remainUnits)
                                                                            : 0
                                                                    setChangeAmountInput(toPaymentInputValue(fromUsdUnits(inputUnits), changeTab, inputVes))
                                                                } else {
                                                                    // Logic for Payment
                                                                    const newPayment = { id: Math.random().toString(36).substring(7), method: m.id, amount: normalizedAmount }
                                                                    setPayments(prev => [...prev, newPayment])

                                                                    // Update input
                                                                    const { remainingUsdUnits, remainingVesCents } = getRemainingAfterPayments([...payments, newPayment])
                                                                    setPaymentAmountInput(toPaymentInputValue(fromUsdUnits(Math.max(0, remainingUsdUnits)), paymentTab, Math.max(0, remainingVesCents)))
                                                                }
                                                            }}
                                                            className={`flex flex-col items-center justify-center p-2 md:p-4 rounded-xl md:rounded-2xl border-2 transition-all duration-200 active:scale-95 group ${m.bg} ${m.border} ${m.hover}`}
                                                        >
                                                            <div className={`p-1.5 md:p-2.5 rounded-full bg-white shadow-sm mb-1.5 md:mb-2 ${m.color} group-hover:scale-110 transition-transform`}>
                                                                <m.icon size={16} className="md:w-5 md:h-5" />
                                                            </div>
                                                            <span className={`text-[10px] md:text-xs font-bold text-center leading-tight ${m.color}`}>{m.label}</span>
                                                        </button>
                                                    ))
                                                }
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons removed for Mobile since we have fixed footer */}
                                </div>
                                {/* Mobile Payments List (Optional to show here or in desktop col only? User asked for list improvements) */}
                                <div className="p-4 md:hidden border-t-4 border-slate-100 max-h-[300px] overflow-y-auto custom-scrollbar">
                                    {/* Payments List Mobile Copy or Unified? 
                                            The user wants "pagos recibidos" to have max height. 
                                            Currently "pagos recibidos" is in the Right Column (hidden on mobile).
                                            We need to show it on mobile too.
                                         */}
                                    {payments.length > 0 && (
                                        <div className="space-y-3">
                                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Pagos Recibidos</h4>
                                            {payments.map(p => (
                                                <div key={p.id} className="flex justify-between items-center p-3 rounded-xl bg-emerald-50 border border-emerald-100 shadow-sm">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-8 w-8 rounded-lg bg-white border border-emerald-100 flex items-center justify-center text-emerald-600 font-bold shadow-sm">
                                                            $
                                                        </div>
                                                        <div>
                                                            <div className="text-xs font-bold text-emerald-900 uppercase">{p.method.replace('_', ' ')}</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-bold text-emerald-900 text-sm">{formatMethodAmount(p.method, p.amount)}</span>
                                                        <button
                                                            onClick={() => {
                                                                setPayments(prev => prev.filter(x => x.id !== p.id))
                                                                setPaymentAmountInput(prev => {
                                                                    const currentVal = parseFloat(prev) || 0
                                                                    const addedVal = getAmountForTab(p, paymentTab)
                                                                    const nextVal = currentVal + addedVal
                                                                    return nextVal > 0 ? nextVal.toFixed(2) : ""
                                                                })
                                                            }}
                                                            className="text-rose-500 p-1"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Change List Mobile */}
                                    {changePayments.length > 0 && (
                                        <div className="space-y-3 pt-3">
                                            <h4 className="text-xs font-bold text-amber-500 uppercase tracking-widest pl-1">Vuelto Entregado</h4>
                                            {changePayments.map(p => (
                                                <div key={p.id} className="flex justify-between items-center p-3 rounded-xl bg-amber-50 border border-amber-100 shadow-sm">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-8 w-8 rounded-lg bg-white border border-amber-100 flex items-center justify-center text-amber-600 font-bold shadow-sm">
                                                            <ArrowRightLeft size={16} />
                                                        </div>
                                                        <div>
                                                            <div className="text-xs font-bold text-amber-900 uppercase">{p.method.replace('_', ' ')}</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-bold text-amber-900 text-sm">{formatMethodAmount(p.method, p.amount)}</span>
                                                        <button
                                                            onClick={() => {
                                                                setChangePayments(prev => prev.filter(x => x.id !== p.id))
                                                                setChangeAmountInput(prev => {
                                                                    const currentVal = parseFloat(prev) || 0
                                                                    const addedVal = getAmountForTab(p, changeTab)
                                                                    const nextVal = currentVal + addedVal
                                                                    return nextVal > 0 ? nextVal.toFixed(2) : ""
                                                                })
                                                            }}
                                                            className="text-emerald-400 p-1"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* RIGHT COLUMN: Summary & List */}
                            <div className="w-full md:w-[480px] h-auto md:h-full flex flex-col bg-slate-50 relative z-10 border-l border-slate-200 order-last shrink-0 overflow-y-auto md:overflow-hidden">

                                {/* Header / Summary Area - Hidden on Mobile since we have Fixed Header */}
                                <div className="hidden md:block p-6 md:p-8 border-b border-slate-200 bg-white shadow-sm z-20">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1">Total a Pagar</p>
                                            <div className="text-4xl font-black text-slate-900 tracking-tight flex items-baseline gap-1">
                                                {formatCurrency(totalDueUsd)}
                                            </div>
                                        </div>
                                        <button onClick={() => setShowPaymentModal(false)} className="p-2 -mr-2 text-slate-300 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors">
                                            <X size={24} />
                                        </button>
                                    </div>

                                    {/* Progress Card */}
                                    {(() => {
                                        const hasRemaining =
                                            (paymentRequiresUsdSettlement && remainingUsdUnits > 0) ||
                                            (paymentRequiresVesSettlement && remainingVesCents > 0)
                                        const paymentDisplayTab = paymentTab === 'VES' && rateCents && paymentRequiresVesSettlement && remainingVesCents > 0
                                            ? 'VES'
                                            : paymentTab === 'USD' && paymentRequiresUsdSettlement && remainingUsdUnits > 0
                                                ? 'USD'
                                                : rateCents && paymentRequiresVesSettlement && remainingVesCents > 0
                                                    ? 'VES'
                                                    : 'USD'
                                        const hasChangeRemainder =
                                            (changeRequiresUsdSettlement && changeRemainingUsdUnits !== 0) ||
                                            (changeRequiresVesSettlement && changeRemainingVesCents !== 0)
                                        const changeDisplayTab = changeTab === 'VES' && rateCents && changeRequiresVesSettlement && changeRemainingVesCents !== 0
                                            ? 'VES'
                                            : changeTab === 'USD' && changeRequiresUsdSettlement && changeRemainingUsdUnits !== 0
                                                ? 'USD'
                                                : rateCents && changeRequiresVesSettlement && changeRemainingVesCents !== 0
                                                    ? 'VES'
                                                    : 'USD'
                                        const isChangeOver = changeDisplayTab === 'VES' && rateCents ? changeRemainingVesCents < 0 : changeRemainingUsdUnits < 0

                                        // Display Values
                                        const remainingUsdDisplay = paymentDisplayTab === 'VES' && rateCents
                                            ? fromUsdUnits(convertVesCentsToUsdUnits(Math.abs(remainingVesCents)))
                                            : fromUsdUnits(Math.abs(remainingUsdUnits))
                                        const changeRemainingUsdDisplay = changeDisplayTab === 'VES' && rateCents
                                            ? fromUsdUnits(convertVesCentsToUsdUnits(Math.abs(changeRemainingVesCents)))
                                            : fromUsdUnits(Math.abs(changeRemainingUsdUnits))
                                        const remainingVesDisplay = paymentDisplayTab === 'VES' && rateCents
                                            ? Math.max(0, remainingVesCents)
                                            : rateCents
                                                ? convertUsdCentsToVesCents(Math.max(0, remainingUsdUnits))
                                                : 0
                                        const changeVesDisplay = changeDisplayTab === 'VES' && rateCents
                                            ? Math.abs(changeRemainingVesCents)
                                            : rateCents
                                                ? convertUsdCentsToVesCents(Math.abs(changeRemainingUsdUnits))
                                                : 0

                                        if (hasRemaining) {
                                            return (
                                                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
                                                    <div className="flex justify-between items-end mb-3">
                                                        <span className="text-sm font-bold text-slate-500">Falta por Pagar</span>
                                                        <span className="text-2xl font-black text-primary-600">
                                                            {formatTabAmount(paymentDisplayTab, remainingUsdDisplay, remainingVesDisplay)}
                                                        </span>
                                                    </div>
                                                    <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                                                        <div className="h-full bg-primary-500 transition-all duration-500 ease-out" style={{ width: `${totalDueUnits > 0 ? Math.min(100, (totalPaidUnits / totalDueUnits) * 100) : 0}%` }} />
                                                    </div>
                                                </div>
                                            )
                                        }

                                        if (hasChangeRemainder && !isChangeSettled) {
                                            return (
                                                <div className={`p-5 rounded-2xl border-2 ${isChangeOver ? 'bg-rose-50 border-rose-100' : 'bg-amber-50 border-amber-100'}`}>
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className={`text-sm font-bold uppercase tracking-wider ${isChangeOver ? 'text-rose-600' : 'text-amber-600'}`}>
                                                            {isChangeOver ? 'Exceso de Vuelto' : 'Vuelto a Entregar'}
                                                        </span>
                                                        <div className={`p-1.5 rounded-full ${isChangeOver ? 'bg-rose-200/50 text-rose-700' : 'bg-amber-200/50 text-amber-700'}`}>
                                                            <ArrowRightLeft size={16} />
                                                        </div>
                                                    </div>
                                                    <div className={`text-3xl font-black ${isChangeOver ? 'text-rose-700' : 'text-amber-700'}`}>
                                                        {formatTabAmount(changeDisplayTab, changeRemainingUsdDisplay, changeVesDisplay)}
                                                    </div>
                                                </div>
                                            )
                                        }

                                        return (
                                            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                                    <CheckCircle2 size={24} />
                                                </div>
                                                <div>
                                                    <div className="text-lg font-black text-emerald-800">¡Pago Completo!</div>
                                                    <div className="text-sm font-medium text-emerald-600" />
                                                </div>
                                            </div>
                                        )
                                    })()}

                                </div>

                                {/* List Section - Hidden on Mobile to avoid duplication */}
                                <div className="hidden md:block flex-1 overflow-y-auto p-6 md:p-8 space-y-6 max-h-[400px] custom-scrollbar">
                                    {/* Payments List */}
                                    {payments.length > 0 && (
                                        <div className="space-y-3">
                                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Pagos Recibidos</h4>
                                            {payments.map(p => (
                                                <div key={p.id} className="flex justify-between items-center p-3 rounded-2xl bg-emerald-50 border border-emerald-100 shadow-sm hover:border-emerald-300 transition-colors group">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 rounded-xl bg-white border border-emerald-100 flex items-center justify-center text-emerald-600 font-bold shadow-sm">
                                                            $
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-bold text-emerald-900 uppercase">{p.method.replace('_', ' ')}</div>
                                                            <div className="text-[10px] font-semibold text-emerald-600/70" />
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <span className="font-bold text-emerald-900 text-lg">{formatMethodAmount(p.method, p.amount)}</span>
                                                        <button
                                                            onClick={() => {
                                                                setPayments(prev => prev.filter(x => x.id !== p.id))
                                                                // Recalculate input logic here if needed, keeping simple delete for now
                                                                // Re-add to input logic preserved from original:
                                                                setPaymentAmountInput(prev => {
                                                                    const currentVal = parseFloat(prev) || 0
                                                                    const addedVal = getAmountForTab(p, paymentTab)
                                                                    const nextVal = currentVal + addedVal
                                                                    return nextVal > 0 ? nextVal.toFixed(2) : ""
                                                                })
                                                            }}
                                                            className="text-slate-300 hover:text-rose-500 transition-colors"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Change List */}
                                    {changePayments.length > 0 && (
                                        <div className="space-y-3 pt-2">
                                            <h4 className="text-xs font-bold text-amber-500 uppercase tracking-widest pl-1">Vuelto Entregado</h4>
                                            {changePayments.map(p => (
                                                <div key={p.id} className="flex justify-between items-center p-3 rounded-2xl bg-amber-50 border border-amber-100 shadow-sm transition-colors group">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 rounded-xl bg-white border border-amber-100 flex items-center justify-center text-amber-600 font-bold shadow-sm">
                                                            <ArrowRightLeft size={18} />
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-bold text-amber-900 uppercase">{p.method.replace('_', ' ')}</div>
                                                            <div className="text-[10px] font-semibold text-amber-600/70">Entregado</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <span className="font-bold text-amber-900 text-lg">{formatMethodAmount(p.method, p.amount)}</span>
                                                        <button
                                                            onClick={() => {
                                                                setChangePayments(prev => prev.filter(x => x.id !== p.id))
                                                                setChangeAmountInput(prev => {
                                                                    const currentVal = parseFloat(prev) || 0
                                                                    const addedVal = getAmountForTab(p, changeTab)
                                                                    const nextVal = currentVal + addedVal
                                                                    return nextVal > 0 ? nextVal.toFixed(2) : ""
                                                                })
                                                            }}
                                                            className="text-emerald-400 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Footer Actions Desktop */}
                                <div className="hidden md:block p-6 md:p-8 border-t border-slate-100 bg-slate-50">
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            onClick={() => setShowPaymentModal(false)}
                                            className="py-4 rounded-xl font-bold text-slate-500 hover:bg-white hover:shadow-sm hover:text-slate-800 transition-all"
                                        >
                                            Volver
                                        </button>
                                        <button
                                            onClick={() => void finalizeSale()}
                                            disabled={finalizingSale || !canConfirmPayment}
                                            className="relative py-4 rounded-xl bg-slate-900 text-white font-bold text-lg shadow-xl shadow-slate-900/20 hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale disabled:scale-100 flex items-center justify-center gap-3 overflow-hidden"
                                        >
                                            {finalizingSale ? (
                                                <>
                                                    <Loader className="animate-spin" size={20} />
                                                    <span>Procesando...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span>Confirmar</span>
                                                    <CheckCircle2 size={20} />
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    {/* Exchange Rate Info */}
                                    {paymentTab === 'USD' && (
                                        <div className="mt-4 text-center">
                                            <span className="text-xs font-semibold text-slate-400 bg-slate-200/50 px-3 py-1 rounded-full">
                                                Tasa: {roundedRate ? roundedRate.toFixed(2) : "--"} Bs/USD
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* MOBILE FOOTER: Fixed Actions */}
                        <div className="md:hidden bg-white border-t border-slate-100 p-3 grid grid-cols-2 gap-3 shrink-0 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                            <button
                                onClick={() => setShowPaymentModal(false)}
                                className="py-3 rounded-xl font-bold text-slate-500 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-all text-sm"
                            >
                                Volver
                            </button>
                            <button
                                onClick={() => void finalizeSale()}
                                disabled={finalizingSale || !canConfirmPayment}
                                className="relative py-3 rounded-xl bg-slate-900 text-white font-bold text-sm shadow-lg shadow-slate-900/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {finalizingSale ? (
                                    <Loader className="animate-spin" size={16} />
                                ) : (
                                    <>
                                        <span>Confirmar</span>
                                        <CheckCircle2 size={16} />
                                    </>
                                )}
                            </button>
                        </div>

                    </div>
                </div>
            )
            }
        </>
    )
}
