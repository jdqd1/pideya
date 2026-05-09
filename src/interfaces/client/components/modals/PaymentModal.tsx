import { useState, useEffect, useRef } from "react"
import type { Dispatch, SetStateAction } from "react"
import { Building2, X, Info, Smartphone, CheckCircle2, Search, MapPin, Crosshair, AlertCircle, Store, ChevronDown, ChevronUp, Loader2 } from "lucide-react"
import { LocationModal } from "./LocationModal"
import { DeliveryMap } from "../../components/DeliveryMap"
import { API_URL } from "../../../../api/config"
import type { DeliveryLocation, PaymentFormState, PaymentTicket, PickupLocation } from "../../../../types/app"
import { formatPhoneNumber } from "../../../../utils/format"
import { canAutoRequestGeolocation, getGeolocationBlockReason } from "../../../../utils/geolocation"
import type { LatLngLiteral } from "leaflet"
import { formatVesLabelFromUsd } from "../../../../utils/currency"
import { fetchPlaceDetails, readAuthToken, searchPlaceSuggestions, type PlaceSuggestion } from "../../../../api/places"

type PaymentModalProps = {
    open: boolean
    onClose: () => void
    amount: number
    points: number
    currency: string
    paymentForm: PaymentFormState
    onChange: Dispatch<SetStateAction<PaymentFormState>>
    onSubmit: () => void
    formatPrice: (value: number) => string
    deliveryMethod: "delivery" | "pickup"
    onDeliveryMethodChange: (method: "delivery" | "pickup") => void
    selectedLocation: DeliveryLocation | null
    savedLocations: DeliveryLocation[]
    savedPhones: string[]
    onSelectLocation: (coords: LatLngLiteral, source?: DeliveryLocation["source"]) => void
    onUseSavedLocation: (loc: DeliveryLocation) => void
    saveLocationPreference: boolean
    onToggleSaveLocationPreference: (next: boolean) => void
    loading?: boolean
    onUpdateLocation: (updates: Partial<DeliveryLocation>) => void
    exchangeRate?: number | null
    error?: string
    onSavePhone?: (phone: string) => Promise<void>
}

export function PaymentModal({
    open,
    onClose,
    amount,
    paymentForm,
    onChange,
    onSubmit,
    formatPrice,
    deliveryMethod,
    onDeliveryMethodChange,
    selectedLocation,
    saveLocationPreference,
    onToggleSaveLocationPreference,
    onSelectLocation,
    loading,
    onUpdateLocation,
    exchangeRate,
    error,
    savedPhones,
    onUseSavedLocation,
    onSavePhone,
    savedLocations,
}: PaymentModalProps) {
    // Default bank update
    const [method, setMethod] = useState<"pago_movil" | "efectivo">("pago_movil")
    const disabled = !paymentForm.phone.trim()
    const normalizePhone = (value: string) => value.replace(/\D/g, "")
    const savedPhoneOptions = savedPhones.reduce((acc, phone) => {
        const formatted = formatPhoneNumber(phone)
        const key = normalizePhone(formatted)
        if (!key || acc.some((item) => normalizePhone(item) === key)) return acc
        acc.push(formatted)
        return acc
    }, [] as string[])
    const selectedSavedPhone = savedPhoneOptions.find((phone) => normalizePhone(phone) === normalizePhone(paymentForm.phone))
    const showPhoneSelect = savedPhoneOptions.length > 0

    // Checkbox state for saving phone
    const [savePhone, setSavePhone] = useState(false)
    const canSavePhone = !selectedSavedPhone && paymentForm.phone.length > 10


    // Update form's bank field when method changes
    useEffect(() => {
        onChange(prev => ({ ...prev, bank: method === "efectivo" ? "EFECTIVO" : "Bancamiga (0172)" }))
    }, [method, onChange])

    const [isLocationModalOpen, setIsLocationModalOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [isSearching, setIsSearching] = useState(false)
    const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    const sessionTokenRef = useRef<string>("")
    const locationTouchedRef = useRef(false)
    const autoLocateCallRef = useRef(0)
    const lastGeoCallRef = useRef(0)
    const geoRetryTimeoutRef = useRef<number | null>(null)
    const geoClearTimeoutRef = useRef<number | null>(null)
    const [detectingLoc, setDetectingLoc] = useState(false)
    const [showLocTooltip, setShowLocTooltip] = useState(false)
    const [locError, setLocError] = useState<string | null>(null)

    const isSelectionRef = useRef(false)

    // UI Refactor State
    const [showPhoneOptions, setShowPhoneOptions] = useState(false)
    const [showLocationOptions, setShowLocationOptions] = useState(false)
    const [pickupLocations, setPickupLocations] = useState<PickupLocation[]>([])
    const [pickupLocationsLoading, setPickupLocationsLoading] = useState(false)

    // Lock body scroll
    useEffect(() => {
        if (open) {
            const originalStyle = window.getComputedStyle(document.body).overflow
            document.body.style.overflow = "hidden"
            return () => {
                document.body.style.overflow = originalStyle
            }
        }
    }, [open])

    // Map Locator Mode (for "Selecting on map" inside modal)
    // Actually we can just reuse generic LocationModal logic but maybe user wants it embedded?
    // GuestInterface embeds it. Here we have LocationModal separate.
    // Let's keep LocationModal usage but maybe preview it better.

    useEffect(() => {
        sessionTokenRef.current = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)
    }, [])

    useEffect(() => {
        if (!open) {
            setSearchQuery("")
            setSuggestions([])
            setShowSuggestions(false)
            locationTouchedRef.current = false
            autoLocateCallRef.current = 0
            lastGeoCallRef.current = 0
            setDetectingLoc(false)
            setShowLocTooltip(false)
            setLocError(null)
            setIsLocationModalOpen(false)
            if (geoRetryTimeoutRef.current !== null) {
                window.clearTimeout(geoRetryTimeoutRef.current)
                geoRetryTimeoutRef.current = null
            }
            if (geoClearTimeoutRef.current !== null) {
                window.clearTimeout(geoClearTimeoutRef.current)
                geoClearTimeoutRef.current = null
            }
        }
    }, [open])

    useEffect(() => {
        if (deliveryMethod === "delivery") return
        setSearchQuery("")
        setSuggestions([])
        setShowSuggestions(false)
        setIsLocationModalOpen(false)
        isSelectionRef.current = false
    }, [deliveryMethod])

    useEffect(() => {
        if (!open || deliveryMethod !== "pickup") return
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
    }, [open, deliveryMethod])

    useEffect(() => {
        if (!open || deliveryMethod !== "delivery") return
        if (locationTouchedRef.current || selectedLocation) return

        let cancelled = false
        let autoCallId = 0

        const run = async () => {
            // Ya no bloqueamos estrictamente si permissions API dice "prompt" (porque en iOS eso es lo normal)
            // Simplemente intentamos.
            const canAutoLocate = await canAutoRequestGeolocation()
            if (!canAutoLocate || cancelled || locationTouchedRef.current || selectedLocation) return

            autoCallId = Date.now()
            autoLocateCallRef.current = autoCallId
            const options = { enableHighAccuracy: true, timeout: 10000 }

            const successCallback = (pos: GeolocationPosition) => {
                if (autoLocateCallRef.current !== autoCallId) return
                if (locationTouchedRef.current) return
                onSelectLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }, "gps")
                onUpdateLocation({
                    name: "Mi ubicación actual",
                    address: "Detectada por GPS",
                    reference: "",
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
    }, [open, deliveryMethod, onSelectLocation, onUpdateLocation, selectedLocation])

    useEffect(() => {
        if (!open || deliveryMethod !== "delivery") return
        const timer = setTimeout(() => {
            if (isSelectionRef.current) {
                isSelectionRef.current = false
                return
            }
            if (searchQuery.trim().length > 2) {
                handleSearch()
            } else {
                setSuggestions([])
            }
        }, 450)
        return () => clearTimeout(timer)
    }, [searchQuery, open, deliveryMethod])

    const updateField = (key: keyof PaymentFormState, value: string) => {
        const nextValue = key === "documentType" ? (value as PaymentTicket["documentType"]) : value
        onChange((prev) => ({ ...prev, [key]: nextValue }))
    }

    const openMapLocator = () => {
        if (deliveryMethod !== "delivery") return
        setIsLocationModalOpen(true)
    }

    const handleSearch = async () => {
        if (deliveryMethod !== "delivery") return
        const query = searchQuery.trim()
        if (!query) {
            setSuggestions([])
            return
        }

        setIsSearching(true)
        try {
            const biasCenter = selectedLocation ?? { lat: 10.4806, lng: -66.9036 }
            const locationBias = {
                circle: {
                    center: { latitude: biasCenter.lat, longitude: biasCenter.lng },
                    radius: 5000.0,
                },
            }

            const token = readAuthToken()
            const formatted = await searchPlaceSuggestions(query, {
                publicMode: !token,
                token,
                locationBias,
                sessionToken: sessionTokenRef.current,
            })
            setSuggestions(formatted)
            setShowSuggestions(formatted.length > 0)
        } catch (err) {
            console.error("Search error", err)
            setSuggestions([])
        } finally {
            setIsSearching(false)
        }
    }

    const handleSelectSuggestion = async (item: PlaceSuggestion) => {
        if (deliveryMethod !== "delivery") return
        locationTouchedRef.current = true
        setIsSearching(true)
        try {
            const token = readAuthToken()
            const place = await fetchPlaceDetails(item.place_id, { publicMode: !token, token })

            if (place.location) {
                const lat = place.location.latitude
                const lng = place.location.longitude
                const smartName = place.displayName?.text || item.main_text
                const ref = place.formattedAddress || item.secondary_text || ""

                onSelectLocation({ lat, lng }, "search")
                onUpdateLocation({ name: smartName, reference: "", villa: ref, address: place.formattedAddress })



                setSearchQuery(smartName)
                isSelectionRef.current = true
                setShowSuggestions(false)
                setSuggestions([])
                sessionTokenRef.current = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)
            }
        } catch (err) {
            console.error("Details error", err)
        } finally {
            setIsSearching(false)
        }
    }

    const handleDetectLocation = () => {
        if (deliveryMethod !== "delivery") return
        const blockReason = getGeolocationBlockReason()
        if (blockReason) {
            if (geoRetryTimeoutRef.current !== null) {
                window.clearTimeout(geoRetryTimeoutRef.current)
                geoRetryTimeoutRef.current = null
            }
            if (geoClearTimeoutRef.current !== null) {
                window.clearTimeout(geoClearTimeoutRef.current)
                geoClearTimeoutRef.current = null
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

        let lastError: GeolocationPositionError | null = null

        if (geoRetryTimeoutRef.current !== null) {
            window.clearTimeout(geoRetryTimeoutRef.current)
            geoRetryTimeoutRef.current = null
        }
        if (geoClearTimeoutRef.current !== null) {
            window.clearTimeout(geoClearTimeoutRef.current)
            geoClearTimeoutRef.current = null
        }

        setDetectingLoc(true)
        setShowLocTooltip(true)
        setLocError(null)

        const handleSuccess = (pos: GeolocationPosition) => {
            if (lastGeoCallRef.current !== thisCall) return
            if (geoRetryTimeoutRef.current !== null) {
                window.clearTimeout(geoRetryTimeoutRef.current)
                geoRetryTimeoutRef.current = null
            }
            setDetectingLoc(false)
            setShowLocTooltip(false)
            setLocError(null)
            onSelectLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }, "gps")
            onUpdateLocation({
                name: "Mi ubicación actual",
                address: "Detectada por GPS",
                reference: "",
            })
        }

        const validTimeout = 10000

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

            // Si falló por timeout en alta precisión, intentamos baja precisión antes de rendirnos
            if (isHighAccuracy && (err.code === 3 || err.code === 2)) {
                attempt(false, validTimeout)
                return
            }

            setDetectingLoc(false)
            setShowLocTooltip(false)
            const errorCode = lastError?.code ?? err.code
            let message = "Error al detectar ubicación."

            if (errorCode === 1) {
                // Permission Denied
                // Detectar si es iOS (aproximación simple)
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
                if (isIOS) {
                    message = "Permiso denegado. Ve a Configuración > Privacidad > Localización y habilita el permiso para el navegador."
                } else {
                    message = "Permiso denegado. Habilita la ubicación en tu navegador."
                }
            }
            else if (errorCode === 2) message = "Ubicación no disponible."
            else if (errorCode === 3) message = "Tiempo de espera agotado. Intenta de nuevo."

            setLocError(message)
            geoClearTimeoutRef.current = window.setTimeout(() => {
                setLocError(current => current === message ? null : current)
            }, 6000) // Un poco más de tiempo para leer el mensaje largo
        }

        attempt(true, 5000)
    }

    return (
        <div className={`fixed inset-0 z-[85] transition-all duration-300 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
            <div className="absolute inset-0 hidden sm:block bg-[#6A3A30]/40 backdrop-blur-sm" onClick={loading ? undefined : onClose} />
            <div className="absolute inset-0 flex items-stretch sm:items-center justify-center p-0 sm:p-6 transition-all overflow-hidden sm:overflow-y-auto bg-[#FFFBEA] sm:bg-transparent">
                <div className="bg-[#FFFBEA] w-full h-[100dvh] sm:h-auto max-w-none sm:max-w-md rounded-none sm:rounded-[2rem] shadow-none sm:shadow-2xl overflow-hidden border-0 sm:border sm:border-[#6A3A30]/10 flex flex-col max-h-[100dvh] sm:max-h-[calc(100vh-3rem)]">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-[#6A3A30]/10">
                        <div>
                            <h3 className="text-xl font-black text-[#6A3A30]">Confirmar pago</h3>
                        </div>
                        <button onClick={onClose} disabled={loading} className="p-2 rounded-full bg-[#6A3A30]/5 text-[#6A3A30]/50 hover:bg-[#6A3A30]/10 hover:text-[#6A3A30] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            <X size={16} />
                        </button>
                    </div>

                    <div className="px-6 py-5 space-y-5 flex-1 overflow-y-auto">

                        {/* ... Total Card ... */}
                        <div className="rounded-2xl border border-[#6A3A30]/10 bg-[#FFFBEA] p-5 flex flex-col gap-4 shadow-sm shadow-[#6A3A30]/5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] font-black text-[#6A3A30]/40 uppercase tracking-widest mb-1 block">Total a Pagar</span>
                                    {exchangeRate ? (
                                        <div className="flex flex-col">
                                            <p className="text-2xl font-black text-[#6A3A30] tracking-tight">
                                                {formatVesLabelFromUsd(amount || 0, exchangeRate)}
                                            </p>
                                            <p className="text-xs font-bold text-[#6A3A30]/60">
                                                ≈ {formatPrice(amount)}
                                            </p>
                                        </div>
                                    ) : (
                                        <p className="text-3xl font-black text-[#6A3A30] tracking-tighter">
                                            {formatPrice(amount)}
                                        </p>
                                    )}
                                </div>
                                {exchangeRate && (
                                    <div className="text-right">
                                        <div className="px-3 py-1 bg-[#FFFBEA] rounded-lg border border-[#6A3A30]/10 shadow-sm inline-block">
                                            <span className="text-[10px] font-bold text-[#6A3A30]/40 uppercase tracking-wider block">Tasa BCV</span>
                                            <span className="text-sm font-black text-[#6A3A30]">{exchangeRate.toFixed(2)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ... Datos Negocio ... */}
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setMethod("pago_movil")}
                                    className={`relative overflow-hidden py-3 px-4 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${method === "pago_movil"
                                        ? "bg-[#6A3A30] border-[#6A3A30] text-[#FFFBEA] shadow-lg shadow-[#6A3A30]/20"
                                        : "bg-[#FFFBEA] border-[#6A3A30]/10 text-[#6A3A30]/60 hover:bg-[#6A3A30]/5 hover:border-[#6A3A30]/20"
                                        }`}
                                >
                                    <Smartphone size={20} className={method === "pago_movil" ? "text-[#FFFBEA]" : "text-[#6A3A30]/40"} />
                                    <span className="text-xs font-bold">Pago Móvil</span>
                                    {method === "pago_movil" && <div className="absolute inset-0 bg-white/10" />}
                                </button>
                                <button
                                    onClick={() => setMethod("efectivo")}
                                    className={`relative overflow-hidden py-3 px-4 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${method === "efectivo"
                                        ? "bg-[#6A3A30] border-[#6A3A30] text-[#FFFBEA] shadow-lg shadow-[#6A3A30]/20"
                                        : "bg-[#FFFBEA] border-[#6A3A30]/10 text-[#6A3A30]/60 hover:bg-[#6A3A30]/5 hover:border-[#6A3A30]/20"
                                        }`}
                                >
                                    <Building2 size={20} className={method === "efectivo" ? "text-[#FFFBEA]" : "text-[#6A3A30]/40"} />
                                    <span className="text-xs font-bold">Efectivo</span>
                                    {method === "efectivo" && <div className="absolute inset-0 bg-white/10" />}
                                </button>
                            </div>

                            {/* --- Payment Form Fields --- */}
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-[#6A3A30]/50 uppercase tracking-wider ml-1">
                                        Número de teléfono <span className="text-[#1A864D]">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            value={paymentForm.phone}
                                            onChange={(e) => updateField("phone", formatPhoneNumber(e.target.value))}
                                            placeholder="0412-123-4567"
                                            type="tel"
                                            autoComplete="off"
                                            maxLength={13}
                                            className="w-full bg-[#6A3A30]/5 border border-[#6A3A30]/10 rounded-xl px-4 py-3 font-bold text-[#6A3A30] outline-none focus:ring-2 focus:ring-[#6A3A30]/10 focus:border-[#6A3A30] transition-all placeholder:text-[#6A3A30]/30 pr-10"
                                        />
                                        {showPhoneSelect && (
                                            <button
                                                type="button"
                                                onClick={() => setShowPhoneOptions(!showPhoneOptions)}
                                                className="absolute right-0 top-0 bottom-0 px-3 flex items-center justify-center text-[#6A3A30]/40 hover:text-[#6A3A30] transition-colors"
                                            >
                                                {showPhoneOptions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            </button>
                                        )}
                                    </div>
                                    {showPhoneOptions && showPhoneSelect && (
                                        <div className="animate-in fade-in slide-in-from-top-2 duration-200 mt-2 rounded-xl border border-[#6A3A30]/10 bg-[#FFFBEA] overflow-hidden shadow-lg">
                                            {savedPhoneOptions.map((phone) => (
                                                <button
                                                    key={phone}
                                                    type="button"
                                                    onClick={() => {
                                                        updateField("phone", phone)
                                                        setShowPhoneOptions(false)
                                                    }}
                                                    className="w-full text-left px-4 py-3 text-xs font-bold text-[#6A3A30] hover:bg-[#6A3A30]/5 transition-colors border-b border-[#6A3A30]/5 last:border-none flex items-center justify-between"
                                                >
                                                    {phone}
                                                    {/* Removed extra indicator */}
                                                    {normalizePhone(paymentForm.phone) === normalizePhone(phone) && <CheckCircle2 size={12} className="text-[#1A864D]" />}
                                                </button>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    updateField("phone", "")
                                                    setShowPhoneOptions(false)
                                                    // Focus logic if needed, but simple clear is enough
                                                }}
                                                className="w-full text-left px-4 py-3 text-xs font-bold text-[#6A3A30]/60 hover:bg-[#6A3A30]/5 hover:text-[#6A3A30] transition-colors"
                                            >
                                                + Usar otro número
                                            </button>
                                        </div>
                                    )}
                                    {canSavePhone && (
                                        <div className="flex items-center gap-2 mt-2 px-1">
                                            <button
                                                type="button"
                                                role="checkbox"
                                                aria-checked={savePhone}
                                                onClick={() => setSavePhone(!savePhone)}
                                                className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${savePhone ? "bg-[#6A3A30] border-[#6A3A30]" : "border-[#6A3A30]/30 bg-transparent"
                                                    }`}
                                            >
                                                {savePhone && <CheckCircle2 size={10} className="text-white" />}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setSavePhone(!savePhone)}
                                                className="text-[10px] font-bold text-[#6A3A30]/70"
                                            >
                                                Guardar este número para futuros pedidos
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {method === "pago_movil" && (
                                    <div className="bg-[#6A3A30]/5 p-4 rounded-xl border border-[#6A3A30]/10 flex gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <Info size={18} className="text-[#6A3A30] shrink-0 mt-0.5" />
                                        <p className="text-xs text-[#6A3A30]/80 font-medium leading-relaxed">
                                            Al confirmar, se abrirá WhatsApp con los datos de tu pedido pre-cargados.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-1.5 pt-4 border-t border-[#6A3A30]/10">
                                <label className="text-[10px] font-bold text-[#6A3A30]/50 uppercase tracking-wider ml-1">
                                    Método de entrega <span className="text-[#1A864D]">*</span>
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => onDeliveryMethodChange("delivery")}
                                        className={`h-12 rounded-xl flex items-center justify-center gap-2 font-bold text-xs transition-all border-2 ${deliveryMethod === "delivery"
                                            ? "border-[#6A3A30] bg-[#6A3A30] text-[#FFFBEA]"
                                            : "border-[#6A3A30]/10 bg-[#FFFBEA] text-[#6A3A30]/60 hover:bg-[#6A3A30]/5"
                                            }`}
                                    >
                                        <MapPin size={16} />
                                        Delivery
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onDeliveryMethodChange("pickup")}
                                        className={`h-12 rounded-xl flex items-center justify-center gap-2 font-bold text-xs transition-all border-2 ${deliveryMethod === "pickup"
                                            ? "border-[#6A3A30] bg-[#6A3A30] text-[#FFFBEA]"
                                            : "border-[#6A3A30]/10 bg-[#FFFBEA] text-[#6A3A30]/60 hover:bg-[#6A3A30]/5"
                                            }`}
                                    >
                                        <Store size={16} />
                                        Pick up
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1.5 pt-4 border-t border-[#6A3A30]/10">
                                <label className="text-[10px] font-bold text-[#6A3A30]/50 uppercase tracking-wider ml-1">
                                    Ubicación de entrega {deliveryMethod === "delivery" && <span className="text-[#1A864D]">*</span>}
                                </label>

                                {deliveryMethod === "delivery" ? (
                                    <>
                                        <div className="space-y-2">
                                            <div className="relative">
                                                {/* Hidden Search Icon */}
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                                                    {isSearching ? (
                                                        <div className="w-3.5 h-3.5 rounded-full border-2 border-[#6A3A30]/30 border-t-[#6A3A30] animate-spin" />
                                                    ) : (
                                                        <Search size={14} className="text-[#6A3A30]/40" />
                                                    )}
                                                </div>

                                                <div className="relative">
                                                    <input
                                                        value={searchQuery}
                                                        onChange={(e) => setSearchQuery(e.target.value)}
                                                        onFocus={() => {
                                                            if (suggestions.length > 0) setShowSuggestions(true)
                                                        }}
                                                        placeholder="Buscar nueva ubicación"
                                                        className="w-full bg-[#6A3A30]/5 border border-[#6A3A30]/10 rounded-xl pl-9 pr-10 py-3 font-bold text-[#6A3A30] outline-none focus:ring-2 focus:ring-[#6A3A30]/10 focus:border-[#6A3A30] transition-all text-sm placeholder:text-[#6A3A30]/40"
                                                    />
                                                    {/* Dropdown Trigger for Saved Locations */}
                                                    {savedLocations.length > 0 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowLocationOptions(!showLocationOptions)}
                                                            className="absolute right-0 top-0 bottom-0 px-3 flex items-center justify-center text-[#6A3A30]/40 hover:text-[#6A3A30] transition-colors"
                                                        >
                                                            <ChevronDown size={16} />
                                                        </button>
                                                    )}
                                                    {/* Start Search Clear Button Override (Needs manual position adjustment if both buttons exist) */}
                                                    {searchQuery && !savedLocations.length && (
                                                        <button
                                                            onClick={() => { setSearchQuery(""); setSuggestions([]); setShowSuggestions(false) }}
                                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#6A3A30]/40 hover:text-[#6A3A30]"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Saved Locations Dropdown */}
                                                {showLocationOptions && savedLocations.length > 0 && (
                                                    <div className="animate-in fade-in slide-in-from-top-2 duration-200 mt-2 rounded-xl border border-[#6A3A30]/10 bg-[#FFFBEA] overflow-hidden shadow-lg z-20 relative">
                                                        {savedLocations.map((loc, idx) => (
                                                            <button
                                                                key={loc.id || idx}
                                                                type="button"
                                                                onClick={() => {
                                                                    onUseSavedLocation(loc)
                                                                    setShowLocationOptions(false)
                                                                }}
                                                                className="w-full text-left px-4 py-3 text-xs hover:bg-[#6A3A30]/5 transition-colors border-b border-[#6A3A30]/5 last:border-none group"
                                                            >
                                                                <p className="font-bold text-[#6A3A30] group-hover:text-[#6A3A30]">{loc.name}</p>
                                                                {loc.villa && <p className="text-[10px] text-[#6A3A30]/60">{loc.villa}</p>}
                                                            </button>
                                                        ))}
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setSearchQuery("")
                                                                setSuggestions([])
                                                                setShowSuggestions(false)
                                                                setIsLocationModalOpen(true)
                                                                setShowLocationOptions(false)
                                                            }}
                                                            className="w-full text-left px-4 py-3 text-xs font-bold text-[#6A3A30]/60 hover:bg-[#6A3A30]/5 hover:text-[#6A3A30] transition-colors"
                                                        >
                                                            + Usar nueva ubicación (Mapa)
                                                        </button>
                                                    </div>
                                                )}

                                            </div>
                                            {showSuggestions && suggestions.length > 0 && !showLocationOptions && (
                                                <div className="bg-[#FFFBEA] rounded-xl shadow-lg border border-[#6A3A30]/10 overflow-hidden max-h-56 overflow-y-auto">
                                                    {suggestions.map((item, i) => (
                                                        <div
                                                            key={item.place_id || i}
                                                            onClick={() => handleSelectSuggestion(item)}
                                                            className="px-3 py-2.5 hover:bg-[#FFFBEA] cursor-pointer border-b border-[#6A3A30]/5 last:border-none flex items-center gap-2"
                                                        >
                                                            <div className="p-1.5 rounded-full bg-[#FFFBEA] text-[#6A3A30]/60 shrink-0">
                                                                <MapPin size={14} />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-bold text-[#6A3A30] truncate">{item.main_text}</p>
                                                                <p className="text-[10px] font-medium text-[#6A3A30]/60 truncate">{item.secondary_text}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="h-48 w-full rounded-2xl overflow-hidden border border-[#6A3A30]/10 relative bg-[#FFFBEA]">
                                            {selectedLocation && !isLocationModalOpen ? (
                                                <div className="w-full h-full relative isolate">
                                                    <div className="absolute inset-0 pointer-events-none z-0">
                                                        <DeliveryMap selected={selectedLocation} onSelect={() => { }} />
                                                    </div>
                                                    <div className="absolute inset-x-0 bottom-0 bg-[#FFFBEA] p-3 border-t border-[#6A3A30]/10 flex items-center gap-3 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                                                        <div className="p-2 bg-[#6A3A30]/10 text-[#6A3A30] rounded-full shrink-0">
                                                            <MapPin size={18} className="fill-[#6A3A30]/20" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="font-bold text-[#6A3A30] text-xs truncate leading-tight">
                                                                {selectedLocation.name || "Ubicación en mapa"}
                                                            </p>
                                                            <p className="text-[10px] text-[#6A3A30]/60 truncate">
                                                                {selectedLocation.reference || selectedLocation.villa || selectedLocation.address || "Ubicación fijada"}
                                                            </p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={openMapLocator}
                                                            className="px-3 py-1.5 bg-[#6A3A30] text-[#FFFBEA] text-[10px] font-bold rounded-lg shadow-lg hover:bg-[#5a3128] transition-colors"
                                                        >
                                                            Cambiar
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : selectedLocation ? (
                                                <div className="w-full h-full flex items-center justify-center bg-[#f0f4f2] text-[#6A3A30]/40 text-xs font-bold">
                                                    Modificando ubicación...
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={openMapLocator}
                                                    className="w-full h-full bg-[#FFFBEA] hover:bg-white/50 transition-colors flex flex-col items-center justify-center gap-2 text-[#6A3A30]/40 hover:text-[#6A3A30] group"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-[#6A3A30]/5 shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform border border-[#6A3A30]/10">
                                                        <MapPin size={24} />
                                                    </div>
                                                    <span className="font-bold text-sm">Seleccionar en el mapa</span>
                                                    <span className="text-[10px] font-medium opacity-70">Toca para abrir el mapa</span>
                                                </button>
                                            )}
                                        </div>
                                        <div className="relative pt-1">
                                            <button
                                                type="button"
                                                onClick={handleDetectLocation}
                                                disabled={detectingLoc}
                                                className="w-full flex items-center justify-center gap-2 py-3 text-xs font-bold text-[#FFFBEA] bg-[#6A3A30] border border-[#6A3A30] rounded-xl shadow-lg shadow-[#6A3A30]/20 hover:bg-[#5a3128] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {detectingLoc ? (
                                                    <>
                                                        <div className="w-3 h-3 rounded-full border-2 border-[#1A864D] border-t-transparent animate-spin" />
                                                        Detectando ubicación...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Crosshair size={14} />
                                                        Detectar mi ubicación actual
                                                    </>
                                                )}
                                            </button>
                                            {locError && (
                                                <div className="absolute top-0 left-0 w-full h-full bg-rose-50 border border-rose-100 rounded-xl flex items-center justify-center animate-in fade-in zoom-in duration-200">
                                                    <span className="text-[10px] font-bold text-rose-600 px-2 text-center">{locError}</span>
                                                </div>
                                            )}
                                            {showLocTooltip && (
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-[#6A3A30] text-[#FFFBEA] text-[10px] font-medium rounded-lg shadow-xl animate-in zoom-in-95 duration-200 z-10 whitespace-nowrap">
                                                    Usamos tu GPS para mayor precisión
                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-[#6A3A30]" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between gap-3 rounded-xl border border-[#6A3A30]/10 bg-[#FFFBEA] px-3 py-2">
                                            <div className="min-w-0">
                                                <p className="text-[11px] font-bold text-[#6A3A30]">Guardar ubicación</p>
                                                <p className="text-[10px] text-[#6A3A30]/60">Disponible para futuras compras</p>
                                            </div>
                                            <button
                                                type="button"
                                                role="switch"
                                                aria-checked={saveLocationPreference}
                                                onClick={() => onToggleSaveLocationPreference(!saveLocationPreference)}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${saveLocationPreference ? "bg-[#1A864D]" : "bg-[#6A3A30]/20"}`}
                                            >
                                                <span
                                                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${saveLocationPreference ? "translate-x-5" : "translate-x-1"}`}
                                                />
                                            </button>
                                        </div>
                                    </>
                                ) : (
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
                                )}
                            </div>
                        </div>

                    </div>

                    <div className="px-6 pb-6 pt-4 bg-[#FFFBEA] shrink-0 z-50 border-t border-[#6A3A30]/5 max-sm:pb-8">
                        {error && (
                            <div className={`mb-3 px-4 py-3 rounded-xl flex items-start gap-3 border ${error.includes("Ticket enviado")
                                ? "bg-[#1A864D]/10 border-[#1A864D]/20"
                                : "bg-rose-50 border-rose-100"
                                }`}>
                                {error.includes("Ticket enviado") ? (
                                    <CheckCircle2 className="shrink-0 text-[#1A864D] mt-0.5" size={18} />
                                ) : (
                                    <AlertCircle className="shrink-0 text-rose-500 mt-0.5" size={18} />
                                )}
                                <p className={`text-xs font-bold ${error.includes("Ticket enviado") ? "text-[#1A864D]" : "text-rose-600"
                                    }`}>{error}</p>
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                if (savePhone && onSavePhone) {
                                    onSavePhone(paymentForm.phone)
                                }
                                onSubmit()
                            }}
                            disabled={loading || disabled}
                            className={`w-full flex items-center justify-center gap-2 text-[#FFFBEA] rounded-xl py-4 font-black text-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${disabled
                                ? "bg-[#6A3A30]/20 shadow-none text-[#6A3A30]/50"
                                : "bg-[#6A3A30] hover:bg-[#5a3128] shadow-xl shadow-[#6A3A30]/20"
                                }`}
                        >
                            {loading ? (
                                <>
                                    {/* Loop animation */}
                                    <div className="relative w-5 h-5">
                                        <div className="absolute inset-0 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                                    </div>
                                    <span>Procesando pedido...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={20} />
                                    <span>Confirmar pedido</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
                <LocationModal
                    open={isLocationModalOpen}
                    onClose={() => setIsLocationModalOpen(false)}
                    onSave={(loc) => {
                        onSelectLocation({ lat: loc.lat, lng: loc.lng }, "manual")
                        onUpdateLocation({
                            name: loc.name,
                            reference: loc.reference,
                            villa: loc.villa,
                            saved: loc.saved ?? false,
                        })
                        // Only toggle preference if user actually saved via the full form (implies explicit intent)
                        if (loc.saved) {
                            onToggleSaveLocationPreference(true)
                        }
                        setIsLocationModalOpen(false)
                    }}
                    showSearch={true}
                    initialLocation={selectedLocation}
                    requireDetails={saveLocationPreference}
                />
            </div >
        </div >
    )
}
