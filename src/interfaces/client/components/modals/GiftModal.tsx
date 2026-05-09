
import { AlertCircle, CheckCircle2, Gift, X } from "lucide-react"
import type { GiftModalProps } from "../../types"

export function GiftModal({
    modal,
    email,
    status,
    loading,
    giftingCouponId,
    onClose,
    onSend,
    onEmailChange,
    isSuccess,
}: GiftModalProps) {
    const sending = loading || (modal.coupon && giftingCouponId === modal.coupon.id)

    return (
        <div
            className={`fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 transition-all duration-300 ${modal.active ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                }`}
        >
            <div className="absolute inset-0 bg-[#6A3A30]/60 backdrop-blur-sm" onClick={onClose} />

            <div
                className={`bg-[#FFFBEA] w-full max-w-sm rounded-[2rem] p-6 sm:p-8 relative shadow-2xl transition-all duration-500 ${modal.active ? "translate-y-0 scale-100" : "translate-y-10 scale-95"
                    }`}
            >
                <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-[#6A3A30]/5 rounded-full text-[#6A3A30]/40 hover:bg-[#6A3A30]/10 hover:text-[#6A3A30] transition-colors">
                    <X size={20} />
                </button>

                {isSuccess ? (
                    <div className="text-center py-4 animate-in fade-in zoom-in duration-300">
                        <div className="w-20 h-20 bg-[#1A864D]/10 text-[#1A864D] rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm ring-4 ring-[#1A864D]/5">
                            <CheckCircle2 size={40} />
                        </div>
                        <h3 className="text-2xl font-black text-[#6A3A30] mb-2">¡Enviado!</h3>
                        <p className="text-[#6A3A30]/60 font-medium px-4 leading-relaxed">
                            El cupón se ha transferido correctamente a <span className="text-[#6A3A30] font-bold">{email}</span>.
                        </p>
                        <button
                            onClick={onClose}
                            className="mt-8 w-full bg-[#6A3A30] text-[#FFFBEA] rounded-xl py-3.5 font-bold hover:bg-[#5a3128] transition-colors"
                        >
                            Entendido
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-[#6A3A30]/5 text-[#6A3A30] rounded-full flex items-center justify-center mx-auto mb-4">
                                <Gift size={32} />
                            </div>
                            <h3 className="text-xl font-black text-[#6A3A30]">Regalar Cupón</h3>
                            <p className="text-sm text-[#6A3A30]/60 font-medium mt-1 px-4">Comparte la alegría enviando este premio a un amigo.</p>
                        </div>

                        <div className="bg-white rounded-xl p-4 mb-6 border border-[#6A3A30]/10">
                            <p className="text-xs font-bold text-[#6A3A30]/40 uppercase tracking-wider mb-1">Vas a regalar</p>
                            <p className="font-bold text-[#6A3A30]">{modal.coupon?.title}</p>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <input
                                    value={email}
                                    onChange={(e) => onEmailChange(e.target.value)}
                                    placeholder="Email del destinatario"
                                    className="w-full bg-white border-2 border-transparent focus:border-[#6A3A30]/20 focus:bg-[#FFFBEA] rounded-xl px-4 py-3 font-medium text-[#6A3A30] outline-none transition-all placeholder:text-[#6A3A30]/30"
                                />
                                {/* Mensaje de Error Estilizado */}
                                {status && !loading && (
                                    <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 animate-in slide-in-from-top-1 fade-in">
                                        <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                        <span className="text-xs font-bold leading-snug">{status}</span>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={onSend}
                                disabled={sending || !email.trim()}
                                className="w-full bg-[#6A3A30] text-[#FFFBEA] rounded-xl py-3.5 font-bold hover:bg-[#5a3128] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-[#6A3A30]/20"
                            >
                                {sending ? (
                                    <>
                                        <div className="w-4 h-4 rounded-full border-2 border-[#FFFBEA]/30 border-t-[#FFFBEA] animate-spin" />
                                        Enviando...
                                    </>
                                ) : "Confirmar Envío"}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
