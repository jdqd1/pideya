import { Ticket, Sparkles } from "lucide-react"
import type { CouponDto } from "../../../../types/userState"

type FirstCouponModalProps = {
    active: boolean
    onClose: () => void
    coupon: CouponDto
}

export default function FirstCouponModal({ active, onClose, coupon }: FirstCouponModalProps) {
    if (!active) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-[#6A3A30]/60 backdrop-blur-sm animate-in fade-in duration-500"
                onClick={onClose}
            />

            {/* Card */}
            <div className="relative w-full max-w-sm bg-[#FFFBEA] rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 border border-[#6A3A30]/10">

                {/* Header Graphic */}
                <div className="relative h-44 bg-gradient-to-br from-[#1A864D] via-[#AFC8BF] to-[#6A3A30] flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />

                    <div className="relative z-10 flex flex-col items-center">
                        <div className="h-20 w-20 bg-[#FFFBEA] rounded-2xl shadow-xl flex items-center justify-center rotate-3 ring-4 ring-[#FFFBEA]/30 transform transition-transform hover:rotate-0 duration-300">
                            <Ticket className="w-10 h-10 text-[#1A864D]" />
                        </div>
                        <div className="absolute -right-8 -top-4">
                            <Sparkles className="text-[#FFFBEA] w-8 h-8 animate-pulse" />
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-8 text-center -mt-6 relative z-20">
                    <span className="inline-block px-4 py-1.5 rounded-full bg-[#FFFBEA] shadow-sm border border-[#1A864D]/20 text-xs font-bold text-[#1A864D] uppercase tracking-widest mb-4">
                        ¡Primer Logro!
                    </span>

                    <h3 className="text-2xl font-black text-[#6A3A30] mb-2 leading-tight">
                        ¡Tu primer cupón!
                    </h3>
                    <p className="text-[#6A3A30]/60 font-medium text-sm leading-relaxed mb-6">
                        Felicitaciones, has desbloqueado tu primera recompensa.
                        Puedes usarla en tu próxima compra.
                    </p>

                    {/* Coupon Preview */}
                    <div className="bg-white border border-[#6A3A30]/10 rounded-2xl p-4 mb-6 shadow-sm">
                        <p className="font-bold text-[#6A3A30] text-lg mb-1">{coupon.title}</p>
                        <p className="text-xs text-[#6A3A30]/40 font-medium">Válido hasta: {new Date(coupon.expiresAt || "").toLocaleDateString()}</p>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-full h-14 bg-[#6A3A30] hover:bg-[#5a3128] active:scale-[0.98] text-[#FFFBEA] rounded-2xl font-bold text-lg shadow-xl shadow-[#6A3A30]/20 flex items-center justify-center gap-2 transition-all group"
                    >
                        ¡Entendido!
                    </button>
                </div>
            </div>
        </div>
    )
}
