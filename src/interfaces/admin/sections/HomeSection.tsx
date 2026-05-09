import { DollarSign, Users, Tag, CheckCircle2, ShoppingBag, Clock, Power, Save, Loader2, Ticket, ChevronRight, Database, RefreshCw, HardDrive, Activity, MapPin, Plus, Trash2 } from "lucide-react"
import { API_URL } from "../../../api/config"
import { useState, useEffect, type FormEvent } from "react"
import type { PaymentTicket, PickupLocation } from "../../../types/app"
import { formatVesLabel, getCurrencyAmounts, resolveHistoricalExchangeRate } from "../../../utils/currency"

type HomeSectionProps = {
    monthlyRevenueEquivalentUsd: number
    monthlyRevenueUsd: number
    monthlyRevenueVes: number
    registeredUsers: number
    availableCoupons: number
    usedCoupons: number
    formatMoney: (value: number | string | undefined | null) => string
    setAdminTab: (tab: any) => void
    pendingTickets: PaymentTicket[]
    onViewTicket: (ticket: PaymentTicket) => void
    exchangeRate: number
    confirmingTickets?: Set<number>
    apiStatus?: {
        ok: boolean
        rate: number
        lastCheck: string
    }
}



export default function HomeSection({
    monthlyRevenueEquivalentUsd,
    monthlyRevenueUsd,
    monthlyRevenueVes,
    registeredUsers,
    availableCoupons,
    usedCoupons,
    formatMoney,
    setAdminTab,
    pendingTickets,
    onViewTicket,
    exchangeRate,
    confirmingTickets,
    apiStatus
}: HomeSectionProps) {

    const formatBsFromTicket = (ticket: PaymentTicket) => {
        const rate = resolveHistoricalExchangeRate(ticket.exchangeRate ?? null, exchangeRate, ticket.exchangeRateDate ?? ticket.createdAt)
        const amounts = getCurrencyAmounts(ticket.amount, ticket.currency, rate)
        return amounts.ves !== null ? formatVesLabel(amounts.ves) : "---"
    }

    const formatUsdFromTicket = (ticket: PaymentTicket) => {
        const rate = resolveHistoricalExchangeRate(ticket.exchangeRate ?? null, exchangeRate, ticket.exchangeRateDate ?? ticket.createdAt)
        const amounts = getCurrencyAmounts(ticket.amount, ticket.currency, rate)
        return amounts.usd !== null ? formatMoney(amounts.usd) : formatMoney(ticket.amount)
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header / Welcome */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Inicio</h2>
                    <p className="text-sm text-slate-500 font-medium">Resumen de actividad y tareas pendientes</p>
                </div>

                {/* Redesigned Compact POS Button */}
                <button
                    onClick={() => setAdminTab("register")}
                    className="w-full md:w-auto bg-primary-600 hover:bg-primary-700 text-white px-6 py-3.5 rounded-2xl shadow-lg shadow-primary-200/50 transition-all flex items-center justify-center gap-4 active:scale-[0.98] group"
                >
                    <div className="bg-white/20 p-2 rounded-xl text-white group-hover:bg-white/30 transition-colors">
                        <ShoppingBag size={24} strokeWidth={2.5} />
                    </div>
                    <div className="text-left">
                        <p className="text-xs font-bold leading-none mb-1 opacity-90">Nueva Venta</p>
                        <p className="text-lg font-black leading-none tracking-tight">Ir a la Caja</p>
                    </div>
                    <div className="bg-white/10 rounded-full p-1 ml-2 group-hover:translate-x-1 transition-transform">
                        <ChevronRight size={20} />
                    </div>
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white p-3 rounded-2xl border border-slate-100 flex flex-col justify-between min-h-32 group hover:shadow-md transition-all">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 shadow-sm flex items-center justify-center text-secondary-600 mb-1 group-hover:scale-105 transition-transform">
                        <DollarSign size={16} />
                    </div>
                    <div>
                        <div className="flex flex-col gap-0.5">
                            <span className="text-lg font-bold text-slate-900 tracking-tight leading-none">{formatMoney(monthlyRevenueEquivalentUsd)}</span>
                            <span className="text-[11px] font-semibold text-slate-500 leading-none">USD nativo: {formatMoney(monthlyRevenueUsd)}</span>
                            <span className="text-[11px] font-semibold text-slate-500 leading-none">VES nativo: {formatVesLabel(monthlyRevenueVes)}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium px-0.5 mt-2">Total equivalente USD del mes</p>
                    </div>
                </div>

                <div className="bg-white p-3 rounded-2xl border border-slate-100 flex flex-col justify-between h-24 group hover:shadow-md transition-all">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 shadow-sm flex items-center justify-center text-primary-600 mb-1 group-hover:scale-105 transition-transform">
                        <Users size={16} />
                    </div>
                    <div>
                        <span className="text-xl font-bold text-slate-900 tracking-tight">{registeredUsers}</span>
                        <p className="text-[10px] text-slate-500 font-medium px-0.5">Usuarios registrados</p>
                    </div>
                </div>

                <div className="bg-white p-3 rounded-2xl border border-slate-100 flex flex-col justify-between h-24 group hover:shadow-md transition-all">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 shadow-sm flex items-center justify-center text-gold mb-1 group-hover:scale-105 transition-transform">
                        <Tag size={16} />
                    </div>
                    <div>
                        <span className="text-xl font-bold text-slate-900 tracking-tight">{availableCoupons}</span>
                        <p className="text-[10px] text-slate-500 font-medium px-0.5">Generados y sin canjear</p>
                    </div>
                </div>

                <div className="bg-white p-3 rounded-2xl border border-slate-100 flex flex-col justify-between h-24 group hover:shadow-md transition-all">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 shadow-sm flex items-center justify-center text-slate-brand mb-1 group-hover:scale-105 transition-transform">
                        <CheckCircle2 size={16} />
                    </div>
                    <div>
                        <span className="text-xl font-bold text-slate-900 tracking-tight">{usedCoupons}</span>
                        <p className="text-[10px] text-slate-500 font-medium px-0.5">Cupones canjeados</p>
                    </div>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Pending Orders Column (Takes 2 cols) */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <Ticket size={20} className="text-primary-600" /> Pedidos Pendientes
                            {pendingTickets.length > 0 && (
                                <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-black border border-amber-200">
                                    {pendingTickets.length}
                                </span>
                            )}
                        </h3>
                        <button onClick={() => setAdminTab("tickets")} className="text-xs font-bold text-slate-500 hover:text-primary-600 transition-colors">
                            Ver todos
                        </button>
                    </div>

                    <div className="bg-white rounded-[1.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[300px] flex flex-col">
                        {pendingTickets.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center opacity-50">
                                <CheckCircle2 size={48} className="text-slate-300 mb-2" />
                                <p className="text-slate-500 font-medium text-sm">Todo al dÃ­a</p>
                                <p className="text-slate-400 text-xs">No hay tickets pendientes de revisiÃ³n</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-50">
                                {pendingTickets.slice(0, 5).map((ticket) => (
                                    <div key={ticket.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4 group cursor-pointer" onClick={() => onViewTicket(ticket)}>
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs shrink-0 border border-amber-100">
                                                #{ticket.id}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-slate-900 text-sm truncate">{ticket.customerName || "Cliente"}</p>
                                                <p className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                                                    <Clock size={10} />
                                                    {new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    <span className="mx-1">â€¢</span>
                                                    {(ticket.currency || "USD").toUpperCase()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="font-black text-slate-800 text-sm">{formatBsFromTicket(ticket)}</p>
                                            <p className="text-[10px] font-bold text-slate-400">({formatUsdFromTicket(ticket)} USD)</p>
                                            {confirmingTickets?.has(Number(ticket.id)) && (
                                                <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 text-[10px] font-bold">
                                                    <Loader2 size={10} className="animate-spin" />
                                                    Confirmando...
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {pendingTickets.length > 5 && (
                                    <div className="p-3 text-center bg-slate-50/50">
                                        <button onClick={() => setAdminTab("tickets")} className="text-xs font-bold text-slate-500 hover:text-primary-600 transition-colors">
                                            +{pendingTickets.length - 5} mÃ¡s pendientes...
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Business Status & Quick Actions if any */}
                <div className="space-y-6">
                    <BusinessStatusCard />
                    <PickupLocationsCard />
                    <SystemPerformanceCard apiStatus={apiStatus} />




                </div>
            </div>
        </div>
    )
}

function BusinessStatusCard() {
    const [status, setStatus] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const res = await fetch(`${API_URL}/loyalty/public/business-status`)
                const data = await res.json()
                setStatus(data)
            } catch (e) { console.error(e) }
            finally { setLoading(false) }
        }
        fetchStatus()
    }, [])

    const handleUpdate = async (updates: any) => {
        setSaving(true)
        try {
            const stored = localStorage.getItem("loyalty-auth")
            const token = stored ? JSON.parse(stored).token : null
            const res = await fetch(`${API_URL}/loyalty/admin/business-status`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(updates)
            })
            if (!res.ok) throw new Error("Error updating status")
            const updated = await res.json()
            setStatus(updated)
        } catch (e) {
            console.error(e)
            alert("No se pudo actualizar el estado del negocio")
        } finally {
            setSaving(false)
        }
    }

    if (loading) return (
        <div className="bg-white rounded-[1.5rem] p-6 border border-slate-100 shadow-sm flex flex-col justify-center items-center h-full min-h-[200px]">
            <Loader2 className="animate-spin text-slate-300" size={32} />
        </div>
    )

    if (!status) return null

    return (
        <div className="bg-white rounded-[1.5rem] p-6 border border-slate-100 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-900 border border-slate-100">
                        <Clock size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 leading-tight">Estado del Negocio</h3>

                    </div>
                </div>
                <button
                    onClick={() => handleUpdate({ isForcedClosed: !status.isForcedClosed })}
                    className={`h-9 px-4 rounded-xl font-bold text-xs flex items-center gap-2 transition-all border ${status.isForcedClosed
                        ? 'bg-primary-50 text-primary-600 border-primary-200 hover:bg-primary-100 hover:border-primary-300'
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700'
                        }`}
                >
                    <Power size={14} />
                    {status.isForcedClosed ? "Abrir Negocio" : "Cerrar Negocio"}
                </button>
            </div>

            <div className="space-y-4 flex-1">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Apertura</label>
                        <input
                            type="time"
                            className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold outline-none focus:ring-2 focus:ring-primary-500/10"
                            value={status.startHour}
                            onChange={(e) => setStatus({ ...status, startHour: e.target.value })}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Cierre</label>
                        <input
                            type="time"
                            className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold outline-none focus:ring-2 focus:ring-primary-500/10"
                            value={status.endHour}
                            onChange={(e) => setStatus({ ...status, endHour: e.target.value })}
                        />
                    </div>
                </div>


            </div>

            <button
                onClick={() => handleUpdate({ startHour: status.startHour, endHour: status.endHour })}
                disabled={saving}
                className="w-full mt-5 h-12 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-900/10 disabled:opacity-50"
            >
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                Guardar Horarios
            </button>
        </div>
    )
}

function PickupLocationsCard() {
    const [locations, setLocations] = useState<PickupLocation[]>([])
    const [description, setDescription] = useState("")
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const readToken = () => {
        try {
            const stored = localStorage.getItem("loyalty-auth")
            return stored ? JSON.parse(stored).token : null
        } catch {
            return null
        }
    }

    const readErrorMessage = async (res: Response, fallback: string) => {
        try {
            const data = await res.json()
            const message = Array.isArray(data?.message) ? data.message.join(", ") : data?.message
            return typeof message === "string" && message.trim() ? message : fallback
        } catch {
            try {
                const text = await res.text()
                return text?.trim() || fallback
            } catch {
                return fallback
            }
        }
    }

    const fetchLocations = async () => {
        setLoading(true)
        try {
            const token = readToken()
            if (!token) throw new Error("Sesion expirada. Inicia sesion de nuevo.")
            const res = await fetch(`${API_URL}/loyalty/admin/pickup-locations`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            if (!res.ok) throw new Error(await readErrorMessage(res, "Error loading pickup locations"))
            const data = await res.json()
            setLocations(Array.isArray(data) ? data : [])
        } catch (e) {
            console.error(e)
            setLocations([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchLocations()
    }, [])

    const handleAdd = async (e: FormEvent) => {
        e.preventDefault()
        const normalized = description.trim()
        if (!normalized || saving) return

        setSaving(true)
        try {
            const token = readToken()
            if (!token) throw new Error("Sesion expirada. Inicia sesion de nuevo.")
            const res = await fetch(`${API_URL}/loyalty/admin/pickup-locations`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ description: normalized }),
            })
            if (!res.ok) throw new Error(await readErrorMessage(res, "Error adding pickup location"))
            const created = await res.json()
            setLocations(prev => [...prev, created])
            setDescription("")
        } catch (e: any) {
            console.error(e)
            alert(e?.message ? `No se pudo guardar la direccion de pick up: ${e.message}` : "No se pudo guardar la direccion de pick up")
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!id || deletingId) return
        setDeletingId(id)
        try {
            const token = readToken()
            if (!token) throw new Error("Sesion expirada. Inicia sesion de nuevo.")
            const res = await fetch(`${API_URL}/loyalty/admin/pickup-locations/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            })
            if (!res.ok) throw new Error(await readErrorMessage(res, "Error deleting pickup location"))
            setLocations(prev => prev.filter(loc => loc.id !== id))
        } catch (e: any) {
            console.error(e)
            alert(e?.message ? `No se pudo eliminar la direccion: ${e.message}` : "No se pudo eliminar la direccion")
        } finally {
            setDeletingId(null)
        }
    }

    if (loading) return (
        <div className="bg-white rounded-[1.5rem] p-6 border border-slate-100 shadow-sm flex flex-col justify-center items-center min-h-[180px]">
            <Loader2 className="animate-spin text-slate-300" size={28} />
        </div>
    )

    return (
        <div className="bg-white rounded-[1.5rem] p-6 border border-slate-100 shadow-sm flex flex-col gap-4">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100">
                    <MapPin size={18} />
                </div>
                <div>
                    <h3 className="font-bold text-slate-900 leading-tight">Direcciones Pick up</h3>
                    <p className="text-[11px] font-medium text-slate-500">Se muestran en cliente y guest</p>
                </div>
            </div>

            <form onSubmit={handleAdd} className="flex items-center gap-2">
                <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ej: Retiro en Av. Principal #12"
                    maxLength={400}
                    className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-semibold outline-none focus:ring-2 focus:ring-primary-500/10"
                />
                <button
                    type="submit"
                    disabled={saving || !description.trim()}
                    className="h-11 px-3 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    aria-label="Agregar direcciÃ³n de pick up"
                    title="Agregar direcciÃ³n"
                >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                </button>
            </form>

            <div className="space-y-2">
                {locations.length === 0 ? (
                    <p className="text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-100 px-3 py-2">
                        No hay direcciones de pick up registradas.
                    </p>
                ) : (
                    locations.map((loc, idx) => (
                        <div key={loc.id} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                            <p className="text-xs font-semibold text-slate-700 flex-1 min-w-0 break-words">
                                <span className="text-slate-400 mr-1">{idx + 1}.</span>{loc.description}
                            </p>
                            <button
                                type="button"
                                onClick={() => handleDelete(loc.id)}
                                disabled={deletingId === loc.id}
                                className="h-8 w-8 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                aria-label="Eliminar direcciÃ³n"
                                title="Eliminar direcciÃ³n"
                            >
                                {deletingId === loc.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

function SystemPerformanceCard({ apiStatus }: { apiStatus?: { ok: boolean, rate: number, lastCheck: string } }) {
    const [activeTab, setActiveTab] = useState<'supabase' | 'redis' | 'api'>('api')

    return (
        <div className="bg-white rounded-[1.5rem] p-6 border border-slate-100 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
                        <Activity size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 leading-tight">Rendimiento</h3>
                        <p className="text-[11px] font-medium text-slate-500 uppercase tracking-widest">Estado del Sistema</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex p-1 bg-slate-50 rounded-xl mb-6">
                <button
                    onClick={() => setActiveTab('api')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'api'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-400 hover:text-slate-600'
                        }`}
                >
                    <DollarSign size={14} /> DÃ³lar
                </button>
                <button
                    onClick={() => setActiveTab('supabase')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'supabase'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-400 hover:text-slate-600'
                        }`}
                >
                    <HardDrive size={14} /> DB
                </button>
                <button
                    onClick={() => setActiveTab('redis')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'redis'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-400 hover:text-slate-600'
                        }`}
                >
                    <Database size={14} /> Redis
                </button>
            </div>

            {activeTab === 'api' && <ApiStatsContent status={apiStatus} />}
            {activeTab === 'supabase' && <SupabaseStatsContent />}
            {activeTab === 'redis' && <RedisStatsContent />}
        </div>
    )
}

function ApiStatsContent({ status }: { status?: { ok: boolean, rate: number, lastCheck: string } }) {
    if (!status) return (
        <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="animate-spin text-slate-300 mb-2" size={24} />
            <p className="text-xs text-slate-400 font-medium">Verificando API...</p>
        </div>
    )

    const timeAgo = (date: string) => {
        try {
            const diff = Date.now() - new Date(date).getTime()
            const mins = Math.floor(diff / 60000)
            if (mins < 1) return 'Hace un momento'
            if (mins < 60) return `Hace ${mins} min`
            return `Hace ${Math.floor(mins / 60)} h`
        } catch { return '---' }
    }

    return (
        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                    <p className="text-xs text-slate-500 font-bold mb-1">Tasa Actual</p>
                    <p className="text-2xl font-black text-slate-900">Bs. {status.rate.toFixed(2)}</p>
                </div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${status.ok ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                    <Activity size={20} />
                </div>
            </div>

            <div className="mt-2 flex items-center justify-between text-[10px] font-medium text-slate-400 px-1">
                <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${status.ok ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse`}></div>
                    {status.ok ? 'API Online' : 'API Error'}
                </div>
                <span>{timeAgo(status.lastCheck)}</span>
            </div>
        </div>
    )
}

function SupabaseStatsContent() {
    const [stats, setStats] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    const fetchStats = async () => {
        setLoading(true)
        try {
            const stored = localStorage.getItem("loyalty-auth")
            const token = stored ? JSON.parse(stored).token : null
            const res = await fetch(`${API_URL}/loyalty/admin/supabase-stats`, {
                headers: { "Authorization": `Bearer ${token}` }
            })
            if (res.ok) {
                const data = await res.json()
                setStats(data)
            } else {
                setStats({ size_bytes: 0, egress_bytes: null })
            }
        } catch (e) {
            console.error("Supabase Stats Fetch Exception:", e)
            setStats({ size_bytes: 0, egress_bytes: null })
        }
        finally { setLoading(false) }
    }

    useEffect(() => {
        fetchStats()
    }, [])

    const formatBytes = (bytes: number) => {
        if (!bytes) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    if (!stats && loading) return (
        <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="animate-spin text-slate-300 mb-2" size={24} />
            <p className="text-xs text-slate-400 font-medium">Cargando mÃ©tricas...</p>
        </div>
    )

    // Helper for visual progress (assuming 500MB free tier limit)
    const LIMIT_MB = 500
    const sizeInMB = (stats?.size_bytes || 0) / (1024 * 1024)
    const percentage = Math.min((sizeInMB / LIMIT_MB) * 100, 100)

    return (
        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="flex justify-between items-end mb-2">
                    <div className="flex items-center gap-2 text-slate-500">
                        <HardDrive size={14} />
                        <p className="text-xs font-bold">Almacenamiento</p>
                    </div>
                    <p className="text-xl font-black text-slate-900">{formatBytes(stats?.size_bytes || 0)}</p>
                </div>
                {/* Progress Bar for Free Tier Context */}
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${percentage > 90 ? 'bg-red-500' : 'bg-emerald-500'}`}
                        style={{ width: `${percentage}%` }}
                    />
                </div>
                <p className="text-[10px] text-slate-400 mt-1 text-right">
                    {percentage.toFixed(1)}% de 500MB
                </p>
            </div>

            <div className="mt-4 flex items-center gap-2 text-[10px] font-medium text-slate-400 bg-slate-50/50 px-3 py-2 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                ConexiÃ³n Postgres Estable
            </div>
        </div>
    )
}

function RedisStatsContent() {
    const [stats, setStats] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    const fetchStats = async () => {
        setLoading(true)
        try {
            const stored = localStorage.getItem("loyalty-auth")
            const token = stored ? JSON.parse(stored).token : null
            const res = await fetch(`${API_URL}/loyalty/admin/redis-stats`, {
                headers: { "Authorization": `Bearer ${token}` }
            })
            if (res.ok) {
                const data = await res.json()
                setStats(data)
            } else {
                setStats({ used_memory: "Error", peak_memory: "Error", connected_clients: "Error" })
            }
        } catch (e) {
            console.error("Redis Stats Fetch Exception:", e)
            setStats({ used_memory: "Offline", peak_memory: "Offline", connected_clients: "Offline" })
        }
        finally { setLoading(false) }
    }

    useEffect(() => {
        fetchStats()
    }, [])

    if (!stats && loading) return (
        <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="animate-spin text-slate-300 mb-2" size={24} />
            <p className="text-xs text-slate-400 font-medium">Cargando mÃ©tricas...</p>
        </div>
    )

    return (
        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-xs text-slate-500 font-bold mb-1">En Uso</p>
                    <p className="text-lg font-black text-slate-900">{stats?.used_memory || '---'}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-xs text-slate-500 font-bold mb-1">Pico</p>
                    <p className="text-lg font-black text-slate-900">{stats?.peak_memory || '---'}</p>
                </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                    <p className="text-xs text-slate-500 font-bold mb-1">Clientes Conectados</p>
                    <p className="text-xl font-black text-slate-900">{stats?.connected_clients || '---'}</p>
                </div>
                <Users size={20} className="text-slate-300" />
            </div>

            <div className="mt-2 flex items-center justify-between text-[10px] font-medium text-slate-400 px-1">
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                    Redis Online
                </div>
                <button onClick={fetchStats} className="hover:text-primary-600 transition-colors">
                    <RefreshCw size={12} />
                </button>
            </div>
        </div>
    )
}


