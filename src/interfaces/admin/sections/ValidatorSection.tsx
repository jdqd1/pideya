import type { Dispatch, RefObject, SetStateAction } from "react"
import {
    AlertCircle,
    CheckCircle2,
    ShieldCheck,
    Tag,
    X,
    Zap,
    ArrowRight,
    Search
} from "lucide-react"
import type { CouponDto, CouponInspectResponse } from "../../../types/userState"
import type { ScannerState } from "../../../types/app"

export type ValidatorOverlayProps = {
    couponScanner: ScannerState
    setCouponScanner: Dispatch<SetStateAction<ScannerState>>
    inspectedCoupon: CouponInspectResponse | null
    setInspectedCoupon: Dispatch<SetStateAction<CouponInspectResponse | null>>
    setAdminCouponLookup: Dispatch<SetStateAction<{ code: string; status: string }>>
    formatCouponSubtitle: (coupon: CouponDto) => string
    getCouponStatusLabel: (status: CouponDto["status"]) => string
    handleRedeemCoupon: () => void | Promise<void>
    redeemingCoupon: boolean
    couponVideoRef: RefObject<HTMLVideoElement>
    adminCouponLookup: { code: string; status: string }
    handleInspectCoupon: (raw?: string) => void | Promise<void>
}

export default function ValidatorOverlay({
    couponScanner,
    setCouponScanner,
    inspectedCoupon,
    setInspectedCoupon,
    setAdminCouponLookup,
    formatCouponSubtitle,
    getCouponStatusLabel,
    handleRedeemCoupon,
    redeemingCoupon,
    couponVideoRef,
    adminCouponLookup,
    handleInspectCoupon,
}: ValidatorOverlayProps) {
    // --- LÓGICA INTACTA ---
    const formatUsedAt = (value?: string | null) => {
        if (!value) return null
        const date = new Date(value)
        if (Number.isNaN(date.getTime())) return null
        return date.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })
    }

    const levelState = inspectedCoupon?.progress?.levelState
    const level = levelState?.currentLevel
    const levelColor = level?.badge?.color || "#0ea5e9"
    const monthlyCoupons = level?.perks?.monthlyCoupons ?? []
    const monthlySummary = monthlyCoupons.length ? monthlyCoupons.map((pack) => `${pack.quantity}x ${pack.percent}%`).join(" + ") : null
    const monthlyExpiry = level?.perks?.monthlyCouponExpiryDays ?? 14

    const usedAtLabel =
        inspectedCoupon?.coupon.status === "used"
            ? formatUsedAt(inspectedCoupon.coupon.usedAt ?? null) ?? "Fecha no disponible"
            : null
    // --- FIN LÓGICA INTACTA ---

    if (!couponScanner.active && !inspectedCoupon) return null

    // Helpers de diseño para el Reskin
    const isAvailable = inspectedCoupon?.coupon.status === "available"

    // Paleta de colores minimalista basada en estado (Clean UI)
    const statusConfig = isAvailable
        ? {
            bg: "bg-secondary-50",
            iconBg: "bg-secondary-100",
            iconColor: "text-secondary-600",
            title: "text-secondary-900",
            border: "border-secondary-200",
            badge: "bg-secondary-100 text-secondary-700"
        }
        : {
            bg: "bg-red-50",
            iconBg: "bg-red-100",
            iconColor: "text-red-600",
            title: "text-red-900",
            border: "border-red-200",
            badge: "bg-red-100 text-red-700"
        }

    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-slate-100 font-sans text-slate-900 animate-in fade-in duration-300">

            {/* --- HEADER FLOTANTE (Minimalista) --- */}
            <div className="absolute top-0 left-0 right-0 z-50 px-4 py-4 md:py-6 pointer-events-none flex justify-between items-start">
                <div className="pointer-events-auto bg-white/90 backdrop-blur-xl shadow-sm border border-slate-200/60 rounded-full px-4 py-2.5 flex items-center gap-2.5">
                    <div className="bg-primary-600 rounded-full p-1">
                        <ShieldCheck className="text-white" size={14} strokeWidth={3} />
                    </div>
                    <div className="flex flex-col leading-none">
                        <span className="text-xs font-bold text-primary-900 tracking-wide">VALIDATOR</span>
                        <span className="text-[10px] font-medium text-slate-500">PRO MODE</span>
                    </div>
                </div>

                <button
                    onClick={() => {
                        setCouponScanner({ active: false, status: "", last: "" })
                        setInspectedCoupon(null)
                        setAdminCouponLookup({ code: "", status: "" })
                    }}
                    className="pointer-events-auto w-10 h-10 rounded-full bg-white/90 backdrop-blur-xl shadow-sm border border-slate-200/60 text-slate-400 hover:text-slate-900 hover:scale-105 active:scale-95 flex items-center justify-center transition-all"
                >
                    <X size={20} />
                </button>
            </div>

            {inspectedCoupon ? (
                /* =========================================
                   VISTA: RESULTADO (Clean Card Style)
                   ========================================= */
                <div className="flex-1 flex flex-col relative h-full overflow-hidden">

                    {/* Fondo decorativo superior */}
                    <div className={`h-[45%] w-full flex flex-col items-center justify-center transition-colors duration-500 relative overflow-hidden ${statusConfig.bg}`}>
                        {/* Patrón de fondo sutil */}
                        <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px]"></div>

                        <div className="relative z-10 flex flex-col items-center -mt-8 animate-in zoom-in-95 duration-300 slide-in-from-bottom-4">
                            <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center mb-5 shadow-lg shadow-black/5 ${statusConfig.iconBg}`}>
                                {isAvailable
                                    ? <CheckCircle2 size={40} className={statusConfig.iconColor} strokeWidth={2.5} />
                                    : <AlertCircle size={40} className={statusConfig.iconColor} strokeWidth={2.5} />
                                }
                            </div>
                            <h2 className={`text-2xl font-black tracking-tight text-center ${statusConfig.title}`}>
                                {isAvailable ? "CUPÓN VÁLIDO" : "NO CANJEABLE"}
                            </h2>
                            <span className={`mt-3 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${statusConfig.badge}`}>
                                {getCouponStatusLabel(inspectedCoupon.coupon.status)}
                            </span>
                        </div>
                    </div>

                    {/* Tarjeta de Información (Bottom Sheet) */}
                    <div className="flex-1 -mt-10 bg-white rounded-t-[2.5rem] shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] relative z-20 flex flex-col overflow-hidden">

                        {/* Handle visual */}
                        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-4 mb-2" />

                        <div className="flex-1 overflow-y-auto px-6 py-2 scrollbar-hide">
                            <div className="space-y-6 pt-2 pb-6">

                                {/* Título Cupón */}
                                <div className="text-center space-y-1">
                                    <h3 className="text-xl font-bold text-slate-900 leading-snug">
                                        {inspectedCoupon.coupon.title}
                                    </h3>
                                    <p className="text-slate-500 text-sm font-medium">
                                        {formatCouponSubtitle(inspectedCoupon.coupon)}
                                    </p>
                                </div>

                                {/* Lista de Detalles - Estilo iOS Settings */}
                                <div className="bg-slate-100 rounded-2xl border border-slate-100 overflow-hidden">
                                    {/* Propietario */}
                                    <div className="flex items-center justify-between p-4 border-b border-slate-100">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-400 shadow-sm">
                                                <ShieldCheck size={14} />
                                            </div>
                                            <span className="text-sm font-medium text-slate-500">Cliente</span>
                                        </div>
                                        <span className="text-sm font-semibold text-slate-900 truncate max-w-[140px]">
                                            {inspectedCoupon.owner?.email}
                                        </span>
                                    </div>

                                    {/* Nivel */}
                                    {level && (
                                        <div className="flex items-center justify-between p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-400 shadow-sm">
                                                    <Zap size={14} />
                                                </div>
                                                <span className="text-sm font-medium text-slate-500">Nivel</span>
                                            </div>
                                            <div className="flex items-center gap-2 px-2 py-1 bg-white rounded-lg border border-slate-100 shadow-sm">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: levelColor }} />
                                                <span className="text-xs font-bold text-slate-700 uppercase">{level.name}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Beneficios */}
                                {monthlySummary && (
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1">Beneficios Aplicables</h4>
                                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                                            <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-primary-900 rounded-xl shadow-lg shadow-primary-200">
                                                <div className="p-1.5 bg-primary-800 rounded-lg">
                                                    <Tag className="text-white" size={16} />
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-sm font-bold text-white leading-none">Cupones: {monthlySummary}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Vigencia {monthlyExpiry} dias · 1 por ticket</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Alerta de Uso */}
                                {usedAtLabel && (
                                    <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl flex items-start gap-3">
                                        <AlertCircle className="text-orange-500 shrink-0 mt-0.5" size={18} />
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-orange-700 uppercase mb-0.5">Ya utilizado</span>
                                            <span className="text-sm text-orange-600/80">{usedAtLabel}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer de Acciones */}
                        <div className="p-6 bg-white border-t border-slate-100 pb-8 safe-area-bottom">
                            <div className="flex flex-col gap-3">
                                {isAvailable && (
                                    <button
                                        onClick={handleRedeemCoupon}
                                        disabled={redeemingCoupon}
                                        className="w-full h-14 bg-primary-600 text-white font-bold text-base rounded-2xl hover:bg-primary-700 active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-xl shadow-primary-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {redeemingCoupon ? (
                                            <div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                                        ) : (
                                            <>
                                                <span>Confirmar Canje</span>
                                                <ArrowRight size={18} className="opacity-80" />
                                            </>
                                        )}
                                    </button>
                                )}

                                <button
                                    onClick={() => {
                                        setInspectedCoupon(null)
                                        setAdminCouponLookup({ code: "", status: "" })
                                        setCouponScanner({ active: true, status: "", last: "" })
                                    }}
                                    className="w-full py-3 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors flex items-center justify-center gap-2"
                                >
                                    Escanear otro código
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* =========================================
                   VISTA: SCANNER (Clean Viewport)
                   ========================================= */
                <div className="flex-1 flex flex-col relative bg-black">

                    {/* Viewport de Cámara */}
                    <div className="flex-1 relative overflow-hidden bg-black">
                        <video
                            ref={couponVideoRef}
                            className="w-full h-full object-cover opacity-60"
                            autoPlay
                            playsInline
                            muted
                        />

                        {/* Overlay Minimalista */}
                        <div className="absolute inset-0 flex items-center justify-center p-10">
                            <div className="w-full max-w-[300px] aspect-square relative">
                                {/* Marco Blanco Sutil */}
                                <div className="absolute inset-0 border-[3px] border-white/30 rounded-[2.5rem]" />
                                <div className="absolute inset-0 border-[3px] border-white rounded-[2.5rem] scale-[0.9] opacity-0 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]" />

                                {/* Esquinas de Enfoque */}
                                <div className="absolute top-0 left-0 w-8 h-8 border-l-4 border-t-4 border-white rounded-tl-2xl" />
                                <div className="absolute top-0 right-0 w-8 h-8 border-r-4 border-t-4 border-white rounded-tr-2xl" />
                                <div className="absolute bottom-0 left-0 w-8 h-8 border-l-4 border-b-4 border-white rounded-bl-2xl" />
                                <div className="absolute bottom-0 right-0 w-8 h-8 border-r-4 border-b-4 border-white rounded-br-2xl" />

                                <div className="absolute -bottom-16 left-0 right-0 text-center">
                                    <p className="text-white/90 font-medium text-sm drop-shadow-md">
                                        Enfoca el código QR
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Área de Input Manual (Blanca y Limpia) */}
                    <div className="bg-white rounded-t-[2.5rem] pt-8 pb-8 px-6 -mt-6 relative z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.2)]">
                        <div className="max-w-md mx-auto space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Search className="text-slate-400" size={16} />
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    Búsqueda Manual
                                </span>
                            </div>

                            <div className="flex gap-3">
                                <div className="flex-1 relative">
                                    <input
                                        className="w-full h-14 bg-[#6A3A30]/5 text-slate-900 font-mono text-lg font-medium rounded-2xl px-4 outline-none border-2 border-[#6A3A30]/10 focus:border-[#6A3A30]/30 focus:bg-white transition-all placeholder:text-slate-400 text-center uppercase tracking-widest"
                                        placeholder="XXX-XXX"
                                        value={adminCouponLookup.code}
                                        onChange={(e) => setAdminCouponLookup({ code: e.target.value, status: "" })}
                                    />
                                </div>
                                <button
                                    className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-all shadow-lg ${adminCouponLookup.code.length > 0
                                        ? "bg-primary-600 text-white hover:scale-105 active:scale-95 shadow-primary-300"
                                        : "bg-slate-100 text-slate-300 cursor-not-allowed"
                                        }`}
                                    onClick={() => handleInspectCoupon()}
                                    disabled={adminCouponLookup.code.length === 0}
                                >
                                    <ArrowRight size={24} />
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            )}
        </div>
    )
}
