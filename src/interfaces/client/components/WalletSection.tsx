import { useMemo, useState } from "react"
import { ChevronUp, Gift, Percent, QrCode, Send, ShoppingBag, Ticket } from "lucide-react"
import type { CouponDto } from "../../../types/userState"
import { formatTimeLeft, isLevelCoupon } from "../utils"

type WalletSectionProps = {
    coupons: CouponDto[]
    formatCouponSubtitle: (coupon: CouponDto) => string
    getCouponStatusLabel: (status: CouponDto["status"]) => string
    openRedeemModal: (coupon: CouponDto) => void
    onUseCoupon: (coupon: CouponDto) => void
    onGiftClick: (coupon: CouponDto) => void
    giftingCouponId: string | null
}

export function WalletSection({
    coupons,
    formatCouponSubtitle,
    getCouponStatusLabel,
    openRedeemModal,
    onUseCoupon,
    onGiftClick,
    giftingCouponId,
}: WalletSectionProps) {
    const [isExpanded, setIsExpanded] = useState(false) // Default collapsed as per instruction
    const sortedCoupons = useMemo(() => {
        const statusRank: Record<CouponDto["status"], number> = { available: 0, expired: 1, used: 2 }

        return [...coupons].sort((a, b) => {
            const aLevel = isLevelCoupon(a)
            const bLevel = isLevelCoupon(b)

            const statusDiff = (statusRank[a.status] ?? 99) - (statusRank[b.status] ?? 99)
            if (statusDiff !== 0) return statusDiff

            if (a.status === "available" && b.status === "available") {
                if (aLevel && !bLevel) return -1
                if (!aLevel && bLevel) return 1
            }

            if (a.status === "used" && b.status === "used") {
                if (aLevel && !bLevel) return 1
                if (!aLevel && bLevel) return -1
            }

            return 0
        })
    }, [coupons])

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-[#6A3A30]/10 bg-[#FFFBEA] overflow-hidden">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full flex items-center justify-between p-4 bg-[#FFFBEA] hover:bg-[#6A3A30]/5 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-[#6A3A30] tracking-tight">Mis Cupones</h2>
                        <span className="px-3 py-1 bg-[#FFFBEA] border border-[#6A3A30]/10 rounded-full text-xs font-bold text-[#6A3A30]/60 shadow-sm">
                            {coupons.filter(c => c.status === 'available').length} activos
                        </span>
                    </div>
                    <ChevronUp
                        size={16}
                        className={`text-[#6A3A30]/40 transition-transform duration-300 ${isExpanded ? "" : "rotate-180"}`}
                    />
                </button>

                <div
                    className={`transition-all duration-300 ease-in-out ${isExpanded ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"
                        }`}
                >
                    <div className="p-4 pt-0">
                        {coupons.length === 0 ? (
                            <div className="border border-dashed border-[#6A3A30]/20 rounded-[2rem] p-10 flex flex-col items-center justify-center text-center opacity-70 bg-[#6A3A30]/5">
                                <div className="w-16 h-16 bg-[#FFFBEA] rounded-full flex items-center justify-center text-[#6A3A30]/30 mb-4 shadow-sm border border-[#6A3A30]/10">
                                    <Ticket size={32} />
                                </div>
                                <p className="font-bold text-[#6A3A30]">Aun no tienes cupones</p>
                                <p className="text-sm text-[#6A3A30]/60 mt-1 max-w-xs">Completa tu tarjeta de sellos escaneando productos para ganar premios.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
                                {sortedCoupons.map((coupon) => {
                                    const isAvailable = coupon.status === 'available'
                                    const isDiscount = coupon.kind === 'percent'
                                    const levelCoupon = isLevelCoupon(coupon)
                                    const timeLeft = coupon.status === 'available' ? formatTimeLeft(coupon.expiresAt) : null
                                    const expiryLabel = timeLeft
                                        ? (/^(expirado|sin|fecha)/i.test(timeLeft) ? timeLeft : `Expira en ${timeLeft}`)
                                        : null

                                    return (
                                        <div
                                            key={coupon.id}
                                            className={`relative flex flex-col gap-4 rounded-2xl border p-4 transition-all duration-300 ${levelCoupon
                                                ? "bg-emerald-50/40 border-emerald-100"
                                                : "bg-[#FFFBEA] border-[#6A3A30]/10"
                                                } ${isAvailable ? "shadow-[0_12px_30px_-20px_rgba(106,58,48,0.15)] hover:shadow-[0_18px_40px_-24px_rgba(106,58,48,0.25)]" : "opacity-60 grayscale"}`}
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="space-y-2">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${isAvailable ? "bg-[#1A864D]/10 text-[#1A864D]" : "bg-slate-100 text-slate-500"
                                                            }`}>
                                                            {getCouponStatusLabel(coupon.status)}
                                                        </span>
                                                        {levelCoupon && (
                                                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100/70 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700">
                                                                <Ticket size={10} />
                                                                Cupon de nivel
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h3 className="font-bold text-[#6A3A30] text-sm leading-tight line-clamp-2">{coupon.title}</h3>
                                                </div>
                                                <div className="flex flex-col items-end gap-2">
                                                    <div className={`w-9 h-9 rounded-2xl flex items-center justify-center ${isDiscount ? "bg-violet-50 text-violet-600" : "bg-amber-50 text-amber-600"
                                                        }`}>
                                                        {isDiscount ? <Percent size={14} /> : <Gift size={14} />}
                                                    </div>
                                                    {isAvailable && (
                                                        <button
                                                            type="button"
                                                            onClick={() => openRedeemModal(coupon)}
                                                            className="inline-flex items-center gap-1 rounded-full border border-[#6A3A30]/10 bg-[#FFFBEA] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[#6A3A30]/60 hover:text-[#6A3A30] hover:border-[#6A3A30]/30 transition-colors"
                                                            aria-label="Mostrar QR"
                                                        >
                                                            <QrCode size={11} />
                                                            QR
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <p className="text-xs text-[#6A3A30]/60 font-medium leading-relaxed">{formatCouponSubtitle(coupon)}</p>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    {expiryLabel && (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-[#6A3A30]/5 px-2 py-0.5 text-[10px] font-bold text-[#6A3A30]/60">
                                                            {expiryLabel}
                                                        </span>
                                                    )}
                                                    {isAvailable && (
                                                        <span className="inline-flex items-center gap-1 rounded-full border border-[#1A864D]/20 bg-[#1A864D]/10 px-2 py-0.5 text-[10px] font-bold text-[#1A864D]">
                                                            Canje en app
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {isAvailable && (
                                                <div className="grid grid-cols-2 gap-2 border-t border-[#6A3A30]/5 pt-3">
                                                    <button
                                                        onClick={() => onUseCoupon(coupon)}
                                                        className="py-2 px-3 bg-[#6A3A30] text-[#FFFBEA] rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-[#5a3128] transition-colors flex items-center justify-center gap-1.5"
                                                    >
                                                        <ShoppingBag size={12} /> Usar
                                                    </button>
                                                    <button
                                                        onClick={() => onGiftClick(coupon)}
                                                        disabled={giftingCouponId === coupon.id}
                                                        className="py-2 px-3 bg-[#FFFBEA] border border-[#6A3A30]/10 text-[#6A3A30]/80 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:border-[#6A3A30]/30 hover:text-[#6A3A30] transition-colors flex items-center justify-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-60"
                                                    >
                                                        {giftingCouponId === coupon.id ? "..." : "Regalar"} <Send size={12} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )
                        }
                    </div>

                </div >
            </div>
        </div >
    )
}
