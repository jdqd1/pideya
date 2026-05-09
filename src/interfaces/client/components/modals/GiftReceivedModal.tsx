import { Gift, Sparkles } from "lucide-react"
import type { CouponActivity } from "../../../../types/app"

type GiftReceivedModalProps = {
    active: boolean
    onClose: () => void
    gift: CouponActivity | null
}

const getPeerHandle = (peer?: string | null) => {
    if (!peer) return null
    const trimmed = peer.trim()
    if (!trimmed) return null
    const handle = trimmed.split("@")[0]
    return handle || trimmed
}

export default function GiftReceivedModal({ active, onClose, gift }: GiftReceivedModalProps) {
    if (!active) return null

    const peerHandle = getPeerHandle(gift?.peer)

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-[#6A3A30]/60 backdrop-blur-sm animate-in fade-in duration-500"
                onClick={onClose}
            />

            <div className="relative w-full max-w-sm overflow-hidden rounded-[2rem] border border-[#6A3A30]/10 bg-[#FFFBEA] shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
                <div className="relative h-36 bg-gradient-to-br from-[#FFEBC2] via-[#FFFBEA] to-[#BFE3D0]">
                    <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/40 blur-2xl" />
                    <div className="absolute -bottom-8 -left-6 h-24 w-24 rounded-full bg-emerald-200/30 blur-2xl" />

                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="relative flex items-center justify-center">
                            <div className="h-16 w-16 rounded-2xl bg-white/90 shadow-lg ring-4 ring-white/50 flex items-center justify-center">
                                <Gift size={28} className="text-[#1A864D]" />
                            </div>
                            <Sparkles size={20} className="absolute -top-3 -right-3 text-[#1A864D]/70 animate-pulse" />
                        </div>
                    </div>
                </div>

                <div className="p-8 text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1A864D]">
                        Regalo recibido
                    </p>
                    <h3 className="mt-2 text-2xl font-black text-[#6A3A30]">Recibiste un regalo</h3>
                    <p className="mt-2 text-sm font-medium text-[#6A3A30]/60">
                        Un nuevo cupon ya esta en tu billetera.
                    </p>

                    <div className="mt-5 rounded-2xl border border-[#6A3A30]/10 bg-white p-4 shadow-sm">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#6A3A30]/40">Cupon</p>
                        <p className="text-sm font-bold text-[#6A3A30]">
                            {gift?.title || "Regalo sorpresa"}
                        </p>
                        {peerHandle && (
                            <p className="mt-1 text-xs font-medium text-[#6A3A30]/60">De @{peerHandle}</p>
                        )}
                    </div>

                    <button
                        onClick={onClose}
                        className="mt-6 h-12 w-full rounded-2xl bg-[#6A3A30] text-[#FFFBEA] font-bold shadow-lg shadow-[#6A3A30]/20 transition-all hover:bg-[#5a3128] active:scale-[0.98]"
                    >
                        Gracias
                    </button>
                </div>
            </div>
        </div>
    )
}
