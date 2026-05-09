import { useState, useMemo, useEffect, useRef } from "react"
import type { ProductDef, DeliveryLocation, PickupLocation } from "../types/app"
import { API_URL } from "../api/config"
import type { CartItem } from "./client/types"
import { Store, Clock, MapPin, Info, MessageCircle, Plus, X, Wallet, Banknote, Crosshair, ArrowLeft, ArrowRight, Loader2, Search, CheckCircle2, Sparkles, Gift, ShoppingBag } from "lucide-react"
import { LocationModal } from "./client/components/modals/LocationModal"
import { CartSheet } from "./client/components/CartSheet"
import { DeliveryMap } from "./client/components/DeliveryMap"
import { formatPhoneNumber } from "../utils/format"
import { canAutoRequestGeolocation, getGeolocationBlockReason } from "../utils/geolocation"
import ModernSpinner from "../components/ui/ModernSpinner"
import { formatExchangeRateLabel, formatVesFromUsd, formatVesLabelFromUsd, roundUsd } from "../utils/currency"
import { fetchPlaceDetails, searchPlaceSuggestions, type PlaceSuggestion } from "../api/places"

type GuestInterfaceProps = {
    products: ProductDef[]
    onLoginClick: () => void
    onRegisterClick: (cedula?: string) => void
    createGuestTicket: (data: any) => Promise<any>
    productsLoading?: boolean
    dailyRate: number
}

const hasValidExchangeRate = (rate: number) => Number.isFinite(rate) && rate > 0

function formatDualPrice(amount: number, rate: number) {
    const normalized = roundUsd(amount)
    const usd = normalized.toFixed(2)
    const ves = hasValidExchangeRate(rate) ? formatVesFromUsd(normalized, rate) : "--"
    return { usd, ves }
}

function formatTime12h(timeStr: string) {
    if (!timeStr) return ""
    const [h, m] = timeStr.split(':').map(Number)
    const suffix = h >= 12 ? "PM" : "AM"
    const h12 = h % 12 || 12
    return `${h12}:${m.toString().padStart(2, '0')} ${suffix}`
}

const isProductAvailable = (product: ProductDef) =>
    product.available ?? (product.active !== false && (product.stock ?? 1) > 0)

export default function GuestInterface({
    products,
    onLoginClick,
    onRegisterClick,
    createGuestTicket,
    productsLoading = false,
    dailyRate
}: GuestInterfaceProps) {
    const exchangeRate = dailyRate

    const [cartItems, setCartItems] = useState<CartItem[]>([])
    const [cartOpen, setCartOpen] = useState(false)
    const [currency] = useState<"USD" | "VES">("USD")
    const [loading, setLoading] = useState(false)
    const [hoursModalOpen, setHoursModalOpen] = useState(false)

    const [selectedProduct, setSelectedProduct] = useState<ProductDef | null>(null)

    const [checkoutOpen, setCheckoutOpen] = useState(false)
    const [guestForm, setGuestForm] = useState({ name: "", cedula: "", phone: "" })
    const [location, setLocation] = useState<DeliveryLocation | null>(null)
    const [paymentMethod, setPaymentMethod] = useState<string>("pago_movil")
    const [deliveryMethod, setDeliveryMethod] = useState<"delivery" | "pickup">("delivery")
    const [pickupLocations, setPickupLocations] = useState<PickupLocation[]>([])
    const [pickupLocationsLoading, setPickupLocationsLoading] = useState(false)
    const [successData, setSuccessData] = useState<any | null>(null)

    // Map State for EMBEDDED usage
    const [isMapLocatorActive, setIsMapLocatorActive] = useState(false)
    const [detectingLoc, setDetectingLoc] = useState(false)
    const [showLocTooltip, setShowLocTooltip] = useState(false)
    const [locError, setLocError] = useState<string | null>(null)
    const lastGeoCallRef = useRef<number>(0)
    const geoResolvedRef = useRef(false)
    const geoErrorTimeoutRef = useRef<number | null>(null)
    const geoClearTimeoutRef = useRef<number | null>(null)
    const geoRetryTimeoutRef = useRef<number | null>(null)
    const [locationSearchQuery, setLocationSearchQuery] = useState("")
    const [locationSuggestions, setLocationSuggestions] = useState<PlaceSuggestion[]>([])
    const [isLocationSearching, setIsLocationSearching] = useState(false)
    const [showLocationSuggestions, setShowLocationSuggestions] = useState(false)
    const locationSessionTokenRef = useRef<string>("")
    const locationTouchedRef = useRef(false)
    const autoLocateCallRef = useRef(0)

    useEffect(() => {
        locationSessionTokenRef.current = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)
    }, [])

    useEffect(() => {
        if (!checkoutOpen) {
            setLocationSearchQuery("")
            setLocationSuggestions([])
            setShowLocationSuggestions(false)
            locationTouchedRef.current = false
            autoLocateCallRef.current = 0
        }
    }, [checkoutOpen])

    useEffect(() => {
        const timer = window.setTimeout(() => {
            if (locationSearchQuery.trim().length > 2) {
                handleLocationSearch()
            } else {
                setLocationSuggestions([])
            }
        }, 450)
        return () => window.clearTimeout(timer)
    }, [locationSearchQuery])

    useEffect(() => {
        if (!checkoutOpen || deliveryMethod !== "delivery") return
        if (locationTouchedRef.current || location) return

        let cancelled = false
        let autoCallId = 0

        const run = async () => {
            const canAutoLocate = await canAutoRequestGeolocation()
            if (!canAutoLocate || cancelled || locationTouchedRef.current || location) return

            autoCallId = Date.now()
            autoLocateCallRef.current = autoCallId
            const options = { enableHighAccuracy: true, timeout: 10000 }

            const successCallback = (pos: GeolocationPosition) => {
                if (autoLocateCallRef.current !== autoCallId) return
                if (locationTouchedRef.current) return
                setLocation({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    name: "Mi Ubicación Actual",
                    address: "Detectada por GPS",
                    source: "gps",
                    reference: "Precisión GPS",
                })
            }

            const errorCallback = () => {
                if (autoLocateCallRef.current !== autoCallId) return
                if (options.enableHighAccuracy) {
                    options.enableHighAccuracy = false
                    navigator.geolocation.getCurrentPosition(successCallback, errorCallback, options)
                    return
                }
            }

            navigator.geolocation.getCurrentPosition(successCallback, errorCallback, options)
        }

        run()

        return () => {
            cancelled = true
            if (autoLocateCallRef.current === autoCallId) autoLocateCallRef.current = 0
        }
    }, [checkoutOpen, deliveryMethod, location])

    useEffect(() => {
        if (!checkoutOpen || deliveryMethod !== "pickup") return
        let cancelled = false

        const fetchPickupLocations = async () => {
            setPickupLocationsLoading(true)
            try {
                const res = await fetch(`${API_URL}/loyalty/public/pickup-locations`)
                if (!res.ok) throw new Error("Error loading pickup locations")
                const data = await res.json()
                if (!cancelled) setPickupLocations(Array.isArray(data) ? data : [])
            } catch (error) {
                console.error(error)
                if (!cancelled) setPickupLocations([])
            } finally {
                if (!cancelled) setPickupLocationsLoading(false)
            }
        }

        fetchPickupLocations()
        return () => {
            cancelled = true
        }
    }, [checkoutOpen, deliveryMethod])

    const [businessStatus, setBusinessStatus] = useState({ startHour: "13:00", endHour: "21:00", isForcedClosed: false })

    useEffect(() => {
        const fetchStatus = () => {
            fetch(`${API_URL}/loyalty/public/business-status?t=${Date.now()}`)
                .then(res => res.json())
                .then(setBusinessStatus)
                .catch(console.error)
        }
        fetchStatus()
        const interval = setInterval(fetchStatus, 30000)
        return () => clearInterval(interval)
    }, [])

    const isOpen = useMemo(() => {
        if (businessStatus.isForcedClosed) return false
        const now = new Date()
        const currentTime = now.getHours() * 60 + now.getMinutes()

        const [startH, startM] = businessStatus.startHour.split(':').map(Number)
        const [endH, endM] = businessStatus.endHour.split(':').map(Number)

        const startTime = startH * 60 + startM
        const endTime = endH * 60 + endM

        if (endTime > startTime) {
            // Normal case: Opening and closing on the same day
            return currentTime >= startTime && currentTime < endTime
        } else {
            // Midnight crossing case: (e.g., 1PM to 2AM)
            return currentTime >= startTime || currentTime < endTime
        }
    }, [businessStatus])

    const cartTotals = useMemo(() => {
        let items = 0, total = 0, points = 0
        for (const item of cartItems) {
            const price = roundUsd(item.price)
            items += item.quantity
            total += price * item.quantity
            points += item.points * item.quantity
        }
        return { items, total, points }
    }, [cartItems])

    const productMetaByKey = useMemo(() => {
        const map = new Map<string, { price: number; points: number; available: boolean }>()
        products.forEach((product) => {
            if (!product) return
            const meta = {
                price: roundUsd(product.price ?? 0),
                points: Number(product.points ?? 0),
                available: isProductAvailable(product),
            }
            if (product.id) map.set(product.id.toLowerCase(), meta)
            if (product.name) map.set(product.name.toLowerCase(), meta)
        })
        return map
    }, [products])

    useEffect(() => {
        if (!cartItems.length || productMetaByKey.size === 0) return
        setCartItems((prev) => {
            let changed = false
            const next = prev.flatMap((item) => {
                const key = (item.id || item.name).toLowerCase()
                const meta = productMetaByKey.get(key) ?? productMetaByKey.get(item.name.toLowerCase())
                if (!meta || !meta.available) {
                    changed = true
                    return []
                }
                let nextItem = item
                if (Number.isFinite(meta.price) && meta.price !== Number(item.price ?? 0)) {
                    nextItem = { ...nextItem, price: meta.price }
                }
                if (Number.isFinite(meta.points) && meta.points !== Number(item.points ?? 0)) {
                    nextItem = { ...nextItem, points: meta.points }
                }
                if (nextItem !== item) changed = true
                return [nextItem]
            })
            return changed ? next : prev
        })
    }, [cartItems.length, productMetaByKey])

    const formatPrice = (amount: number) => {
        const normalized = roundUsd(amount)
        if (currency === "VES") return formatVesLabelFromUsd(normalized, exchangeRate)
        return `$${normalized.toFixed(2)}`
    }

    const handleQuantityChange = (product: ProductDef | CartItem, delta: number) => {
        if (!product.id) return
        if (delta > 0 && !isProductAvailable(product)) return
        setCartItems(prev => {
            const existingIdx = prev.findIndex(p => p.id === product.id)
            if (existingIdx === -1) {
                if (delta > 0) return [...prev, { ...product, id: product.id!, quantity: 1, productId: product.id!, imageUrl: product.imageUrl }]
                return prev
            }
            const next = [...prev]
            const item = next[existingIdx]
            const newQty = item.quantity + delta
            if (newQty <= 0) return next.filter((_, i) => i !== existingIdx)
            next[existingIdx] = { ...item, quantity: newQty }
            return next
        })
    }

    const getQuantity = (product: ProductDef) => cartItems.find(p => p.id === product.id)?.quantity || 0
    const handlePay = () => { setCheckoutOpen(true); setCartOpen(false); }

    const openMapLocator = () => {
        setIsMapLocatorActive(true)
    }

    const handleLocationSearch = async () => {
        const query = locationSearchQuery.trim()
        if (!query) {
            setLocationSuggestions([])
            return
        }

        setIsLocationSearching(true)
        try {
            const biasCenter = location ?? { lat: 10.4806, lng: -66.9036 }
            const locationBias = {
                circle: {
                    center: { latitude: biasCenter.lat, longitude: biasCenter.lng },
                    radius: 5000.0,
                },
            }

            const formatted = await searchPlaceSuggestions(query, {
                publicMode: true,
                locationBias,
                sessionToken: locationSessionTokenRef.current,
            })
            setLocationSuggestions(formatted)
            setShowLocationSuggestions(formatted.length > 0)
        } catch (err) {
            console.error("Search error", err)
            setLocationSuggestions([])
        } finally {
            setIsLocationSearching(false)
        }
    }

    const handleSelectLocationSuggestion = async (item: PlaceSuggestion) => {
        locationTouchedRef.current = true
        setIsLocationSearching(true)
        try {
            const place = await fetchPlaceDetails(item.place_id, { publicMode: true })

            if (place.location) {
                const lat = place.location.latitude
                const lng = place.location.longitude
                const smartName = place.displayName?.text || item.main_text
                const ref = place.formattedAddress || item.secondary_text || ""

                setLocation({
                    lat,
                    lng,
                    name: smartName,
                    address: place.formattedAddress,
                    reference: ref,
                    source: "search",
                })
                setLocationSearchQuery(smartName)
                setShowLocationSuggestions(false)
                setLocationSuggestions([])
                locationSessionTokenRef.current = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)
            }
        } catch (err) {
            console.error("Details error", err)
        } finally {
            setIsLocationSearching(false)
        }
    }

    const handleDetectLocation = () => {
        const blockReason = getGeolocationBlockReason()
        if (blockReason) {
            if (geoErrorTimeoutRef.current !== null) {
                window.clearTimeout(geoErrorTimeoutRef.current)
                geoErrorTimeoutRef.current = null
            }
            if (geoClearTimeoutRef.current !== null) {
                window.clearTimeout(geoClearTimeoutRef.current)
                geoClearTimeoutRef.current = null
            }
            if (geoRetryTimeoutRef.current !== null) {
                window.clearTimeout(geoRetryTimeoutRef.current)
                geoRetryTimeoutRef.current = null
            }
            setDetectingLoc(false)
            setShowLocTooltip(false)
            setLocError(blockReason)
            geoClearTimeoutRef.current = window.setTimeout(() => {
                setLocError(current => current === blockReason ? null : current)
            }, 4000)
            return
        }

        locationTouchedRef.current = true

        const thisCall = Date.now()
        lastGeoCallRef.current = thisCall
        geoResolvedRef.current = false
        const startTime = Date.now()
        let lastError: GeolocationPositionError | null = null

        // Clear timeouts
        if (geoErrorTimeoutRef.current !== null) {
            window.clearTimeout(geoErrorTimeoutRef.current)
            geoErrorTimeoutRef.current = null
        }
        if (geoClearTimeoutRef.current !== null) {
            window.clearTimeout(geoClearTimeoutRef.current)
            geoClearTimeoutRef.current = null
        }
        if (geoRetryTimeoutRef.current !== null) {
            window.clearTimeout(geoRetryTimeoutRef.current)
            geoRetryTimeoutRef.current = null
        }

        setDetectingLoc(true)
        setShowLocTooltip(true)
        setLocError(null)

        const handleSuccess = (pos: GeolocationPosition) => {
            if (lastGeoCallRef.current !== thisCall) return
            geoResolvedRef.current = true
            if (geoRetryTimeoutRef.current !== null) {
                window.clearTimeout(geoRetryTimeoutRef.current)
                geoRetryTimeoutRef.current = null
            }

            setDetectingLoc(false)
            setLocError(null)
            setShowLocTooltip(false)

            const { latitude, longitude } = pos.coords
            try {
                setLocation({
                    lat: latitude,
                    lng: longitude,
                    name: "Mi Ubicación Actual",
                    address: "Detectada por GPS",
                    source: "gps",
                    reference: "Precisión GPS"
                })
            } catch (e) {
                console.error(e)
            }
        }

        const attempt = (useHighAccuracy: boolean, timeoutMs: number) => {
            navigator.geolocation.getCurrentPosition(
                handleSuccess,
                (err) => handleError(err, useHighAccuracy),
                { enableHighAccuracy: useHighAccuracy, timeout: timeoutMs, maximumAge: 0 }
            )
        }

        const handleError = (err: GeolocationPositionError, isHighAccuracy: boolean) => {
            if (lastGeoCallRef.current !== thisCall) return
            lastError = err



            // If it was High Accuracy and failed (likely timeout or unavailable), retry with Low Accuracy
            if (isHighAccuracy) {
                // Retry with low accuracy
                attempt(false, 10000)
                return
            }

            const elapsed = Date.now() - startTime
            if (elapsed < 20000) {
                geoRetryTimeoutRef.current = window.setTimeout(() => {
                    attempt(true, 5000)
                }, 1200)
                return
            }

            setDetectingLoc(false)
            setShowLocTooltip(false)
            const errorCode = lastError?.code ?? err.code

            let message = "Error al detectar ubicación."
            if (errorCode === 1) message = "Permiso denegado. Habilita la ubicación."
            else if (errorCode === 3) message = "Tiempo agotado. Intenta de nuevo."

            setLocError(message)

            // Auto clear error after 4s
            geoClearTimeoutRef.current = window.setTimeout(() => {
                setLocError(current => (current === message || current === "Permiso denegado. Habilita la ubicación.") ? null : current)
            }, 4000)
        }

        // First attempt: High Accuracy
        attempt(true, 5000)
    }
    const handleSubmitOrder = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!guestForm.name || !guestForm.cedula || (deliveryMethod === 'delivery' && !location)) {
            alert("Nombre y Cédula son obligatorios" + (deliveryMethod === 'delivery' ? ", así como la Ubicación." : "."))
            return
        }
        setLoading(true)
        try {
            const ticket = await createGuestTicket({
                items: cartItems.map(item => ({ name: item.name, price: roundUsd(item.price), points: item.points, quantity: item.quantity, productId: item.id })),
                amount: roundUsd(cartTotals.total),
                exchangeRate: exchangeRate > 0 ? exchangeRate : undefined,
                points: cartTotals.points,
                customerName: guestForm.name,
                documentNumber: guestForm.cedula,
                documentType: 'V',
                phone: guestForm.phone,
                deliveryLocation: location,
                bank: paymentMethod,
            })
            setSuccessData({
                points: cartTotals.points,
                ticketId: ticket.id,
                user: ticket.user,
                items: cartItems,
                total: cartTotals.total,
                exchangeRate: ticket.exchangeRate ?? exchangeRate,
                cedula: guestForm.cedula,
                provisionalExpiresAt: ticket.user?.provisionalExpiresAt ?? null,
            })
            setCartItems([]); setCheckoutOpen(false);
        } catch (err: any) { alert(err.message || "Error al procesar pedido") } finally { setLoading(false) }
    }

    const handleWhatsAppConfirm = () => {
        if (!successData || !successData.items) return

        const itemsList = successData.items.map((i: any) => `- ${i.quantity}x ${i.name}`).join('\n')
        const totalUsd = successData.total.toFixed(2)
        const ticketExchangeRate = Number(successData.exchangeRate ?? exchangeRate)
        const totalVes = hasValidExchangeRate(ticketExchangeRate) ? formatVesFromUsd(successData.total, ticketExchangeRate) : null
        const locReference = location?.reference || location?.address || "Ubicación en mapa"
        const locDetail = location?.villa || ""
        const locLabel = [locReference, locDetail].filter(Boolean).join(" - ")
        const mapLink = location?.lat && location?.lng ? `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}` : null
        const method = paymentMethod === "pago_movil" ? "Pago Móvil" : "Efectivo"
        const deliveryType = deliveryMethod === "pickup" ? "Retiro en Tienda" : "Delivery"

        // Construct message with clean structure and minimal emojis
        const parts = [
            "👋 *¡Hola! Realizo el siguiente pedido:*",
            "",
            "*Datos del Cliente:*",
            `Cliente: ${guestForm.name}`,
            `Cédula: ${guestForm.cedula}`,
            `Teléfono: ${guestForm.phone}`,
            "",
            "*Detalle del Pedido:*",
            `Ticket #: ${successData.ticketId}`,
            "----------------",
            itemsList,
            "----------------",
            "",
            totalVes ? `Total: $${totalUsd} (Bs. ${totalVes})` : `Total: $${totalUsd}`,
            totalVes ? formatExchangeRateLabel(ticketExchangeRate) : null,
            `Pago: ${method}`,
            `Entrega: ${deliveryType}`,
            deliveryMethod === 'delivery' ? `Dirección: ${locLabel} ${mapLink ? `(${mapLink})` : ''}` : null,
            "",
            "⚠️ *IMPORTANTE:* Por favor envía este mensaje sin editarlo. Contiene los detalles necesarios para procesar tu pedido.",
            ""
        ]

        // Join with newlines, filtering out nulls
        const msg = parts.filter(p => p !== null).join("\n")

        const encodedMsg = encodeURIComponent(msg)
        window.open(`https://api.whatsapp.com/send?phone=584226301000&text=${encodedMsg}`, '_blank')
    }


    if (successData) {
        // Guest user logic: successData.user might be present if provisional, or not.
        // We always want to prompt them to register/claim if they are guest.
        // If they just created a ticket as guest, they are NOT logged in as a full user yet.
        const successExchangeRate = Number(successData.exchangeRate ?? exchangeRate)
        const successVesTotal = hasValidExchangeRate(successExchangeRate)
            ? formatVesLabelFromUsd(successData.total, successExchangeRate)
            : null

        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-500 bg-slate-900/60 backdrop-blur-sm">
                <div className="w-full max-w-sm bg-white rounded-[2rem] shadow-2xl shadow-black/20 overflow-hidden relative animate-in zoom-in-95 duration-300">

                    {/* Minimalist modern header */}
                    <div className="pt-10 px-8 flex flex-col items-center text-center relative z-10">
                        <div className="w-20 h-20 bg-secondary-100/50 rounded-full flex items-center justify-center mb-6 ring-8 ring-secondary-50/50 shadow-inner">
                            <CheckCircle2 size={40} className="text-secondary-500" strokeWidth={2.5} />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 leading-tight mb-2">¡Pedido Recibido!</h2>
                        <p className="text-slate-500 font-bold text-sm bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                            Orden #{successData.ticketId}
                        </p>
                        <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3">
                            <p className="text-lg font-black text-slate-900 leading-none">
                                {successVesTotal ?? `$${successData.total.toFixed(2)}`}
                            </p>
                            {successVesTotal && (
                                <p className="text-[11px] font-bold text-slate-500 mt-1">
                                    ${successData.total.toFixed(2)}
                                </p>
                            )}
                            <p className="mt-2 inline-flex rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-500">
                                {formatExchangeRateLabel(successExchangeRate)}
                            </p>
                        </div>
                    </div>

                    <div className="p-8 space-y-8">
                        {/* WhatsApp Action - Primary */}
                        <div className="space-y-3">
                            <p className="text-center text-slate-500 text-xs font-medium px-4">
                                Para confirmar y procesar tu pedido, envíanos el detalle por WhatsApp:
                            </p>
                            <button
                                onClick={handleWhatsAppConfirm}
                                className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold text-base shadow-xl shadow-emerald-500/30 hover:shadow-emerald-500/40 active:scale-[0.98] transition-all flex items-center justify-center gap-3 group"
                            >
                                <MessageCircle size={24} className="fill-white/20 group-hover:scale-110 transition-transform" />
                                <span>Enviar al WhatsApp</span>
                            </button>
                        </div>

                        {/* Subtle Loyalty Section */}
                        {successData.points > 0 && (
                            <div className="relative overflow-hidden rounded-2xl border border-secondary-100 bg-gradient-to-br from-secondary-50 via-white to-primary-50 p-5 shadow-sm group">
                                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Sparkles size={48} className="text-secondary-500" />
                                </div>

                                <div className="flex items-center gap-4 relative z-10">
                                    <div className="w-10 h-10 rounded-full bg-tertiary/20 flex items-center justify-center shrink-0 text-amber-600 shadow-sm ring-4 ring-tertiary/10">
                                        <Gift size={20} className="animate-pulse text-amber-700" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-extrabold text-slate-800 text-sm mb-1">
                                            ¡Ganaste {successData.points} Puntos!
                                        </h4>
                                        <p className="text-slate-600 text-[11px] font-medium leading-normal mb-3">
                                            Estan guardados bajo tu cedula por 7 dias. Crea una cuenta con esa misma cedula para no perderlos y canjearlos por <span className="font-bold text-primary-600">Brownies gratis</span>.
                                        </p>
                                        <button
                                            onClick={() => onRegisterClick(guestForm.cedula)}
                                            className="text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 px-4 py-2 rounded-lg shadow-lg shadow-primary-500/20 active:scale-95 transition-all w-full sm:w-auto text-center"
                                        >
                                            Crear cuenta y reclamar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="text-center pt-2">
                            <button
                                onClick={() => { setSuccessData(null); setCheckoutOpen(false); }}
                                className="text-slate-400 font-bold text-xs hover:text-slate-600 transition-colors py-2 px-4"
                            >
                                Volver al menú
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen font-sans pb-32 bg-dots relative">
            {/* Absolute overlay for the top gradient background if needed, but bg-dots is on the container */}
            <div className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-[#fdf8ee] via-[#fdf8ee] to-transparent pointer-events-none z-0" />

            {!selectedProduct && (
                <>
                    {/* --- HEADER --- */}
                    <div className="relative flex items-center justify-between px-6 py-6 z-20">
                        <div />
                        <div className="flex items-center gap-4">
                            <button onClick={onLoginClick} className="text-sm font-bold text-[#6A3A30]/60 hover:text-[#6A3A30] transition-colors">Ingresar</button>
                            <button onClick={() => onRegisterClick()} className="px-6 py-2.5 text-sm font-bold bg-[#6A3A30]/10 text-[#6A3A30] rounded-full hover:bg-[#6A3A30]/20 transition-all border border-[#6A3A30]/10">Registrarse</button>
                        </div>
                    </div>

                    {/* --- LOGO & STATUS --- */}
                    <div className="px-6 flex flex-col items-center text-center relative z-20 mt-4 mb-10">
                        <div className="w-32 h-32 bg-white rounded-full p-2 shadow-xl shadow-slate-200/50 mb-8 relative flex items-center justify-center">
                            <div className="w-full h-full bg-[#fdf8ee]/50 rounded-full flex items-center justify-center text-[#6A3A30]">
                                <img src="/images/cookie-logo.png" alt="Logo" className="w-16 h-16 object-contain" onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    e.currentTarget.parentElement!.innerHTML = '<span class="text-4xl text-[#6A3A30]">🍪</span>';
                                }} />
                            </div>
                        </div>
                        <h1 className="text-5xl font-black text-[#6A3A30] mb-6 tracking-tight flex items-center gap-1">
                            Krums<span className="w-3 h-3 rounded-full bg-cyan-200 mt-4"></span>
                        </h1>

                        <div className="bg-white/80 backdrop-blur-md px-5 py-2.5 rounded-full shadow-lg shadow-slate-200/40 border border-[#6A3A30]/5 flex items-center gap-3 mb-6">
                            <MapPin size={16} className="text-blue-400" />
                            <span className="text-sm font-bold text-[#6A3A30]/80">Maracaibo, Venezuela</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                            <span className={`text-[11px] font-black tracking-widest ${isOpen ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {isOpen ? 'ABIERTO' : 'CERRADO'}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 w-full max-w-xs mx-auto">
                            <button onClick={() => setHoursModalOpen(true)} className="h-11 rounded-2xl bg-white/50 border border-[#6A3A30]/10 text-[#6A3A30] font-bold text-xs flex items-center justify-center gap-2 hover:bg-white/80 transition-all backdrop-blur-md">
                                <Clock size={16} className="text-[#6A3A30]/60" /> <span>Horario</span>
                            </button>
                            <a href="https://wa.me/584226301000" target="_blank" rel="noreferrer" className="h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 font-bold text-xs flex items-center justify-center gap-2 hover:bg-emerald-500/20 transition-all backdrop-blur-md">
                                <MessageCircle size={16} /> <span>WhatsApp</span>
                            </a>
                        </div>
                    </div>

                    {/* --- HERO SECTION (Featured) --- */}
                    <div className="px-5 mb-12 relative z-10 max-w-xl mx-auto">
                        {products.length > 0 && (
                            <div className="relative aspect-[16/11] rounded-[2.5rem] overflow-hidden shadow-2xl shadow-[#6A3A30]/20 group">
                                <img
                                    src={products[0].imageUrl || "/images/brownie-hero.jpg"}
                                    alt={products[0].name}
                                    className="w-full h-full object-cover"
                                />
                                {/* Overlay Gradient */}
                                <div className="absolute inset-0 bg-gradient-to-t from-[#6A3A30]/90 via-[#6A3A30]/20 to-transparent" />

                                {/* Popular Badge */}
                                <div className="absolute top-6 right-6 px-4 py-2 bg-blue-400/80 backdrop-blur-md rounded-full text-[11px] font-black text-white tracking-wide shadow-lg border border-white/20">
                                    Más Popular
                                </div>

                                {/* Content */}
                                <div className="absolute inset-x-0 bottom-0 p-8">
                                    <h2 className="text-3xl font-black text-white mb-2 leading-tight">
                                        {products[0].name}
                                    </h2>
                                    <p className="text-white/80 text-[13px] font-medium mb-6 max-w-[85%] line-clamp-2">
                                        {products[0].description || "Doble chocolate con nueces tostadas y un toque de sal marina."}
                                    </p>

                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-2xl font-black text-white">
                                                ${formatDualPrice(products[0].price, exchangeRate).usd}
                                            </span>
                                            <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">
                                                Bs. {formatDualPrice(products[0].price, exchangeRate).ves}
                                            </span>
                                        </div>

                                        {getQuantity(products[0]) === 0 ? (
                                            <button
                                                onClick={() => handleQuantityChange(products[0], 1)}
                                                disabled={!isProductAvailable(products[0])}
                                                className="bg-[#fdf8ee] text-[#6A3A30] px-6 h-12 rounded-full font-black text-sm flex items-center gap-2 shadow-xl active:scale-95 transition-all group/btn disabled:opacity-60 disabled:cursor-not-allowed"
                                            >
                                                ¡Lo quiero!
                                                <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
                                            </button>
                                        ) : (
                                            <div className="flex items-center bg-black/10 backdrop-blur-xl rounded-full p-1 h-14 border border-white/20">
                                                <button
                                                    onClick={() => handleQuantityChange(products[0], -1)}
                                                    className="w-12 h-12 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 active:scale-90 transition-all font-black text-xl"
                                                >
                                                    -
                                                </button>
                                                <span className="text-base font-black text-white px-5 min-w-[32px] text-center">{getQuantity(products[0])}</span>
                                                <button
                                                    onClick={() => handleQuantityChange(products[0], 1)}
                                                    className="w-12 h-12 flex items-center justify-center rounded-full bg-[#fdf8ee] text-[#6A3A30] shadow-[0_4px_15px_rgba(253,248,238,0.4)] hover:brightness-110 active:scale-95 transition-all font-black text-xl"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* --- MENU LIST --- */}
            {!selectedProduct ? (
                <div className="p-5 pt-8 max-w-xl mx-auto relative z-10">
                    <div className="mb-10 px-2">
                        <h3 className="text-3xl font-black text-[#6A3A30]">Menú</h3>
                    </div>

                    <div className="flex flex-col gap-8 pb-24">
                        {productsLoading ? (
                            <div className="col-span-1 flex flex-col items-center justify-center py-10 animate-in fade-in duration-700">
                                <ModernSpinner container={false} text="Cargando menú..." />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-8">
                                {products.length === 0 ? (
                                    <div className="col-span-full text-center py-12 text-[#6A3A30]/40 text-sm font-medium bg-white rounded-3xl border border-dashed border-[#6A3A30]/10">
                                        No hay productos disponibles.
                                    </div>
                                ) : (
                                    products.map((product) => {
                                        const prices = formatDualPrice(product.price, exchangeRate)
                                        const qty = getQuantity(product)
                                        const available = isProductAvailable(product)
                                        return (
                                            <div
                                                key={product.id}
                                                className="relative flex flex-col bg-white rounded-[2.5rem] p-4 shadow-xl shadow-[#6A3A30]/5 border border-[#6A3A30]/5 hover:shadow-2xl hover:shadow-[#6A3A30]/10 transition-all group overflow-hidden"
                                            >
                                                <div className="relative aspect-square w-full rounded-[2rem] overflow-hidden bg-[#fdf8ee] mb-5">
                                                    <img
                                                        src={product.imageUrl || "/images/brownie.png"}
                                                        alt={product.name}
                                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                    />
                                                    {!available && (
                                                        <span className="absolute top-4 right-4 rounded-full bg-[#6A3A30]/90 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[#FFFBEA]">
                                                            Agotado
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="px-2 flex flex-col flex-1">
                                                    <h4 className="text-xl font-black text-[#6A3A30] leading-tight mb-2 line-clamp-1">
                                                        {product.name}
                                                    </h4>
                                                    <p className="text-[13px] text-[#6A3A30]/50 font-semibold leading-relaxed line-clamp-2 mb-6 h-10">
                                                        {product.description || "Deliciosa combinación de ingredientes premium preparados con amor."}
                                                    </p>

                                                    <div className="mt-auto flex items-center justify-between gap-4">
                                                        <div className="flex flex-col">
                                                            <span className="text-2xl font-black text-[#6A3A30]">${prices.usd}</span>
                                                            <span className="text-[10px] font-bold text-[#6A3A30]/40 uppercase tracking-widest">Bs. {prices.ves}</span>
                                                        </div>

                                                        {qty === 0 ? (
                                                            <button
                                                                onClick={() => handleQuantityChange(product, 1)}
                                                                disabled={!available}
                                                                className="w-12 h-12 rounded-2xl bg-[#6A3A30]/5 text-[#6A3A30] flex items-center justify-center hover:bg-[#6A3A30]/10 active:scale-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                                title={available ? "Agregar" : "Agotado"}
                                                            >
                                                                {available ? <Plus size={20} /> : <X size={18} />}
                                                            </button>
                                                        ) : (
                                                            <div className="flex items-center bg-[#6A3A30]/5 rounded-2xl p-1 h-12">
                                                                <button
                                                                    onClick={() => handleQuantityChange(product, -1)}
                                                                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-white text-[#6A3A30] shadow-sm active:scale-90 transition-all font-black"
                                                                >
                                                                    -
                                                                </button>
                                                                <span className="text-sm font-black text-[#6A3A30] px-3 min-w-[24px] text-center">{qty}</span>
                                                                <button
                                                                    onClick={() => handleQuantityChange(product, 1)}
                                                                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#6A3A30] text-white shadow-md active:scale-95 transition-all font-black"
                                                                >
                                                                    +
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* --- PRODUCT DETAIL "TAB" VIEW --- */
                <div className="fixed inset-0 z-[100] bg-[#fdf8ee] overflow-y-auto animate-in slide-in-from-right duration-300">
                    <div className="max-w-xl mx-auto bg-[#fdf8ee] min-h-full flex flex-col relative">
                        <div className="relative h-[50vh] shrink-0 bg-white rounded-b-[3rem] overflow-hidden shadow-xl shadow-[#6A3A30]/5">
                            <img src={selectedProduct.imageUrl || "/images/brownie.png"} alt={selectedProduct.name} className="w-full h-full object-cover" />

                            <button
                                onClick={() => setSelectedProduct(null)}
                                className="absolute top-6 left-6 p-4 bg-white/90 backdrop-blur-md text-[#6A3A30] shadow-lg border border-[#6A3A30]/5 rounded-full hover:bg-white active:scale-95 transition-all"
                            >
                                <ArrowLeft size={24} />
                            </button>

                            <div className="absolute bottom-8 right-8">
                                <span className="bg-[#6A3A30] text-[#fdf8ee] px-5 py-2 rounded-full text-xs font-black shadow-xl border border-white/20 flex items-center gap-2">
                                    <Sparkles size={16} className="text-cyan-200" />
                                    {selectedProduct.points} Puntos Kr.
                                </span>
                            </div>
                        </div>

                        <div className="flex-1 p-8 bg-[#fdf8ee] relative flex flex-col pb-32">
                            <div className="w-12 h-1.5 bg-[#6A3A30]/10 rounded-full mx-auto mb-10 shrink-0" />

                            <h3 className="text-5xl font-black text-[#6A3A30] mb-4 leading-tight">
                                {selectedProduct.name}
                            </h3>
                            <p className="text-[#6A3A30]/60 text-lg font-semibold mb-10 leading-relaxed">
                                {selectedProduct.description || "Una experiencia culinaria única, preparada con los ingredientes más frescos y seleccionados para garantizar un sabor inigualable."}
                            </p>

                            <div className="mt-auto">
                                <div className="flex items-center justify-between gap-6">
                                    <div className="flex flex-col">
                                        <span className="text-4xl font-black text-[#6A3A30]">${formatDualPrice(selectedProduct.price, exchangeRate).usd}</span>
                                        <span className="text-sm font-bold text-[#6A3A30]/40 uppercase tracking-widest">Bs. {formatDualPrice(selectedProduct.price, exchangeRate).ves}</span>
                                    </div>
                                    <div className="flex items-center bg-white rounded-[2rem] p-1.5 shadow-xl shadow-[#6A3A30]/5 border border-[#6A3A30]/5">
                                        <button onClick={() => handleQuantityChange(selectedProduct, -1)} className="w-14 h-14 flex items-center justify-center text-[#6A3A30] hover:bg-[#6A3A30]/5 rounded-2xl active:scale-90 transition-all font-black text-2xl">-</button>
                                        <span className="w-12 text-center font-black text-xl text-[#6A3A30]">{getQuantity(selectedProduct)}</span>
                                        <button onClick={() => handleQuantityChange(selectedProduct, 1)} disabled={!isProductAvailable(selectedProduct)} className="w-14 h-14 flex items-center justify-center bg-[#6A3A30] text-white rounded-2xl shadow-lg shadow-[#6A3A30]/20 active:scale-95 transition-all font-black text-2xl disabled:opacity-50 disabled:cursor-not-allowed">+</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {!cartOpen && !checkoutOpen && !selectedProduct && (
                <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50">
                    <button
                        type="button"
                        onClick={() => setCartOpen(true)}
                        className="h-12 min-w-[220px] max-w-[calc(100vw-2rem)] rounded-full bg-[#6A3A30] text-[#FFFBEA] px-4 shadow-[0_16px_30px_-12px_rgba(106,58,48,0.6)] hover:bg-[#5a3128] active:scale-[0.99] transition-all flex items-center justify-between gap-4 border border-[#6A3A30]/80"
                    >
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-[#FFFBEA]/15 flex items-center justify-center shrink-0 relative">
                                <ShoppingBag size={18} />
                                {cartTotals.items > 0 && (
                                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-[#6A3A30]">
                                        {cartTotals.items}
                                    </span>
                                )}
                            </div>
                            <div className="text-left leading-tight min-w-0">
                                <p className="text-[14px] font-black truncate">Ver carrito</p>
                            </div>
                        </div>
                        <div className="flex items-center shrink-0 min-w-0">
                            <span className="text-[14px] font-black whitespace-nowrap">
                                ${formatDualPrice(cartTotals.total, exchangeRate).usd}
                            </span>
                        </div>
                    </button>
                </div>
            )}

            {/* --- CART SHEET --- */}
            <CartSheet
                open={cartOpen}
                onToggle={() => setCartOpen(false)}
                cartItems={cartItems}
                cartTotals={cartTotals}
                formatPrice={formatPrice}
                onChangeQuantity={handleQuantityChange}
                onClearCart={() => setCartItems([])}
                onPay={handlePay}

                exchangeRate={exchangeRate}

                availableCoupons={[]}
                selectedCoupon={null}
                onSelectCoupon={() => { }}
                discountAmount={0}
                finalTotal={cartTotals.total}
                pointsBlockedCount={0}
                couponCoverage={[]}
                isClosed={!isOpen}
            />

            {/* --- CHECKOUT FORM --- */}
            {checkoutOpen && (
                <div className="fixed inset-0 z-[90] flex items-stretch sm:items-center justify-center p-0 sm:p-6 animate-in fade-in duration-200 bg-white sm:bg-transparent">
                    <div className="absolute inset-0 hidden sm:block bg-black/40 backdrop-blur-sm" onClick={() => setCheckoutOpen(false)} />
                    <div className="relative w-full h-[100dvh] sm:h-auto max-w-none sm:max-w-md bg-white rounded-none sm:rounded-[2rem] overflow-hidden shadow-none sm:shadow-2xl animate-in sm:slide-in-from-bottom-8 duration-300 max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto">
                        {/* Show Map Modal INSTEAD of form only if active */}
                        {isMapLocatorActive ? (
                            <div className="h-[400px] w-full relative">
                                <button onClick={() => setIsMapLocatorActive(false)} className="absolute top-4 right-4 z-[100] p-2 bg-white rounded-full shadow-lg text-slate-500 hover:text-slate-900"><X size={20} /></button>
                                <LocationModal
                                    open={true}
                                    onClose={() => setIsMapLocatorActive(false)} // This just closes the view back to form
                                    onSave={(loc) => { setLocation(loc); setIsMapLocatorActive(false); }}
                                    publicMode={true}
                                    inline={true}
                                    showSearch={false}
                                    initialLocation={location}
                                    requireDetails={false}
                                />
                            </div>
                        ) : (
                            <div className="p-8">
                                <h2 className="text-2xl font-black text-slate-900 mb-2">Finalizar Pedido</h2>
                                <p className="text-sm text-slate-500 mb-6 leading-relaxed">Completa tus datos obligatorios <span className="text-red-500 font-bold">*</span></p>

                                <form onSubmit={handleSubmitOrder} className="space-y-4">
                                    {/* 1. Payment Method (Moved to Top) */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Método de Pago</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button type="button" onClick={() => setPaymentMethod("pago_movil")} className={`h-12 rounded-xl flex items-center justify-center gap-2 font-bold text-xs transition-all border-2 ${paymentMethod === "pago_movil" ? "border-[#6A3A30] bg-[#6A3A30] text-[#FFFBEA]" : "border-slate-100 bg-white text-slate-500 hover:bg-slate-50"}`}><Wallet size={16} /> Pago Móvil</button>
                                            <button type="button" onClick={() => setPaymentMethod("efectivo")} className={`h-12 rounded-xl flex items-center justify-center gap-2 font-bold text-xs transition-all border-2 ${paymentMethod === "efectivo" ? "border-[#6A3A30] bg-[#6A3A30] text-[#FFFBEA]" : "border-slate-100 bg-white text-slate-500 hover:bg-slate-50"}`}><Banknote size={16} /> Efectivo</button>
                                        </div>
                                    </div>

                                    {/* 2. Delivery Method (New) */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Método de Entrega</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button type="button" onClick={() => setDeliveryMethod("delivery")} className={`h-12 rounded-xl flex items-center justify-center gap-2 font-bold text-xs transition-all border-2 ${deliveryMethod === "delivery" ? "border-[#6A3A30] bg-[#6A3A30] text-[#FFFBEA]" : "border-slate-100 bg-white text-slate-500 hover:bg-slate-50"}`}><MapPin size={16} /> Delivery</button>
                                            <button type="button" onClick={() => setDeliveryMethod("pickup")} className={`h-12 rounded-xl flex items-center justify-center gap-2 font-bold text-xs transition-all border-2 ${deliveryMethod === "pickup" ? "border-[#6A3A30] bg-[#6A3A30] text-[#FFFBEA]" : "border-slate-100 bg-white text-slate-500 hover:bg-slate-50"}`}><Store size={16} /> Pick up</button>
                                        </div>
                                    </div>

                                    {/* 3. Personal Data */}
                                    <div className="space-y-1.5 pt-2">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Nombre <span className="text-red-500">*</span></label>
                                        <input required className="w-full h-12 px-4 rounded-xl bg-[#6A3A30]/5 border border-[#6A3A30]/10 text-slate-900 font-semibold outline-none focus:ring-2 focus:ring-[#6A3A30]/20 focus:border-[#6A3A30]/30" value={guestForm.name} onChange={e => setGuestForm({ ...guestForm, name: e.target.value })} placeholder="Ej: Juan Perez" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Cédula <span className="text-red-500">*</span></label>
                                            <input required className="w-full h-12 px-4 rounded-xl bg-[#6A3A30]/5 border border-[#6A3A30]/10 text-slate-900 font-semibold outline-none focus:ring-2 focus:ring-[#6A3A30]/20 focus:border-[#6A3A30]/30" value={guestForm.cedula} onChange={e => setGuestForm({ ...guestForm, cedula: e.target.value })} placeholder="123456" inputMode="numeric" />
                                        </div>
                                        <div className="space-y-1.5">
                                            {/* Phone is now REQUIRED */}
                                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Teléfono <span className="text-red-500">*</span></label>
                                            <input required className="w-full h-12 px-4 rounded-xl bg-[#6A3A30]/5 border border-[#6A3A30]/10 text-slate-900 font-semibold outline-none focus:ring-2 focus:ring-[#6A3A30]/20 focus:border-[#6A3A30]/30" value={guestForm.phone} onChange={e => setGuestForm({ ...guestForm, phone: formatPhoneNumber(e.target.value) })} placeholder="0412-123-4567" type="tel" maxLength={13} />
                                        </div>
                                    </div>

                                    {/* 4. Location / Pickup */}
                                    {deliveryMethod === "delivery" ? (
                                        <div className="space-y-1.5 pt-2">
                                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Ubicacion <span className="text-red-500">*</span></label>
                                            <div className="space-y-2">
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                        {isLocationSearching ? (
                                                            <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" />
                                                        ) : (
                                                            <Search size={14} className="text-slate-400" />
                                                        )}
                                                    </div>
                                                    <input
                                                        value={locationSearchQuery}
                                                        onChange={(e) => setLocationSearchQuery(e.target.value)}
                                                        onFocus={() => {
                                                            if (locationSuggestions.length > 0) setShowLocationSuggestions(true)
                                                        }}
                                                        placeholder="Buscar ubicacion"
                                                        className="w-full bg-[#6A3A30]/5 border border-[#6A3A30]/10 rounded-xl pl-9 pr-9 py-3 font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#6A3A30]/20 focus:border-[#6A3A30]/30 transition-all text-sm placeholder:text-slate-400"
                                                    />
                                                    {locationSearchQuery && (
                                                        <button
                                                            onClick={() => { setLocationSearchQuery(""); setLocationSuggestions([]); setShowLocationSuggestions(false) }}
                                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-300 hover:text-slate-500"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                                {showLocationSuggestions && locationSuggestions.length > 0 && (
                                                    <div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden max-h-56 overflow-y-auto">
                                                        {locationSuggestions.map((item, i) => (
                                                            <div
                                                                key={item.place_id || i}
                                                                onClick={() => handleSelectLocationSuggestion(item)}
                                                                className="px-3 py-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-none flex items-center gap-2"
                                                            >
                                                                <div className="p-1.5 rounded-full bg-slate-50 text-slate-400 shrink-0">
                                                                    <MapPin size={14} />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-xs font-bold text-slate-900 truncate">{item.main_text}</p>
                                                                    <p className="text-[10px] font-medium text-slate-500 truncate">{item.secondary_text}</p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="h-48 w-full rounded-2xl overflow-hidden border border-slate-200 relative bg-slate-50">
                                                {location ? (
                                                    <div className="w-full h-full relative group">
                                                        <div className="absolute inset-0 pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity">
                                                            <DeliveryMap selected={location} onSelect={() => { }} />
                                                        </div>
                                                        <div className="absolute inset-x-0 bottom-0 bg-white/90 backdrop-blur-md p-3 border-t border-slate-100 flex items-center gap-3 z-10">
                                                            <div className="p-2 bg-secondary-100 text-secondary-600 rounded-full shrink-0">
                                                                <MapPin size={18} className="fill-secondary-100" />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="font-bold text-slate-900 text-xs truncate leading-tight">{location.name}</p>
                                                                <p className="text-[10px] text-slate-500 truncate">{location.reference || "Ubicacion fijada"}</p>
                                                            </div>
                                                            <button type="button" onClick={openMapLocator} className="px-3 py-1.5 bg-slate-900 text-white text-[10px] font-bold rounded-lg shadow-lg hover:bg-primary-600 transition-colors">Cambiar</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button type="button" onClick={openMapLocator} className="w-full h-full bg-slate-50 hover:bg-slate-100 transition-colors flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-primary-500 group">
                                                        <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform"><MapPin size={24} /></div>
                                                        <span className="font-bold text-sm">Seleccionar en el mapa</span>
                                                        <span className="text-[10px] font-medium opacity-70">Toca para abrir el mapa</span>
                                                    </button>
                                                )}
                                            </div>
                                            <div className="relative pt-1">
                                                <button type="button" onClick={handleDetectLocation} disabled={detectingLoc} className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold text-[#FFFBEA] bg-[#6A3A30] border border-[#6A3A30] rounded-xl hover:bg-[#5a3128] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                                    {detectingLoc ? <><div className="w-3 h-3 rounded-full border-2 border-[#FFFBEA] border-t-transparent animate-spin" /> Detectando ubicacion...</> : <><Crosshair size={14} /> Detectar mi ubicacion actual</>}
                                                </button>
                                                {locError && <div className="absolute top-0 left-0 w-full h-full bg-primary-50 border border-primary-100 rounded-xl flex items-center justify-center animate-in fade-in zoom-in duration-200"><span className="text-[10px] font-bold text-primary-600 px-2 text-center">{locError}</span></div>}
                                                {showLocTooltip && (
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-800 text-white text-[10px] font-medium rounded-lg shadow-xl animate-in zoom-in-95 duration-200 z-10 whitespace-nowrap">
                                                        Usamos tu GPS para mayor precision
                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-800" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-1.5 pt-2">
                                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Direcciones Pick up</label>
                                            <div className="rounded-xl border border-[#6A3A30]/10 bg-[#FFFBEA] px-4 py-3">
                                                <div className="flex items-center gap-2 text-[11px] font-black text-[#6A3A30]">
                                                    <Store size={14} />
                                                    Direcciones disponibles para Pick up
                                                </div>
                                                {pickupLocationsLoading ? (
                                                    <div className="mt-3 flex items-center gap-2 text-[11px] font-medium text-[#6A3A30]/60">
                                                        <Loader2 size={13} className="animate-spin" />
                                                        Cargando direcciones...
                                                    </div>
                                                ) : pickupLocations.length > 0 ? (
                                                    <div className="mt-3 space-y-2">
                                                        {pickupLocations.map((loc, idx) => (
                                                            <div key={loc.id} className="rounded-lg border border-[#6A3A30]/10 bg-white px-3 py-2 text-xs font-semibold text-[#6A3A30]/85">
                                                                <span className="mr-1 text-[#6A3A30]/50">{idx + 1}.</span>
                                                                {loc.description}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="mt-3 text-[11px] font-medium text-[#6A3A30]/60">
                                                        No hay direcciones de pick up configuradas.
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    <div className="pt-4 flex gap-3">
                                        <button type="button" onClick={() => setCheckoutOpen(false)} className="flex-1 py-4 text-slate-400 font-bold text-sm hover:text-slate-600 transition-colors bg-slate-50 rounded-xl">Cancelar</button>
                                        <button
                                            type="submit"
                                            disabled={loading || !isOpen}
                                            className="flex-[2] h-14 bg-[#6A3A30] text-[#FFFBEA] rounded-xl font-bold text-lg hover:bg-[#5a3128] active:scale-95 transition-all flex items-center justify-center gap-2 shadow-xl shadow-[#6A3A30]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {loading ? <Loader2 className="animate-spin" /> : isOpen ? "Confirmar" : "Cerrado"}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>

                    {/* If map active, render specialized small modal? Or override styles? 
               Since I cannot easily override LocationModal styles (it has fixed inset-0), 
               I will wrap it in a div that transforms it? No, fixed positioning is relative to viewport.
               
               Workaround: Render specific `LocationModal` that supports `inline` OR `className`.
               But looking at previous step, I only added `publicMode`.
               
               Let's modify `LocationModal.tsx` AGAIN to accept `className` for the outer container?
               User said "no despliegues el mapa en pantalla completa".
               If I open `LocationModal`, it IS full screen.
               I MUST modify `LocationModal` to be adaptable or allow it to be contained.
               
               Or... I can render `DeliveryMap` directly here in `isMapLocatorActive` block.
               `DeliveryMap` provides the map. Logic for search/locate is in `LocationModal`.
               Copying that logic is redundant.
               
               Let's do this: 
               1. Modify LocationModal to accept `containerClass` and remove `fixed inset-0` if provided.
           */}
                </div>
            )}

            {/* Location Modal for inline usage needs style override. 
          See plan updates. 
      */}


            {/* Hours Modal (Same as before) omitted */}
            {hoursModalOpen && (
                // ... omitted standard hours modal code for brevity ...
                <div className="fixed inset-0 z-[90] flex items-center justify-center p-6 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setHoursModalOpen(false)} />
                    <div className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-black text-slate-900">Horarios</h3>
                            <button onClick={() => setHoursModalOpen(false)} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition-colors"><X size={16} /></button>
                        </div>
                        {/* ... content ... */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center py-2 border-b border-slate-50">
                                <span className="font-medium text-slate-500">Lunes - Domingo</span>
                                <span className="font-bold text-slate-900">{formatTime12h(businessStatus.startHour)} - {formatTime12h(businessStatus.endHour)}</span>
                            </div>
                        </div>
                        <div className={`mt-6 flex items-start gap-3 p-4 rounded-xl text-sm ${isOpen ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'}`}>
                            {isOpen ? <Info size={18} className="shrink-0 mt-0.5" /> : <X size={18} className="shrink-0 mt-0.5" />}
                            <p className="font-medium leading-tight">Actualmente estamos <b>{isOpen ? "Abiertos" : "Cerrados"}</b>. ¡Te esperamos!</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
