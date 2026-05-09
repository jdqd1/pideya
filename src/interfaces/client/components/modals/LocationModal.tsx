import { useState, useEffect, useRef, useCallback } from "react"
import { Crosshair, MapPin, Search, X } from "lucide-react"
import type { DeliveryLocation } from "../../../../types/app"
import { DeliveryMap } from "../DeliveryMap"
import { canAutoRequestGeolocation, getGeolocationBlockReason } from "../../../../utils/geolocation"
import { fetchPlaceDetails, readAuthToken, reverseGeocode, searchPlaceSuggestions, type PlaceSuggestion } from "../../../../api/places"

type LocationModalProps = {
    open: boolean
    onClose: () => void
    onSave: (loc: DeliveryLocation) => void
    publicMode?: boolean
    inline?: boolean
    className?: string
    showSearch?: boolean
    initialLocation?: DeliveryLocation | null
    requireDetails?: boolean
}

export function LocationModal(props: LocationModalProps) {
    const {
        open,
        onClose,
        onSave,
        publicMode = false,
        showSearch = true,
        initialLocation = null,
        requireDetails = true
    } = props
    const [tempLoc, setTempLoc] = useState<DeliveryLocation | null>(null)
    const [details, setDetails] = useState({ name: "", villa: "", reference: "" })
    const [isFlying, setIsFlying] = useState(false)
    const [isLocating, setIsLocating] = useState(false)
    const [isEditingDetails, setIsEditingDetails] = useState(false)

    // --- Search State ---
    const [searchQuery, setSearchQuery] = useState("")
    const [isSearching, setIsSearching] = useState(false)
    const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    const sessionTokenRef = useRef<string>("")

    useEffect(() => {
        sessionTokenRef.current = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)
    }, [])

    useEffect(() => {
        if (open) {
            setTempLoc(initialLocation ?? null)
            setDetails({
                name: initialLocation?.name || "",
                villa: initialLocation?.villa || "",
                reference: initialLocation?.reference || ""
            })
            setSearchQuery("")
            setSuggestions([])
        }
    }, [open])

    useEffect(() => {
        if (!open) return
        if (!tempLoc && initialLocation) {
            setTempLoc(initialLocation)
        }
    }, [open, tempLoc, initialLocation])

    useEffect(() => {
        if (!showSearch) return
        const timer = setTimeout(() => {
            if (searchQuery.trim().length > 2) {
                handleSearch()
            } else {
                setSuggestions([])
            }
        }, 500)
        return () => clearTimeout(timer)
    }, [searchQuery, showSearch])

    const handleSearch = async () => {
        const query = searchQuery.trim()
        if (!query) {
            setSuggestions([])
            return
        }

        setIsSearching(true)
        try {
            const biasCenter = tempLoc ?? { lat: 10.4806, lng: -66.9036 }
            const locationBias = {
                circle: {
                    center: { latitude: biasCenter.lat, longitude: biasCenter.lng },
                    radius: 5000.0
                }
            }

            const token = publicMode ? "" : readAuthToken()
            const formatted = await searchPlaceSuggestions(query, {
                publicMode,
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
        setIsSearching(true)
        try {
            const token = publicMode ? "" : readAuthToken()
            const place = await fetchPlaceDetails(item.place_id, { publicMode, token })

            if (place.location) {
                const lat = place.location.latitude
                const lng = place.location.longitude

                setTempLoc({ lat, lng, source: "search" })
                sessionTokenRef.current = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)

                const smartName = place.displayName?.text || item.main_text
                const ref = place.formattedAddress || item.secondary_text || ""
                setDetails(prev => ({ ...prev, name: smartName, villa: ref, reference: "" }))
                setSearchQuery(smartName)
                setShowSuggestions(false)
            }

        } catch (err) {
            console.error("Details error", err)
        } finally {
            setIsSearching(false)
        }
    }

    const lastGeoCallRef = useRef<number>(0)
    const autoLocateAttemptedRef = useRef(false)
    const handleLocate = useCallback(() => {
        const blockReason = getGeolocationBlockReason()
        if (blockReason) return

        const thisCall = Date.now()
        lastGeoCallRef.current = thisCall
        setIsLocating(true)

        const validTimeout = 10000

        const handleSuccess = (pos: GeolocationPosition) => {
            if (lastGeoCallRef.current !== thisCall) return
            setIsLocating(false)
            setTempLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude, source: "gps" })
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

            if (isHighAccuracy && (err.code === 3 || err.code === 2)) {
                attempt(false, validTimeout)
                return
            }

            setIsLocating(false)
            // Aquí podríamos mostrar un error en UI si LocationModal tuviera un estado para ello,
            // pero actualmente no lo tiene visiblemente expuesto en el diseño original de la modal
            // salvo quizás un toast o alerta. Por ahora mantenemos la lógica base pero con reintentos.
            // Si el user lo pide, podemos agregar el mensaje de error explícito aquí también.
            console.warn("Geolocation error in LocationModal", err.message)
        }

        attempt(true, 5000)
    }, [])

    useEffect(() => {
        if (!tempLoc || tempLoc.source !== "manual") return

        const timer = setTimeout(async () => {
            try {
                // If it's a manual drag, we want to know what address this is
                const token = publicMode ? "" : readAuthToken()
                const data = await reverseGeocode(tempLoc.lat, tempLoc.lng, { publicMode, token })

                if (data.results && data.results.length > 0) {
                    // Filter out Plus Codes if possible, prefer street address or route
                    const validTypes = ["street_address", "route", "intersection", "premise", "sublocality", "neighborhood"]
                    const bestResult = data.results.find((r: any) =>
                        !r.types.includes("plus_code") &&
                        r.types.some((t: string) => validTypes.includes(t))
                    ) || data.results.find((r: any) => !r.types.includes("plus_code")) || data.results[0]

                    const address = bestResult.formatted_address
                    const route = bestResult.address_components?.find((c: any) => c.types.includes("route"))?.long_name
                    const streetNum = bestResult.address_components?.find((c: any) => c.types.includes("street_number"))?.long_name

                    const smartName = route ? (streetNum ? `${route} ${streetNum}` : route) : "Ubicación seleccionada"

                    setDetails(prev => ({
                        ...prev,
                        name: smartName,
                        villa: address,
                        reference: ""
                    }))

                    // Actually, let's try to be friendlier. 
                    // If we have a route name, use it as name? 
                    // "Ubicación en mapa" is safe.

                }
            } catch (err) {
                console.error("Reverse geocoding error", err)
            }
        }, 800) // Debounce

        return () => clearTimeout(timer)
    }, [tempLoc])

    useEffect(() => {
        if (!open) {
            autoLocateAttemptedRef.current = false
            return
        }
        if (autoLocateAttemptedRef.current) return
        if (initialLocation) {
            autoLocateAttemptedRef.current = true
            return
        }
        autoLocateAttemptedRef.current = true

        let cancelled = false

        const run = async () => {
            const canAutoLocate = await canAutoRequestGeolocation()
            if (!canAutoLocate || cancelled) return
            handleLocate()
        }

        run()

        return () => {
            cancelled = true
        }
    }, [open, handleLocate, initialLocation])

    const handleConfirmLocation = () => {
        if (!tempLoc) return
        if (!requireDetails) {
            onSave({
                ...tempLoc,
                name: details.name || "", // Preserve if they selected a place with name
                villa: details.villa || "",
                reference: details.reference || "",
                source: "manual",
                saved: false
            })
            return
        }
        setIsEditingDetails(true)
    }

    const handleSaveDetails = () => {
        if (!tempLoc) return
        onSave({
            ...tempLoc,
            name: details.name,
            villa: details.villa,
            reference: details.reference,
            source: "manual",
            saved: true
        })
    }

    return (
        <div className={props.className || `fixed inset-0 z-[200] transition-all duration-300 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
            {!props.inline && <div className="absolute inset-0 bg-[#6A3A30]/80 backdrop-blur-sm" onClick={onClose} />}
            <div className={props.inline ? "w-full h-full" : `absolute inset-0 flex items-center justify-center transition-all duration-500 p-0 ${open ? "scale-100" : "scale-95"}`}>
                <div className={`bg-[#FFFBEA] w-full flex flex-col transition-all duration-300 h-full ${props.inline ? "rounded-none shadow-none" : "rounded-none"}`}>
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-[#6A3A30]/10 flex items-center justify-between shrink-0 bg-[#FFFBEA] z-10">
                        <div>
                            <h3 className="text-xl font-black text-[#6A3A30]">{isEditingDetails ? "Detalles de Ubicación" : "Nueva Ubicación"}</h3>
                            <p className="text-xs font-medium text-[#6A3A30]/60">
                                {isEditingDetails ? "Completa la información de entrega" : "Selecciona en el mapa"}
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 bg-[#6A3A30]/5 rounded-full text-[#6A3A30]/50 hover:text-[#6A3A30]">
                            <X size={20} />
                        </button>
                    </div>


                    {!isEditingDetails ? (
                        <div className="flex-1 relative bg-[#AFC8BF] w-full h-full">
                            {/* Search Overlay */}
                            {showSearch && (
                                <div className="absolute top-4 left-4 right-4 z-[1100] max-w-md mx-auto">
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            {isSearching ? <div className="w-4 h-4 rounded-full border-2 border-[#6A3A30]/30 border-t-[#6A3A30] animate-spin" /> : <Search size={18} className="text-[#6A3A30]/50 group-focus-within:text-[#6A3A30] transition-colors" />}
                                        </div>
                                        <input
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            onFocus={() => {
                                                if (suggestions.length > 0) setShowSuggestions(true)
                                            }}
                                            placeholder="Buscar dirección (Ej: Plaza Altamira)"
                                            className="w-full bg-white shadow-xl rounded-2xl pl-11 pr-10 py-4 font-bold text-[#6A3A30] outline-none ring-0 placeholder:text-[#6A3A30]/30 text-sm"
                                            autoFocus={true}
                                        />
                                        {searchQuery && (
                                            <button
                                                onClick={() => { setSearchQuery(""); setSuggestions([]); }}
                                                className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#6A3A30]/30 hover:text-[#6A3A30]"
                                            >
                                                <X size={16} />
                                            </button>
                                        )}
                                    </div>

                                    {showSuggestions && suggestions.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-[#6A3A30]/10 overflow-hidden max-h-64 overflow-y-auto">
                                            {suggestions.map((item, i) => (
                                                <div
                                                    key={item.place_id || i}
                                                    onClick={() => handleSelectSuggestion(item)}
                                                    className="px-4 py-3 hover:bg-[#FFFBEA] cursor-pointer border-b border-[#6A3A30]/5 last:border-none flex items-center gap-3"
                                                >
                                                    <div className="p-2 rounded-full bg-[#FFFBEA] text-[#6A3A30]/50 shrink-0">
                                                        <MapPin size={16} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-[#6A3A30] truncate">{item.main_text}</p>
                                                        <p className="text-[11px] font-medium text-[#6A3A30]/60 truncate">{item.secondary_text}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            <DeliveryMap
                                selected={tempLoc}
                                onSelect={(coords) => {
                                    // Prevent update loops for micro-movements (drifting)
                                    if (tempLoc) {
                                        const dLat = Math.abs(tempLoc.lat - coords.lat)
                                        const dLng = Math.abs(tempLoc.lng - coords.lng)
                                        if (dLat < 0.0001 && dLng < 0.0001) return
                                    }
                                    setTempLoc({ ...coords, source: "manual" })
                                }}
                                onFlyStart={() => setIsFlying(true)}
                                onFlyEnd={() => setIsFlying(false)}
                            />

                            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 z-[1000] w-full px-6 max-w-lg">
                                <button
                                    onClick={handleLocate}
                                    className="bg-[#6A3A30] text-[#FFFBEA] p-4 rounded-2xl shadow-xl font-bold flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50"
                                    disabled={isFlying || isLocating}
                                >
                                    {isLocating ? <div className="w-5 h-5 rounded-full border-2 border-[#FFFBEA]/30 border-t-[#FFFBEA] animate-spin" /> : <Crosshair size={24} />}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmLocation}
                                    disabled={!tempLoc || isFlying || isLocating}
                                    className="flex-1 bg-[#6A3A30] text-[#FFFBEA] py-4 rounded-2xl font-black text-lg shadow-xl shadow-[#6A3A30]/20 hover:bg-[#5a3128] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:transform-none disabled:shadow-none"
                                >
                                    Confirmar Ubicación
                                </button>
                            </div>
                        </div>
                    ) : (
                        // Details Form Step
                        <div className="flex-1 overflow-y-auto bg-[#FFFBEA] p-6 flex flex-col items-center animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="w-full max-w-md bg-[#FFFBEA] rounded-[2rem] shadow-xl border border-[#6A3A30]/10 overflow-hidden">
                                <div className="relative h-32 bg-slate-200">
                                    <DeliveryMap selected={tempLoc} onSelect={() => { }} />
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#6A3A30]/70 to-transparent pointer-events-none" />
                                    <div className="absolute bottom-4 left-4 text-[#FFFBEA]">
                                        <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Ubicación seleccionada</p>
                                        <h4 className="font-black text-lg leading-tight">{details.name || "Ubicación en mapa"}</h4>
                                    </div>
                                </div>

                                <div className="p-6 space-y-5">
                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-bold text-[#6A3A30]/50 uppercase tracking-wider ml-1">Nombre de la ubicación <span className="text-[#1A864D]">*</span></label>
                                            <input
                                                value={details.name}
                                                onChange={(e) => setDetails(prev => ({ ...prev, name: e.target.value }))}
                                                placeholder="Ej: Casa, Oficina, Gimnasio"
                                                className="w-full bg-[#6A3A30]/5 border border-[#6A3A30]/10 rounded-xl px-4 py-3 font-bold text-[#6A3A30] outline-none focus:ring-2 focus:ring-[#6A3A30]/20 focus:border-[#6A3A30] transition-all placeholder:text-[#6A3A30]/30"
                                                autoFocus
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[11px] font-bold text-[#6A3A30]/50 uppercase tracking-wider ml-1">Dirección <span className="text-[#1A864D]">*</span></label>
                                            <input
                                                value={details.villa}
                                                onChange={(e) => setDetails(prev => ({ ...prev, villa: e.target.value }))}
                                                placeholder="Calle 21, Avenida 12, Residencia Los Pinos"
                                                className="w-full bg-[#6A3A30]/5 border border-[#6A3A30]/10 rounded-xl px-4 py-3 font-bold text-[#6A3A30] outline-none focus:ring-2 focus:ring-[#6A3A30]/20 focus:border-[#6A3A30] transition-all placeholder:text-[#6A3A30]/30"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[11px] font-bold text-[#6A3A30]/50 uppercase tracking-wider ml-1">Punto de referencia <span className="text-[#1A864D]">*</span></label>
                                            <input
                                                value={details.reference}
                                                onChange={(e) => setDetails(prev => ({ ...prev, reference: e.target.value }))}
                                                placeholder="Ej: Frente al centro comercial..."
                                                className="w-full bg-[#6A3A30]/5 border border-[#6A3A30]/10 rounded-xl px-4 py-3 font-bold text-[#6A3A30] outline-none focus:ring-2 focus:ring-[#6A3A30]/20 focus:border-[#6A3A30] transition-all placeholder:text-[#6A3A30]/30"
                                            />
                                        </div>
                                    </div>

                                    <div className="pt-4 flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsEditingDetails(false)}
                                            className="px-4 py-3 rounded-xl bg-[#6A3A30]/5 text-[#6A3A30]/60 font-bold hover:bg-[#6A3A30]/10 transition-colors"
                                        >
                                            Atrás
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSaveDetails}
                                            disabled={!details.name.trim() || !details.reference.trim()}
                                            className="flex-1 bg-[#6A3A30] text-[#FFFBEA] rounded-xl py-3 font-black shadow-lg shadow-[#6A3A30]/20 hover:bg-[#5a3128] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none"
                                        >
                                            Guardar Dirección
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div >
    )
}
