
import { QrCode } from "lucide-react"
import type { RedeemModalProps } from "../../types"

export function RedeemModal({ redeemModal, setRedeemModal }: RedeemModalProps) {
    return (
        <div
            className={`fixed inset-0 z-[60] flex items-center justify-center p-4 transition-all duration-300 ${redeemModal.active ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                }`}
        >
            <div className="absolute inset-0 bg-[#6A3A30]/80 backdrop-blur-md" onClick={() => setRedeemModal({ active: false, coupon: null, qr: "" })} />

            <div className={`bg-[#FFFBEA] w-full max-w-sm rounded-[2.5rem] p-8 relative z-10 shadow-[0_50px_100px_-20px_rgba(106,58,48,0.25)] transition-all duration-500 ${redeemModal.active ? "translate-y-0 scale-100" : "translate-y-12 scale-90"
                }`}>
                <div className="text-center space-y-6">
                    <div>
                        <h3 className="text-2xl font-black text-[#6A3A30] tracking-tight">Código QR</h3>
                        <p className="text-sm text-[#6A3A30]/60 font-medium">Muestra este código en caja</p>
                    </div>

                    <div className="bg-[#6A3A30] p-4 rounded-[2rem] shadow-xl inline-block">
                        <div className="bg-white rounded-[1.5rem] p-4">
                            {redeemModal.qr ? (
                                <img src={redeemModal.qr} className="w-48 h-48 object-contain mix-blend-multiply" alt="QR" />
                            ) : (
                                <div className="w-48 h-48 flex items-center justify-center">
                                    <QrCode className="text-[#6A3A30]/20 animate-pulse" size={48} />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-4 border border-[#6A3A30]/10">
                        <p className="font-bold text-[#6A3A30]">{redeemModal.coupon?.title}</p>
                        <p className="text-[10px] font-mono text-[#6A3A30]/40 mt-1 uppercase truncate px-4">
                            ID: {redeemModal.coupon?.id}
                        </p>
                    </div>

                    <button
                        onClick={() => setRedeemModal({ active: false, coupon: null, qr: "" })}
                        className="w-full py-3 rounded-xl border border-[#6A3A30]/10 font-bold text-[#6A3A30]/60 hover:bg-white transition-colors text-sm"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    )
}
